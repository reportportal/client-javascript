const fs = require('fs');
const glob = require('glob');
const RestClient = require('./rest');

const MIN = 3;
const MAX = 256;

const getIdFormFileName = (filename) => {
    const launchNumberAndId = filename.match(/#\d+-(.*)/)[0];
    const launchIdWithExtensionTmp = launchNumberAndId.split('-')[1];
    const launchId = launchIdWithExtensionTmp.split('.')[0];

    return launchId;
};


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

    readLaunchesFromFile(project) {        
        let filesPattern = 'rplaunch-*.tmp'
        if (project) {
            filesPattern = project.concat('/', filesPattern)
        }
        const files = glob.sync(filesPattern);
        const ids = files.map(getIdFormFileName);

        return ids;
    },

    saveLaunchIdToFile(launchName, launchNumber, launchId) {
        const filename = `rplaunch-${launchName}-#${launchNumber}-${launchId}.tmp`;
        fs.open(filename, 'w', (err) => {
            if (err) {
                throw err;
            }
        });
    },
};
