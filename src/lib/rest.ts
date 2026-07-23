import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import axiosRetry, { IAxiosRetryConfig, isRetryableError } from 'axios-retry';
import http from 'http';
import https from 'https';
import * as logger from './logger';
import OAuthInterceptor from './oauth';
import { getProxyAgentForUrl } from './proxyHelper';
import type { OAuthConfig, RestClientConfig, RestClientOptions } from './models/config';

const DEFAULT_MAX_CONNECTION_TIME_MS = 30000;
const DEFAULT_RETRY_ATTEMPTS = 6;
const RETRY_BASE_DELAY_MS = 200;
const RETRY_MAX_DELAY_MS = 5000;

interface NetworkError {
  message?: string;
  code?: string;
  // A nested cause may be a full Error (e.g. a Node system error carrying `code`).
  cause?: { code?: string; message?: string };
}

const isTimeoutError = (error: NetworkError | null | undefined): boolean => {
  if (!error) return false;
  const message = error.message ? error.message.toLowerCase() : '';

  return (
    message.includes(`timeout`) ||
    error.code === 'ECONNABORTED' ||
    error.code === 'ETIMEDOUT' ||
    error?.cause?.code === 'ECONNABORTED' ||
    error?.cause?.code === 'ETIMEDOUT'
  );
};

const retryCondition = (error: AxiosError): boolean => {
  return isRetryableError(error) || isTimeoutError(error);
};

const DEFAULT_RETRY_CONFIG: IAxiosRetryConfig = {
  retryDelay: (retryCount = 1) => {
    const base = Math.min(
      RETRY_BASE_DELAY_MS * 2 ** Math.max(retryCount - 1, 0),
      RETRY_MAX_DELAY_MS,
    );
    const jitter = Math.random() * 0.4 * base; // +/-40%
    return base - jitter;
  },
  retries: DEFAULT_RETRY_ATTEMPTS,
  retryCondition,
  shouldResetTimeout: true,
};
const SKIPPED_REST_CONFIG_KEYS = ['agent', 'retry', 'proxy', 'noProxy'];

class RestClient {
  private baseURL: string;

  private headers?: Record<string, string>;

  private restClientConfig?: RestClientConfig;

  private oauthConfig?: OAuthConfig | null;

  private debug?: boolean;

  private axiosInstance: AxiosInstance;

