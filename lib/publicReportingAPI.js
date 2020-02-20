const { EVENTS } = require('./events');

class PublicReportingAPI {
    static addDescription(text) {
        process.emit(EVENTS.ADD_DESCRIPTION, { text });
    }

    static addAttributes(attributes) {
        process.emit(EVENTS.ADD_ATTRIBUTES, { attributes });
    }

    static addLog(level, message) {
        process.emit(EVENTS.ADD_LOG, { level, message });
    }

    static addAttachment(level, file, message) {
        process.emit(EVENTS.ADD_ATTACHMENT, { level, file, message });
    }
}

module.exports = PublicReportingAPI;
