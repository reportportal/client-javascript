const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const http = require('http');
const https = require('https');
const logger = require('./logger');

const DEFAULT_MAX_CONNECTION_TIME_MS = 30000;

axiosRetry(axios, {
  retryDelay: () => 100,
  retries: 10,
  retryCondition: axiosRetry.isRetryableError,
});

class RestClient {
  constructor(options) {
    this.baseURL = options.baseURL;
    this.headers = options.headers;
    this.restClientConfig = options.restClientConfig;

    this.axiosInstance = axios.create({
      timeout: DEFAULT_MAX_CONNECTION_TIME_MS,
      headers: this.headers,
      ...this.getRestConfig(this.restClientConfig),
    });

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
    return this.axiosInstance
      .request({
        method,
        url,
        data,
        ...options,
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
      if (key !== 'agent') {
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
