const rq = require('request-promise');
const MIN = 3;
const MAX = 256;
module.exports = {
    formatName: function(name) {
        let len = name.length;
        return ((len < MIN) ? (name + new Array(MIN - len + 1).join('.')) : name).slice(-MAX);
    },

    now: function() {
        return new Date().valueOf();
    },

    getServerResult: function(url, rqBody, options, method) {
        let rq_options = {
            method: method,
            uri: url,
            body: rqBody,
            headers: options
        }
        let response = function (resolve, reject) {
            rq(rq_options).then( function (data) {
                    resolve(data);
                })
                .catch("fail", function (data) {
                    reject(data);
                });
        };
        return new Promise(response);
    },

}
