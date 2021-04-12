const axios = require('axios');
const axiosRetry = require('axios-retry');

const DEFAULT_MAX_CONNECTION_TIME_MS = 5000;

axiosRetry(axios, { retryDelay: () => 100, retries: 10, retryCondition: axiosRetry.isRetryableError });

class RestClient {
    constructor(options) {
        this.baseURL = options.baseURL;
        this.headers = options.headers;
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

    create(path, data, options = { headers: this.headers }) {
        return RestClient.request('POST', this.buildPath(path), data, options);
    }

    retrieve(path, options = { headers: this.headers }) {
        return RestClient.request('GET', this.buildPath(path), {}, options);
    }

    update(path, data, options = { headers: this.headers }) {
        return RestClient.request('PUT', this.buildPath(path), data, options);
    }

    delete(path, data, options = { headers: this.headers }) {
        return RestClient.request('DELETE', this.buildPath(path), data, options);
    }

    retrieveSyncAPI(path, options = { headers: this.headers }) {
        return RestClient.request('GET', this.buildPathToSyncAPI(path), {}, options);
    }
}

module.exports = RestClient;
