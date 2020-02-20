const { EVENTS } = require('./constants');
const { publishEvent } = require('./utils');

class PublicReportingAPI {
    static addDescription(text) {
        publishEvent(EVENTS.ADD_DESCRIPTION, { text });
    }

    static addAttributes(attributes) {
        publishEvent(EVENTS.ADD_ATTRIBUTES, { attributes });
    }

    static addLog(level, message) {
        publishEvent(EVENTS.ADD_LOG, { level, message });
    }

    static addAttachment(level, file, message) {
        publishEvent(EVENTS.ADD_ATTACHMENT, { level, file, message });
    }
}

module.exports = PublicReportingAPI;
