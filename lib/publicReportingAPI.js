const { EVENTS } = require('./constants/events');

/**
 * Public API to emit additional events to RP JS agents.
 */
class PublicReportingAPI {
  /**
   * Emit set description event.
   * @param {String} text - description of current test/suite.
   * @param {String} suite - suite description, optional.
   */
  static setDescription(text, suite) {
    process.emit(EVENTS.SET_DESCRIPTION, { text, suite });
  }

  /**
   * Emit add attributes event.
   * @param {Array} attributes - array of attributes, should looks like this:
   * [{
   *      key: "attrKey",
   *      value: "attrValue",
   * }]
   *
   * @param {String} suite - suite description, optional.
   */
  static addAttributes(attributes, suite) {
    process.emit(EVENTS.ADD_ATTRIBUTES, { attributes, suite });
  }

  /**
   * Emit send log to test item event.
   * @param {Object} log - log object should looks like this:
   * {
   *      level: "INFO",
   *      message: "log message",
   *      file: {
   *          name: "filename",
   *          type: "image/png",  // media type
   *          content: data,  // file content represented as 64base string
   *      },
   * }
   * @param {String} suite - suite description, optional.
   */
  static addLog(log, suite) {
    process.emit(EVENTS.ADD_LOG, { log, suite });
  }

  /**
   * Emit send log to current launch event.
   * @param {Object} log - log object should looks like this:
   * {
   *      level: "INFO",
   *      message: "log message",
   *      file: {
   *          name: "filename",
   *          type: "image/png",  // media type
   *          content: data,  // file content represented as 64base string
   *      },
   * }
   */
  static addLaunchLog(log) {
    process.emit(EVENTS.ADD_LAUNCH_LOG, log);
  }

  /**
   * Emit set testCaseId event.
   * @param {String} testCaseId - testCaseId of current test/suite.
   * @param {String} suite - suite description, optional.
   */
  static setTestCaseId(testCaseId, suite) {
    process.emit(EVENTS.SET_TEST_CASE_ID, { testCaseId, suite });
  }

  /**
   * Emit set status to current launch event.
   * @param {String} status - status of current launch.
   */
  static setLaunchStatus(status) {
    process.emit(EVENTS.SET_LAUNCH_STATUS, status);
  }

  /**
   * Emit set status event.
   * @param {String} status - status of current test/suite.
   * @param {String} suite - suite description, optional.
   */
  static setStatus(status, suite) {
    process.emit(EVENTS.SET_STATUS, { status, suite });
  }
}

module.exports = PublicReportingAPI;
