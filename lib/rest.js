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

    addLogger(this.restClientConfig ? this.restClientConfig.debug : false);
  }

  buildPath(path) {
    return [this.baseURL, path].join('/');
  }

  buildPathToSyncAPI(path) {
    return [this.baseURL.replace('/v2', '/v1'), path].join('/');
  }

  static request(method, url, data, options = {}) {
    return axios({
      method,
      url,
      data,
      timeout: DEFAULT_MAX_CONNECTION_TIME_MS,
      ...options,
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

  create(path, data, options = { headers: this.headers }) {
    return RestClient.request('POST', this.buildPath(path), data, {
      ...options,
      ...this.getRestConfig(),
    });
  }

  retrieve(path, options = { headers: this.headers }) {
    return RestClient.request(
      'GET',
      this.buildPath(path),
      {},
      { ...options, ...this.getRestConfig() },
    );
  }

  update(path, data, options = { headers: this.headers }) {
    return RestClient.request('PUT', this.buildPath(path), data, {
      ...options,
      ...this.getRestConfig(),
    });
  }

  delete(path, data, options = { headers: this.headers }) {
    return RestClient.request('DELETE', this.buildPath(path), data, {
      ...options,
      ...this.getRestConfig(),
    });
  }

  retrieveSyncAPI(path, options = { headers: this.headers }) {
    return RestClient.request(
      'GET',
      this.buildPathToSyncAPI(path),
      {},
      { ...options, ...this.getRestConfig() },
    );
  }
}

const addLogger = (debug) => {
  if (debug) {
    axios.interceptors.request.use((config) => {
      const startDate = new Date();
      config.startTime = startDate.valueOf();

      console.log(`Request method=${config.method} url=${config.url} [${startDate.toISOString()}]`);

      return config;
    });

    axios.interceptors.response.use(
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
          `Response ${status ? 'status=' + status : "message='" + error.message + "'"} url=${
            config.url
          } time=${date.valueOf() - config.startTime}ms [${date.toISOString()}]`,
        );

        return Promise.reject(error);
      },
    );
  }
};

module.exports = RestClient;
