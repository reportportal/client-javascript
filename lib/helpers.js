const RestClient = require('./rest');
const fs = require('fs');

const MIN = 3;
const MAX = 256;
const tempFileForLaunchIds = "tempLaunchIds.txt";


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
        return RestClient
            .request(method, url, request, options);
    },

    readLaunchesFromFile() {
        return fs.readFileSync(tempFileForLaunchIds, 'utf8', function(err, data) {
            if (err) throw err;
            return data;
        }).toString().split('|');
    },

    saveLaunchIdToFile(launch_id) {
        let data = launch_id + "|";
        fs.appendFile(tempFileForLaunchIds, data, 'utf8',  (err) => {
            if (err) throw err;
        });
    }
};
