import type { Attribute } from './common';
import type { LogOptions } from './requests';

export interface ReportingApiInterface {
  setDescription(text: string, suiteName?: string): void;
  addAttributes(attributes: Attribute[], suiteName?: string): void;
  addLog(log: LogOptions, suiteName?: string): void;
  addLaunchLog(log: LogOptions): void;
  setTestCaseId(testCaseId: string, suiteName?: string): void;
  setLaunchStatus(status: string): void;
  setStatus(status: string, suiteName?: string): void;
}
