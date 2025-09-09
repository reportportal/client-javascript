import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import axiosRetry from 'axios-retry';
import * as http from 'http';
import * as https from 'https';
import { addLogger } from './logger';

const DEFAULT_MAX_CONNECTION_TIME_MS = 30000;

axiosRetry(axios, {
  retryDelay: () => 100,
  retries: 10,
  retryCondition: axiosRetry.isRetryableError,
});

export interface RestClientOptions {
  baseURL: string;
  headers?: Record<string, string>;
  restClientConfig?: {
    [key: string]: any;
    agent?: http.AgentOptions | https.AgentOptions;
    debug?: boolean;
  };
}

export type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export default class RestClient {
  private baseURL: string;

  private headers?: Record<string, string>;

  private restClientConfig?: { [key: string]: any };

  private axiosInstance: AxiosInstance;

  constructor(options: RestClientOptions) {
    this.baseURL = options.baseURL;
    this.headers = options.headers;
    this.restClientConfig = options.restClientConfig;

    this.axiosInstance = axios.create({
      timeout: DEFAULT_MAX_CONNECTION_TIME_MS,
      headers: this.headers,
      ...this.getRestConfig(),
    });

    if (this.restClientConfig?.debug) {
      addLogger(this.axiosInstance);
    }
  }

  private buildPath(path: string): string {
    return [this.baseURL, path].join('/');
  }

  private buildPathToSyncAPI(path: string): string {
    return [this.baseURL.replace('/v2', '/v1'), path].join('/');
  }

  request<T = any>(
    method: RequestMethod,
    url: string,
    data?: any,
    options: AxiosRequestConfig = {},
  ): Promise<T> {
    return this.axiosInstance
      .request({
        method,
        url,
        data,
        ...options,
        headers: {
          HOST: new URL(url).host,
          ...(options.headers || {}),
        },
      })
      .then((response: AxiosResponse<T>) => response.data)
      .catch((error: any) => {
        const errorMessage = error.message;
        const responseData = error.response && error.response.data;
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

  private getRestConfig(): Record<string, any> {
    if (!this.restClientConfig) return {};

    const config: Record<string, any> = Object.keys(this.restClientConfig).reduce(
      (acc: Record<string, any>, key: string) => {
        if (key !== 'agent') {
          acc[key] = this.restClientConfig![key];
        }
        return acc;
      },
      {},
    );

    if ('agent' in this.restClientConfig) {
      const { protocol } = new URL(this.baseURL);
      const isHttps = /https:?/;
      const isHttpsRequest = isHttps.test(protocol);
      config[isHttpsRequest ? 'httpsAgent' : 'httpAgent'] = isHttpsRequest
        ? new https.Agent(this.restClientConfig.agent)
        : new http.Agent(this.restClientConfig.agent);
    }

    return config;
  }

  create<T = any>(path: string, data?: any, options: AxiosRequestConfig = {}): Promise<T> {
    return this.request('POST', this.buildPath(path), data, {
      ...options,
    });
  }

  retrieve<T = any>(path: string, options: AxiosRequestConfig = {}): Promise<T> {
    return this.request(
      'GET',
      this.buildPath(path),
      {},
      {
        ...options,
      },
    );
  }

  update<T = any>(path: string, data?: any, options: AxiosRequestConfig = {}): Promise<T> {
    return this.request('PUT', this.buildPath(path), data, {
      ...options,
    });
  }

  delete<T = any>(path: string, data?: any, options: AxiosRequestConfig = {}): Promise<T> {
    return this.request('DELETE', this.buildPath(path), data, {
      ...options,
    });
  }

  retrieveSyncAPI<T = any>(path: string, options: AxiosRequestConfig = {}): Promise<T> {
    return this.request(
      'GET',
      this.buildPathToSyncAPI(path),
      {},
      {
        ...options,
      },
    );
  }
}
