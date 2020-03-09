const { EVENTS } = require('./events');
const { getLogObj } = require('./helpers');

class PublicReportingAPI {
    static addDescription(text) {
        process.emit(EVENTS.ADD_DESCRIPTION, { text });
    }

    static addAttributes(attributes) {
        process.emit(EVENTS.ADD_ATTRIBUTES, { attributes });
    }

    static addLog(level, message, time) {
        process.emit(EVENTS.ADD_LOG, getLogObj(level, message, time));
    }

    static addLaunchLog(level, message, time) {
        process.emit(EVENTS.ADD_LAUNCH_LOG, getLogObj(level, message, time));
    }

    static addAttachment(level, file, message) {
        process.emit(EVENTS.ADD_ATTACHMENT, { level, file, message });
    }
}

module.exports = PublicReportingAPI;
