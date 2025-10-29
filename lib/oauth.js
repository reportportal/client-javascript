const axios = require('axios');
const { getProxyAgentForUrl } = require('./proxyHelper');

const TOKEN_REFRESH_THRESHOLD_MS = 60000;
const DEFAULT_TOKEN_EXPIRATION_MS = 3600000; // 1 hour in milliseconds
const SECOND_IN_MS = 1000;
const GRANT_TYPE_PASSWORD = 'password';
const GRANT_TYPE_REFRESH_TOKEN = 'refresh_token';

class OAuthInterceptor {
  /**
   * OAuth 2.0 Password Grant Flow Interceptor
   * @param {Object} config - OAuth configuration
   * @param {string} config.tokenEndpoint - OAuth token endpoint URL
   * @param {string} config.username - Username for password grant
   * @param {string} config.password - Password for password grant
   * @param {string} config.clientId - OAuth client ID
   * @param {string} [config.clientSecret] - OAuth client secret (optional)
   * @param {string} [config.scope] - OAuth scope (optional)
   * @param {boolean} [config.debug] - Enable debug logging
   * @param {Object} [config.restClientConfig] - REST client configuration for proxy support
   */
  constructor(config) {
    this.tokenEndpoint = config.tokenEndpoint;
    this.username = config.username;
    this.password = config.password;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.scope = config.scope;
    this.restClientConfig = config.restClientConfig || {};
    this.debug = this.restClientConfig.debug || false;

    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiresAt = null;
    this.tokenRenewPromise = null;
  }

  logDebug(message, data = '') {
    if (this.debug) {
      console.log(`[OAuth] ${message}`, data);
    }
  }

  /**
   * Obtains or refreshes the access token
   * @returns {Promise<string>} Access token
   */
  async getAccessToken() {
    if (this.tokenRenewPromise) {
      this.logDebug('Waiting for ongoing token refresh');
      return this.tokenRenewPromise;
    }

    if (this.accessToken && this.tokenExpiresAt) {
      const now = Date.now();
      const timeUntilExpiry = this.tokenExpiresAt - now;

      if (timeUntilExpiry > TOKEN_REFRESH_THRESHOLD_MS) {
        this.logDebug('Using existing valid token');
        return this.accessToken;
      }

      this.logDebug('Token expiring soon, refreshing');
    }

    this.tokenRenewPromise = this.renewToken();

    try {
      const token = await this.tokenRenewPromise;
      return token;
    } catch (error) {
      this.logDebug('Error during token refresh', error);
      throw error;
    } finally {
      this.tokenRenewPromise = null;
    }
  }

  /**
   * Refreshes the access token using password grant or refresh token grant
   * @returns {Promise<string>} Access token
   */
  async renewToken() {
    try {
      return await this.requestToken(
        this.refreshToken ? GRANT_TYPE_REFRESH_TOKEN : GRANT_TYPE_PASSWORD,
      );
    } catch (error) {
      // If refresh token grant failed, try password grant as fallback
      if (this.refreshToken) {
        this.logDebug('Refresh token failed, falling back to password grant');
        console.warn(
          '[OAuth] Refresh token expired or invalid, re-authenticating with password grant',
        );
        this.refreshToken = null; // Clear invalid refresh token

        try {
          return await this.requestToken(GRANT_TYPE_PASSWORD);
        } catch (fallbackError) {
          const errorMessage = fallbackError.response
            ? `OAuth password grant fallback failed: ${
                fallbackError.response.status
              } - ${JSON.stringify(fallbackError.response.data)}`
            : `OAuth password grant fallback failed: ${fallbackError.message}`;

          console.error(`[OAuth] ${errorMessage}`);
          throw new Error(errorMessage);
        }
      }

      // No fallback available, rethrow original error
      const errorMessage = error.response
        ? `OAuth token request failed: ${error.response.status} - ${JSON.stringify(
            error.response.data,
          )}`
        : `OAuth token request failed: ${error.message}`;

      console.error(`[OAuth] ${errorMessage}`);
      throw new Error(errorMessage);
    }
  }

  /**
   * Requests a token using the specified grant type
   * @param {string} grantType - Either 'password' or 'refresh_token'
   * @returns {Promise<string>} Access token
   * @private
   */
  async requestToken(grantType) {
    const params = new URLSearchParams();
    params.append('client_id', this.clientId);
    params.append('grant_type', grantType);

    if (grantType === GRANT_TYPE_REFRESH_TOKEN) {
      this.logDebug('Requesting new access token using refresh_token');
      params.append('refresh_token', this.refreshToken);
    } else {
      this.logDebug('Requesting access token using username and password');
      params.append('username', this.username);
      params.append('password', this.password);
    }

    if (this.clientSecret) {
      params.append('client_secret', this.clientSecret);
    }
    if (this.scope) {
      params.append('scope', this.scope);
    }

    // Get proxy agent for token endpoint
    // Only apply if custom agents are not explicitly provided
    const hasCustomAgents = this.restClientConfig.httpsAgent || this.restClientConfig.httpAgent;
    const proxyAgents = hasCustomAgents
      ? {}
      : getProxyAgentForUrl(this.tokenEndpoint, this.restClientConfig);
    const usingProxyAgent = Object.keys(proxyAgents).length > 0;

    if (this.debug && usingProxyAgent) {
      this.logDebug(`Making token request to ${this.tokenEndpoint} with proxy agent`);
    }

    const response = await axios.post(this.tokenEndpoint, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      ...proxyAgents,
      // Custom agents from restClientConfig (if provided) take precedence
      ...(this.restClientConfig.httpsAgent && { httpsAgent: this.restClientConfig.httpsAgent }),
      ...(this.restClientConfig.httpAgent && { httpAgent: this.restClientConfig.httpAgent }),
      // Explicitly disable axios built-in proxy when using custom agents
      ...(usingProxyAgent && { proxy: false }),
    });

    const {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: expiresIn,
    } = response.data;

    if (!accessToken) {
      throw new Error('No access token received from OAuth server');
    }

    this.accessToken = accessToken;

    if (refreshToken) {
      this.refreshToken = refreshToken;
      this.logDebug('Refresh token stored for future use');
    }

    if (expiresIn) {
      this.tokenExpiresAt = Date.now() + expiresIn * SECOND_IN_MS;
      this.logDebug(`Token obtained, expires in ${expiresIn} seconds`);
    } else {
      this.tokenExpiresAt = Date.now() + DEFAULT_TOKEN_EXPIRATION_MS;
      this.logDebug('Token obtained, no expiration provided, assuming 1 hour');
    }

    return this.accessToken;
  }

  /**
   * Attaches the interceptor to an axios instance
   * @param {Object} axiosInstance - Axios instance to attach interceptor to
   */
  attach(axiosInstance) {
    axiosInstance.interceptors.request.use(
      async (config) => {
        try {
          const token = await this.getAccessToken();
          // eslint-disable-next-line no-param-reassign
          config.headers.Authorization = `Bearer ${token}`;
          this.logDebug(`Request to ${config.url} with OAuth token`);
          return config;
        } catch (error) {
          console.error('[OAuth] Failed to obtain access token, request may fail:', error.message);
          return config;
        }
      },
      (error) => Promise.reject(error),
    );
  }
}

module.exports = OAuthInterceptor;
