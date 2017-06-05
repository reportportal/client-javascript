const rest = require('restler');
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

    getServerResult: function(url, rq, options, method) {
        var response = function (resolve, reject) {
            rest.json(url, rq, options, method)
                .on("success", function (data) {
                    resolve(data);
                })
                .on("fail", function (data) {
                    reject(data);
                })
                .on("error", function (data) {
                    reject(data);
                });
        };
        return new Promise(response);
    }

}
