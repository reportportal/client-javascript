/* eslint-disable no-shadow */
const rest = require('restler');

const MIN = 3;
const MAX = 256;

module.exports = {
    formatName(name) {
        const len = name.length;
        // eslint-disable-next-line no-mixed-operators
        return ((len < MIN) ? (name + new Array(MIN - len + 1).join('.')) : name).slice(-MAX);
    },

    now() {
        return new Date().valueOf();
    },

    getServerResult(url, request, options, method) {
        const response = function (resolve, reject) {
            rest.json(url, request, options, method)
                .on('success', (data) => { resolve(data); })
                .on('fail', (data) => { reject(data); })
                .on('error', () => {
                    rest.json(url, request, options, method)
                        .on('success', (data) => { resolve(data); })
                        .on('fail', (data) => { reject(data); })
                        .on('error', () => {
                            rest.json(url, request, options, method)
                                .on('success', (data) => { resolve(data); })
                                .on('fail', (data) => { reject(data); })
                                .on('error', (data) => {
                                    // eslint-disable-next-line no-console
                                    console.dir(data);
                                    reject(data);
                                });
                        });
                });
        };
        return new Promise(response);
    },

};
