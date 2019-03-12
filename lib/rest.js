const axios = require('axios');
const retryInterceptor = require('axios-retry-interceptor');

retryInterceptor(axios, {
    maxAttempts: 10,
    waitTime: 100,
    errorCodes: [406],
});

class RestClient {
    constructor(options) {
        this.baseURL = options.baseURL;
        this.headers = options.headers;
    }

    buildPath(path) {
        return [this.baseURL, path].join('/');
    }

    static request(method, url, data, options = {}) {
        return axios({
            method,
            url,
            headers: options.headers,
            data,
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
}

module.exports = RestClient;
