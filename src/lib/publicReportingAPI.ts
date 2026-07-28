import { EVENTS } from './constants/events';
import type { Attribute } from './models/common';
import type { LogOptions } from './models/requests';

function emit(event: string, ...args: unknown[]): boolean {
  return (process.emit as (e: string, ...a: unknown[]) => boolean)(event, ...args);
}

/**
 * Public API to emit additional events to RP JS agents.
 */
class PublicReportingAPI {
  /**
   * Emit set description event.
   */
  static setDescription(text: string, suiteName?: string): void {
    emit(EVENTS.SET_DESCRIPTION, { text, suite: suiteName });
  }

  /**
   * Emit add attributes event.
   */
  static addAttributes(attributes: Attribute[], suiteName?: string): void {
    emit(EVENTS.ADD_ATTRIBUTES, { attributes, suite: suiteName });
  }

  /**
   * Emit send log to test item event.
   */
  static addLog(log: LogOptions, suiteName?: string): void {
    emit(EVENTS.ADD_LOG, { log, suite: suiteName });
  }

  /**
   * Emit send log to current launch event.
   */
  static addLaunchLog(log: LogOptions): void {
    emit(EVENTS.ADD_LAUNCH_LOG, log);
  }

  /**
   * Emit set testCaseId event.
   */
  static setTestCaseId(testCaseId: string, suiteName?: string): void {
    emit(EVENTS.SET_TEST_CASE_ID, { testCaseId, suite: suiteName });
  }

  /**
   * Emit set status to current launch event.
   */
  static setLaunchStatus(status: string): void {
    emit(EVENTS.SET_LAUNCH_STATUS, status);
  }

  /**
   * Emit set status event.
   */
  static setStatus(status: string, suiteName?: string): void {
    emit(EVENTS.SET_STATUS, { status, suite: suiteName });
  }
}

export = PublicReportingAPI;
