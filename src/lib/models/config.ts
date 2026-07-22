import type { AxiosProxyConfig, AxiosRequestConfig } from 'axios';
import type { IAxiosRetryConfig } from 'axios-retry';
import type { AgentOptions } from 'https';

import { Attribute } from './common';
import { LAUNCH_MODES } from '../constants/launchModes';
import { OutputHandler } from '../constants/outputs';

/**
 * OAuth 2.0 configuration for the password grant flow.
 */
export interface OAuthConfig {
  tokenEndpoint: string;
  username: string;
  password: string;
  clientId: string;
  clientSecret?: string;
  scope?: string;
}

/**
 * Detailed proxy configuration object.
 */
export interface ProxyConfig {
  protocol?: string;
  host: string;
  port: number;
  auth?: {
    username: string;
    password: string;
  };
  debug?: boolean;
}

/**
 * REST client configuration. Extends axios request config with the extra options
 * the client understands (`agent`, `retry`, `proxy`, `noProxy`).
 */
export interface RestClientConfig extends Omit<AxiosRequestConfig, 'proxy'> {
  agent?: AgentOptions;
  retry?: number | IAxiosRetryConfig;
  proxy?: false | string | ProxyConfig | AxiosProxyConfig;
  noProxy?: string;
  debug?: boolean;
}

export type LaunchUuidPrintOutput = 'STDOUT' | 'STDERR' | 'ENVIRONMENT' | 'FILE';

/**
 * Configuration options accepted by the `RPClient` constructor.
 */
export interface ReportPortalConfig {
  apiKey?: string;
  /**
   * @deprecated Use `apiKey` instead.
   */
  token?: string;
  endpoint: string;
  project: string;
  launch?: string;
  headers?: Record<string, string>;
  debug?: boolean;
  isLaunchMergeRequired?: boolean;
  launchUuidPrint?: boolean;
  launchUuidPrintOutput?: LaunchUuidPrintOutput;
  restClientConfig?: RestClientConfig;
  skippedIsNotIssue?: boolean;
  oauth?: OAuthConfig;
  attributes?: Attribute[];
  mode?: LAUNCH_MODES;
  description?: string;
}

/**
 * The normalized config produced by `getClientConfig` and stored on the client instance.
 */
export interface NormalizedClientConfig {
  apiKey: string | null;
  oauth: OAuthConfig | null;
  project: string;
  endpoint: string;
  launch?: string;
  debug?: boolean;
  isLaunchMergeRequired: boolean;
  headers?: Record<string, string>;
  restClientConfig?: RestClientConfig;
  attributes?: Attribute[];
  mode?: LAUNCH_MODES;
  description?: string;
  launchUuidPrint?: boolean;
  launchUuidPrintOutput: OutputHandler;
  skippedIsNotIssue: boolean;
}
