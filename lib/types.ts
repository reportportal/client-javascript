export interface Attribute {
  value: string;
  key?: string;
  system?: boolean;
}

export interface ClientConfig {
  apiKey: string;
  endpoint: string;
  launch: string;
  project: string;

  headers?: Record<string, string>;
  debug?: boolean;
  isLaunchMergeRequired?: boolean;
  launchUuidPrint?: boolean;
  //?
  launchUuidPrintOutput?: string | ((param: string) => void);
  restClientConfig?: Record<string, unknown>;
  token?: string;
  //
  attributes?: Attribute[];
  mode?: string;
  description?: string;
}

export type AgentParams = {
  name: string;
  version: string;
};

export type LaunchDataRQ = {
  id?: string;
  description?: string;
  mode?: string;
  name?: string;
  startTime?: number;
  attributes?: Attribute[];
};

export type FinishExecutionRQ = {
  endTime?: number;
  status?: string;
};

export type MergeOptions = {
  extendSuitesDescription?: boolean;
  description?: string;
  mergeType?: 'BASIC' | 'DEEP';
  name?: string;
};

export type TestItemDataRQ = {
  description?: string;
  name: string;
  startTime?: number;
  attributes?: Attribute[];
  type: string;
  testCaseId?: string;
  codeRef: string;
  parameters?: any[];
  uniqueId?: string;
  retry?: boolean;
};

export type FinishTestItemRQ = {
  endTime?: number;
  issue?: {
    comment?: string;
    externalSystemIssues?: Array<{
      submitDate?: number;
      submitter?: string;
      systemId?: string;
      ticketId?: string;
      url?: string;
    }>;
    issueType?: string;
  };
  status?: string;
};

export type FileObj = {
  name: string;
  type: string;
  content: string;
};

export type SaveLogRQ = {
  level?: string;
  message?: string;
  time?: number;
};

export type ItemObj = {
  promiseStart: Promise<any>;
  realId: string;
  children: string[];
  finishSend: boolean;
  promiseFinish: Promise<any>;
  resolveFinish: (value?: any) => void;
  rejectFinish: (reason?: any) => void;
};

export type MapType = { [tempId: string]: ItemObj };
