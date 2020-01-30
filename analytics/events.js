const { PJSON_VERSION, PJSON_NAME } = require('./constants');

const CLIENT_JAVASCRIPT = `Client name "${PJSON_NAME}", version "${PJSON_VERSION}"`;
const CLIENT_JAVASCRIPT_EVENTS = {
    START_LAUNCH: {
        category: CLIENT_JAVASCRIPT,
        action: 'Start launch',
    },
};

module.exports = {
    CLIENT_JAVASCRIPT_EVENTS,
};
