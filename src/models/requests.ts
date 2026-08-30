import { Attachment, Attribute, Issue } from './common';
import { LAUNCH_MODES } from '../constants/launchModes';
import { LOG_LEVELS } from '../constants/logLevels';
import { STATUSES } from '../constants/statuses';
import { TEST_ITEM_TYPES } from '../constants/testItemTypes';

export interface StartLaunchOptions {
  name?: string;
  startTime?: string | number;
  description?: string;
  attributes?: Attribute[];
  mode?: LAUNCH_MODES;
  rerun?: boolean;
  rerunOf?: string;
  /**
   * When set, the client attaches to an existing launch with this id instead of creating a new one.
   */
  id?: string;
}

export interface FinishLaunchOptions {
  endTime?: string | number;
  status?: STATUSES;
}

export interface UpdateLaunchOptions {
  description?: string;
  mode?: LAUNCH_MODES;
  attributes?: Attribute[];
}

export interface TestItemParameter {
  key?: string;
  value: string;
}

export interface StartTestItemOptions {
  name: string;
  type: TEST_ITEM_TYPES;
  description?: string;
  startTime?: string | number;
  attributes?: Attribute[];
  hasStats?: boolean;
  codeRef?: string;
  testCaseId?: string;
  parameters?: TestItemParameter[];
  retry?: boolean;
  retry_of?: string;
  uniqueId?: string;
}

/**
 * The actual start test item payload sent to the server.
 * The client fills in the values omitted by the caller (startTime, launchUuid, retry_of).
 */
export interface StartTestItemRQ extends StartTestItemOptions {
  startTime: string | number;
  /**
   * Set by the client right before the request, once the launch id is known.
   */
  launchUuid?: string;
}

export interface FinishTestItemOptions {
  endTime?: string | number;
  status?: STATUSES;
  issue?: Issue;
  attributes?: Attribute[];
  description?: string;
  testCaseId?: string;
}

export interface FinishTestItemRQ extends FinishTestItemOptions {
  endTime: string | number;
  /**
   * Set by the client right before the request, once the launch id is known.
   */
  launchUuid?: string;
}

export interface LogOptions {
  level?: LOG_LEVELS;
  message?: string;
  time?: string | number;
  file?: Attachment;
}

export enum MERGE_TYPES {
  BASIC = 'BASIC',
  DEEP = 'DEEP',
}

export interface MergeLaunchesOptions {
  extendSuitesDescription?: boolean;
  description?: string;
  mergeType?: MERGE_TYPES;
  name?: string;
}
