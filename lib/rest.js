const axios = require('axios');
const axiosRetry = require('axios-retry');
const http = require('http');
const https = require('https');

const DEFAULT_MAX_CONNECTION_TIME_MS = 30000;

axiosRetry(axios, { retryDelay: () => 100, retries: 10, retryCondition: axiosRetry.isRetryableError });

class RestClient {
    constructor(options) {
        this.baseURL = options.baseURL;
        this.headers = options.headers;
        this.restClientConfig = options.restClientConfig;
    }

    buildPath(path) {
        return [this.baseURL, path].join('/');
    }

    buildPathToSyncAPI(path) {
        return [this.baseURL.replace('/v2', '/v1'), path].join('/');
    }

    static request(method, url, data, options = {}) {
        return axios(Object.assign({
            method,
            url,
            data,
            timeout: DEFAULT_MAX_CONNECTION_TIME_MS,
        }, options))
            .then(response => response.data)
            .catch((error) => {
                const errorMessage = error.message;
                const responseData = error.response && error.response.data;
                throw new Error(`${errorMessage}${
                    responseData
                    && typeof responseData === 'object'
                        ? `: ${JSON.stringify(responseData)}`
                        : ''}`);
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
        return RestClient.request('POST', this.buildPath(path), data, Object.assign({}, options, this.getRestConfig()));
    }

    retrieve(path, options = { headers: this.headers }) {
        return RestClient.request('GET', this.buildPath(path), {}, Object.assign({}, options, this.getRestConfig()));
    }

    update(path, data, options = { headers: this.headers }) {
        return RestClient.request('PUT', this.buildPath(path), data, Object.assign({}, options, this.getRestConfig()));
    }

    delete(path, data, options = { headers: this.headers }) {
        return RestClient.request(
            'DELETE',
            this.buildPath(path),
            data,
            Object.assign({}, options, this.getRestConfig()),
        );
    }

    retrieveSyncAPI(path, options = { headers: this.headers }) {
        return RestClient.request(
            'GET',
            this.buildPathToSyncAPI(path),
            {},
            Object.assign({}, options, this.getRestConfig()),
        );
    }
}

module.exports = RestClient;
