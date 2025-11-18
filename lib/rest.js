const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const http = require('http');
const https = require('https');
const logger = require('./logger');
const OAuthInterceptor = require('./oauth');
const { getProxyAgentForUrl } = require('./proxyHelper');

const DEFAULT_MAX_CONNECTION_TIME_MS = 30000;
const DEFAULT_RETRY_ATTEMPTS = 6;
const RETRY_BASE_DELAY_MS = 200;
const RETRY_MAX_DELAY_MS = 5000;

const isTimeoutError = (error) => {
  if (!error) return false;
  const message = error.message ? error.message.toLowerCase() : '';

  return (
    message.includes(`timeout`) ||
    error.code === 'ECONNABORTED' ||
    error.code === 'ETIMEDOUT' ||
    error?.cause?.code === 'ECONNABORTED' ||
    error?.cause?.code === 'ETIMEDOUT'
  );
};

const retryCondition = (error) => {
  return axiosRetry.isRetryableError(error) || isTimeoutError(error);
};

const DEFAULT_RETRY_CONFIG = {
  retryDelay: (retryCount = 1) => {
    const base = Math.min(RETRY_BASE_DELAY_MS * 2 ** Math.max(retryCount - 1, 0), RETRY_MAX_DELAY_MS);
    const jitter = Math.random() * 0.4 * base; // +/-40%
    return base - jitter;
  },
  retries: DEFAULT_RETRY_ATTEMPTS,
  retryCondition,
  shouldResetTimeout: true,
};
const SKIPPED_REST_CONFIG_KEYS = ['agent', 'retry', 'proxy', 'noProxy'];

class RestClient {
  constructor(options) {
    this.baseURL = options.baseURL;
    this.headers = options.headers;
    this.restClientConfig = options.restClientConfig;
    this.oauthConfig = options.oauthConfig;
    this.debug = options.debug;

    this.axiosInstance = axios.create({
      timeout: DEFAULT_MAX_CONNECTION_TIME_MS,
      headers: this.headers,
      ...this.getRestConfig(this.restClientConfig),
    });

    // Create and attach OAuth interceptor if OAuth config is provided
    // Must be before retry to ensure token is fresh on each retry
    if (this.oauthConfig) {
      try {
        const oauthInterceptor = new OAuthInterceptor({
          ...this.oauthConfig,
          debug: this.debug,
          restClientConfig: this.restClientConfig,
        });
        oauthInterceptor.attach(this.axiosInstance);
      } catch (error) {
        console.error('[RestClient] Failed to initialize OAuth interceptor:', error.message);
      }
    }

    axiosRetry(this.axiosInstance, this.getRetryConfig());

    if (this.restClientConfig?.debug) {
      logger.addLogger(this.axiosInstance);
    }
  }

  buildPath(path) {
    return [this.baseURL, path].join('/');
  }

  buildPathToSyncAPI(path) {
    return [this.baseURL.replace('/v2', '/v1'), path].join('/');
  }

  request(method, url, data, options = {}) {
    // Only apply proxy agents if custom agents are not explicitly provided
    // Priority: explicit httpsAgent/httpAgent/agent > proxy config > default
    const hasCustomAgents =
      this.restClientConfig &&
      ('httpsAgent' in this.restClientConfig ||
        'httpAgent' in this.restClientConfig ||
        'agent' in this.restClientConfig);
    const proxyAgents = hasCustomAgents ? {} : getProxyAgentForUrl(url, this.restClientConfig);
    const usingProxyAgent = Object.keys(proxyAgents).length > 0;

    return this.axiosInstance
      .request({
        method,
        url,
        data,
        ...options,
        ...proxyAgents,
        // Explicitly disable axios built-in proxy when using custom agents
        ...(usingProxyAgent && { proxy: false }),
        headers: {
          HOST: new URL(url).host,
          ...options.headers,
        },
      })
      .then((response) => response.data)
      .catch((error) => {
        const errorMessage = error.message;
        const responseData = error.response && error.response.data;
        throw new Error(
          `${errorMessage}${
            responseData && typeof responseData === 'object'
              ? `: ${JSON.stringify(responseData)}`
              : ''
          }
URL: ${url}
method: ${method}`,
        );
      });
  }

  getRestConfig() {
    if (!this.restClientConfig) return {};

    const config = Object.keys(this.restClientConfig).reduce((acc, key) => {
      if (!SKIPPED_REST_CONFIG_KEYS.includes(key)) {
        acc[key] = this.restClientConfig[key];
      }
      return acc;
    }, {});

    if ('agent' in this.restClientConfig) {
      const { protocol } = new URL(this.baseURL);
      const isHttps = /https:?/;
      const isHttpsRequest = isHttps.test(protocol);
      config[isHttpsRequest ? 'httpsAgent' : 'httpAgent'] = isHttpsRequest
        ? new https.Agent(this.restClientConfig.agent)
        : new http.Agent(this.restClientConfig.agent);
    }

    return config;
  }

  getRetryConfig() {
    const retryOption = this.restClientConfig?.retry;
    const onRetry = (retryCount, error, requestConfig) => {
      if (this.restClientConfig.debug) {
        console.log(`[retry #${retryCount}] ${requestConfig.method?.toUpperCase()} ${requestConfig.url} -> ${error.code || error.message}`);
      }
    };

    if (typeof retryOption === 'number') {
      return {
        onRetry,
        ...DEFAULT_RETRY_CONFIG,
        retries: retryOption,
      };
    }

    if (retryOption && typeof retryOption === 'object') {
      return {
        onRetry,
        ...DEFAULT_RETRY_CONFIG,
        ...retryOption,
      };
    }

    return { onRetry, ...DEFAULT_RETRY_CONFIG };
  }

  create(path, data, options = {}) {
    return this.request('POST', this.buildPath(path), data, {
      ...options,
    });
  }

  retrieve(path, options = {}) {
    return this.request(
      'GET',
      this.buildPath(path),
      {},
      {
        ...options,
      },
    );
  }

  update(path, data, options = {}) {
    return this.request('PUT', this.buildPath(path), data, {
      ...options,
    });
  }

  delete(path, data, options = {}) {
    return this.request('DELETE', this.buildPath(path), data, {
      ...options,
    });
  }

  retrieveSyncAPI(path, options = {}) {
    return this.request(
      'GET',
      this.buildPathToSyncAPI(path),
      {},
      {
        ...options,
      },
    );
  }
}

module.exports = RestClient;
