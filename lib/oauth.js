const axios = require('axios');

const TOKEN_REFRESH_THRESHOLD_MS = 60000;

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
   */
  constructor(config) {
    this.tokenEndpoint = config.tokenEndpoint;
    this.username = config.username;
    this.password = config.password;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.scope = config.scope;
    this.debug = config.debug || false;

    this.accessToken = null;
    this.tokenExpiresAt = null;
    this.tokenRefreshPromise = null;
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
    if (this.tokenRefreshPromise) {
      this.logDebug('Waiting for ongoing token refresh');
      return this.tokenRefreshPromise;
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

    this.tokenRefreshPromise = this.refreshToken();

    try {
      const token = await this.tokenRefreshPromise;
      return token;
    } catch (error) {
      this.logDebug('Error during token refresh', error);
      throw error;
    } finally {
      this.tokenRefreshPromise = null;
    }
  }

  /**
   * Refreshes the access token using password grant
   * @returns {Promise<string>} Access token
   */
  async refreshToken() {
    try {
      this.logDebug('Requesting new access token');

      const params = new URLSearchParams();
      params.append('grant_type', 'password');
      params.append('username', this.username);
      params.append('password', this.password);
      params.append('client_id', this.clientId);

      if (this.clientSecret) {
        params.append('client_secret', this.clientSecret);
      }

      if (this.scope) {
        params.append('scope', this.scope);
      }

      const response = await axios.post(this.tokenEndpoint, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const { access_token: accessToken, expires_in: expiresIn } = response.data;

      if (!accessToken) {
        throw new Error('No access token received from OAuth server');
      }

      this.accessToken = accessToken;

      if (expiresIn) {
        this.tokenExpiresAt = Date.now() + expiresIn * 1000;
        this.logDebug(`Token obtained, expires in ${expiresIn} seconds`);
      } else {
        // If no expiration provided, assume token is valid for 1 hour
        this.tokenExpiresAt = Date.now() + 3600000;
        this.logDebug('Token obtained, no expiration provided, assuming 1 hour');
      }

      return this.accessToken;
    } catch (error) {
      const errorMessage = error.response
        ? `OAuth token request failed: ${error.response.status} - ${JSON.stringify(error.response.data)}`
        : `OAuth token request failed: ${error.message}`;

      console.error(`[OAuth] ${errorMessage}`);
      throw new Error(errorMessage);
    }
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

