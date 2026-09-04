export interface StartLaunchResponse {
  id: string;
  number?: number;
  [key: string]: unknown;
}

export interface FinishLaunchResponse {
  id?: string;
  number?: number;
  link?: string;
  [key: string]: unknown;
}

export interface StartTestItemResponse {
  id: string;
  [key: string]: unknown;
}

export interface FinishTestItemResponse {
  message?: string;
  [key: string]: unknown;
}

/** Response of updating a launch. */
export interface UpdateLaunchResponse {
  message?: string;
  [key: string]: unknown;
}

export interface LogResponse {
  id?: string;
  [key: string]: unknown;
}

export interface MergeLaunchesResponse {
  id?: string;
  uuid?: string;
  link?: string;
  [key: string]: unknown;
}

export interface LaunchSearchResponse {
  content: Array<{ id: string | number }>;
  [key: string]: unknown;
}

export interface ServerInfoResponse {
  extensions?: {
    result?: Record<string, string>;
  };
  [key: string]: unknown;
}

export interface LaunchResource {
  owner?: string;
  description?: string;
  locked?: boolean;
  id: number;
  uuid: string;
  name: string;
  number: number;
  startTime: string;
  endTime?: string;
  lastModified?: string;
  status: string;
  statistics?: {
    executions?: Record<string, number>;
    defects?: Record<string, unknown>;
  };
  attributes?: Array<{ key?: string; value: string }>;
  mode?: 'DEFAULT' | 'DEBUG';
  analysing?: string[];
  approximateDuration?: number;
  hasRetries?: boolean;
  rerun?: boolean;
  metadata?: Record<string, unknown>;
  retentionPolicy?: 'IMPORTANT' | 'REGULAR';
  [key: string]: unknown;
}

/** A page of launches. */
export interface PageLaunchResource {
  content: LaunchResource[];
  page: {
    number?: number;
    size?: number;
    totalElements?: number;
    totalPages?: number;
    hasNext?: boolean;
  };
  [key: string]: unknown;
}
