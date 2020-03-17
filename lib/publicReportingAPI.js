const { EVENTS } = require('./events');

/**
 * Public API to emit additional events to RP JS agents.
 */
class PublicReportingAPI {
    /**
     * Emit add description event.
     * @param {String} text - description of current test/suite.
     */
    static addDescription(text) {
        process.emit(EVENTS.ADD_DESCRIPTION, { text });
    }

    /**
     * Emit add attributes event.
     * @param {Array} attributes - array of attributes, should looks like this:
     * [{
     *      key: "attrKey",
     *      value: "attrValue",
     * }]
     */
    static addAttributes(attributes) {
        process.emit(EVENTS.ADD_ATTRIBUTES, { attributes });
    }

    /**
     * Emit send log to test item event.
     * @param {Object} log - log object should looks like this:
     * {
     *      level: "INFO",
     *      message: "log message",
     *      file: base64String,
     * }
     */
    static addLog(log) {
        process.emit(EVENTS.ADD_LOG, log);
    }

    /**
     * Emit send log to curent launch event.
     * @param {Object} log - log object should looks like this:
     * {
     *      level: "INFO",
     *      message: "log message",
     *      file: base64String,
     * }
     */
    static addLaunchLog(log) {
        process.emit(EVENTS.ADD_LAUNCH_LOG, log);
    }
}

module.exports = PublicReportingAPI;
