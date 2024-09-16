const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const http = require('http');
const https = require('https');

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
      addLogger(this.axiosInstance);
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

const addLogger = (axiosInstance) => {
  // axiosInstance.interceptors.request.clear();
  axiosInstance.interceptors.request.use((config) => {
    console.log('REQUEST CONFIG HEADERS', config);
    const startDate = new Date();
    // eslint-disable-next-line no-param-reassign
    config.startTime = startDate.valueOf();

    console.log(`Request method=${config.method} url=${config.url} [${startDate.toISOString()}]`);

    return config;
  });

  axiosInstance.interceptors.response.use(
    (response) => {
      const date = new Date();
      const { status, config } = response;

      console.log(
        `Response status=${status} url=${config.url} time=${
          date.valueOf() - config.startTime
        }ms [${date.toISOString()}]`,
      );

      return response;
    },
    (error) => {
      const date = new Date();
      const { response, config } = error;
      const status = response ? response.status : null;

      console.log(
        `Response ${status ? `status=${status}` : `message='${error.message}'`} url=${
          config.url
        } time=${date.valueOf() - config.startTime}ms [${date.toISOString()}]`,
      );

      return Promise.reject(error);
    },
  );
};

module.exports = RestClient;
