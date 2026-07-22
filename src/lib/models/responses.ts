export interface StartLaunchResponse {
  id: string;
  number?: number;
  [key: string]: unknown;
}

export interface FinishLaunchResponse {
  id?: string;
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
