import { EVENTS } from './constants/events';

type Attribute = {
  key?: string;
  value: string;
};

type LogFile = {
  name: string;
  type: string;
  content: string;
};

type Log = {
  level?: string;
  message?: string;
  file?: LogFile;
};

export class PublicReportingAPI {
  /**
   * Emit set description event.
   * @param text - description of current test/suite.
   * @param suite - suite description, optional.
   */
  static setDescription(text: string, suite?: string): void {
    process.emit(EVENTS.SET_DESCRIPTION as any, { text, suite } as any);
  }

  /**
   * Emit add attributes event.
   * @param attributes - array of attributes.
   * @param suite - suite description, optional.
   */
  static addAttributes(attributes: Attribute[], suite?: string): void {
    process.emit(EVENTS.ADD_ATTRIBUTES as any, { attributes, suite }  as any);
  }

  /**
   * Emit send log to test item event.
   * @param log - log object.
   * @param suite - suite description, optional.
   */
  static addLog(log: Log, suite?: string): void {
    process.emit(EVENTS.ADD_LOG as any, { log, suite }  as any);
  }

  /**
   * Emit send log to current launch event.
   * @param log - log object.
   */
  static addLaunchLog(log: Log): void {
    process.emit(EVENTS.ADD_LAUNCH_LOG as any, log  as any);
  }

  /**
   * Emit set testCaseId event.
   * @param testCaseId - testCaseId of current test/suite.
   * @param suite - suite description, optional.
   */
  static setTestCaseId(testCaseId: string, suite?: string): void {
    process.emit(EVENTS.SET_TEST_CASE_ID as any, { testCaseId, suite }  as any);
  }

  /**
   * Emit set status to current launch event.
   * @param status - status of current launch.
   */
  static setLaunchStatus(status: string): void {
    process.emit(EVENTS.SET_LAUNCH_STATUS as any, status as any);
  }

  /**
   * Emit set status event.
   * @param status - status of current test/suite.
   * @param suite - suite description, optional.
   */
  static setStatus(status: string, suite?: string): void {
    process.emit(EVENTS.SET_STATUS as any, { status, suite }  as any);
  }
}

export default PublicReportingAPI;
