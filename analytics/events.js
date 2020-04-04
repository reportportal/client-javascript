const { PJSON_VERSION, PJSON_NAME } = require('./constants');

const CLIENT_JAVASCRIPT = `Client name "${PJSON_NAME}", version "${PJSON_VERSION}"`;
const CLIENT_JAVASCRIPT_EVENTS = {
    START_LAUNCH: {
        category: CLIENT_JAVASCRIPT,
        action: 'Start launch',
    },
};

const getAgentEventLabel = agentParams => `Agent name "${agentParams.name}", version "${agentParams.version}"`;

module.exports = {
    CLIENT_JAVASCRIPT_EVENTS,
    getAgentEventLabel,
};