  constructor(options: RestClientOptions) {
    this.baseURL = options.baseURL;
    this.headers = options.headers;
    this.restClientConfig = options.restClientConfig;
    this.oauthConfig = options.oauthConfig;
    this.debug = options.debug;

    this.axiosInstance = axios.create({
      timeout: DEFAULT_MAX_CONNECTION_TIME_MS,
      headers: this.headers,
      ...this.getRestConfig(),
    });

    // Create and attach OAuth interceptor if OAuth config is provided
    // Must be before retry to ensure token is fresh on each retry
    if (this.oauthConfig) {
      try {
        const oauthInterceptor = new OAuthInterceptor({
          ...this.oauthConfig,
          debug: this.debug,
          restClientConfig: this.restClientConfig,
        });
        oauthInterceptor.attach(this.axiosInstance);
      } catch (error: unknown) {
        // eslint-disable-next-line no-console
        console.error(
          '[RestClient] Failed to initialize OAuth interceptor:',
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    axiosRetry(this.axiosInstance, this.getRetryConfig());

    if (this.restClientConfig?.debug) {
      logger.addLogger(this.axiosInstance);
    }
  }

  buildPath(path: string): string {
    return [this.baseURL, path].join('/');
  }

  buildPathToSyncAPI(path: string): string {
    return [this.baseURL.replace('/v2', '/v1'), path].join('/');
  }

  request<T = unknown>(
    method: string,
    url: string,
    data: unknown,
    options: AxiosRequestConfig = {},
  ): Promise<T> {
    // Only apply proxy agents if custom agents are not explicitly provided
    // Priority: explicit httpsAgent/httpAgent/agent > proxy config > default
    const hasCustomAgents =
      this.restClientConfig &&
      ('httpsAgent' in this.restClientConfig ||
        'httpAgent' in this.restClientConfig ||
        'agent' in this.restClientConfig);
    const proxyAgents = hasCustomAgents ? {} : getProxyAgentForUrl(url, this.restClientConfig);
    const usingProxyAgent = Object.keys(proxyAgents).length > 0;

    return this.axiosInstance
      .request({
        method,
        url,
        data,
        ...options,
        ...proxyAgents,
        // Explicitly disable axios built-in proxy when using custom agents
        ...(usingProxyAgent && { proxy: false as const }),
        headers: {
          HOST: new URL(url).host,
          ...options.headers,
        },
      })
      .then((response) => response.data)
      .catch((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const responseData = axios.isAxiosError(error) ? error.response?.data : undefined;
        throw new Error(
          `${errorMessage}${
            responseData && typeof responseData === 'object'
              ? `: ${JSON.stringify(responseData)}`
              : ''
          }
URL: ${url}
method: ${method}`,
        );
      });
  }

  getRestConfig(): AxiosRequestConfig {
    if (!this.restClientConfig) return {};

    const { restClientConfig } = this;
    const config = Object.keys(restClientConfig).reduce<Record<string, unknown>>((acc, key) => {
      if (!SKIPPED_REST_CONFIG_KEYS.includes(key)) {
        acc[key] = (restClientConfig as Record<string, unknown>)[key];
      }
      return acc;
    }, {});

    if ('agent' in restClientConfig) {
      const { protocol } = new URL(this.baseURL);
      const isHttps = /https:?/;
      const isHttpsRequest = isHttps.test(protocol);
      config[isHttpsRequest ? 'httpsAgent' : 'httpAgent'] = isHttpsRequest
        ? new https.Agent(restClientConfig.agent)
        : new http.Agent(restClientConfig.agent);
    }

    return config;
  }

  getRetryConfig(): IAxiosRetryConfig {
    const retryOption = this.restClientConfig?.retry;
    const onRetry: IAxiosRetryConfig['onRetry'] = (retryCount, error, requestConfig) => {
      if (this.restClientConfig?.debug) {
        // eslint-disable-next-line no-console
        console.log(
          `[retry #${retryCount}] ${requestConfig.method?.toUpperCase()} ${requestConfig.url} -> ${
            error.code || error.message
          }`,
        );
      }
    };

    if (typeof retryOption === 'number') {
      return {
        onRetry,
        ...DEFAULT_RETRY_CONFIG,
        retries: retryOption,
      };
    }

    if (retryOption && typeof retryOption === 'object') {
      return {
        onRetry,
        ...DEFAULT_RETRY_CONFIG,
        ...retryOption,
      };
    }

    return { onRetry, ...DEFAULT_RETRY_CONFIG };
  }

  create<T = unknown>(path: string, data: unknown, options: AxiosRequestConfig = {}): Promise<T> {
    return this.request<T>('POST', this.buildPath(path), data, {
      ...options,
    });
  }

  retrieve<T = unknown>(path: string, options: AxiosRequestConfig = {}): Promise<T> {
    return this.request<T>(
      'GET',
      this.buildPath(path),
      {},
      {
        ...options,
      },
    );
  }

  update<T = unknown>(path: string, data: unknown, options: AxiosRequestConfig = {}): Promise<T> {
    return this.request<T>('PUT', this.buildPath(path), data, {
      ...options,
    });
  }

  delete<T = unknown>(path: string, data: unknown, options: AxiosRequestConfig = {}): Promise<T> {
    return this.request<T>('DELETE', this.buildPath(path), data, {
      ...options,
    });
  }

  retrieveSyncAPI<T = unknown>(path: string, options: AxiosRequestConfig = {}): Promise<T> {
    return this.request<T>(
      'GET',
      this.buildPathToSyncAPI(path),
      {},
      {
        ...options,
      },
    );
  }
}

export = RestClient;
