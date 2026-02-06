declare module '@reportportal/client-javascript' {
  /**
   * OAuth 2.0 configuration for password grant flow.
   */
  export interface OAuthConfig {
    /**
     * OAuth 2.0 token endpoint URL for password grant flow.
     */
    tokenEndpoint: string;
    /**
     * Username for OAuth 2.0 password grant.
     */
    username: string;
    /**
     * Password for OAuth 2.0 password grant.
     */
    password: string;
    /**
     * OAuth 2.0 client ID.
     */
    clientId: string;
    /**
     * OAuth 2.0 client secret (optional, depending on your OAuth server configuration).
     */
    clientSecret?: string;
    /**
     * OAuth 2.0 scope (optional, space-separated list of scopes).
     */
    scope?: string;
  }

  /**
   * Proxy configuration object.
   */
  export interface ProxyConfig {
    /**
     * Protocol for the proxy (http or https).
     */
    protocol?: string;
    /**
     * Proxy host.
     */
    host: string;
    /**
     * Proxy port.
     */
    port: number;
    /**
     * Optional authentication for the proxy.
     */
    auth?: {
      username: string;
      password: string;
    };
    /**
     * Optional debug logs for the proxy.
     */
    debug?: boolean;
  }

  /**
   * REST client configuration options.
   */
  export interface RestClientConfig {
    /**
     * Request timeout in milliseconds.
     */
    timeout?: number;
    /**
     * Proxy configuration. Can be:
     * - false: Disable proxy
     * - string: Proxy URL (e.g., 'http://proxy.example.com:8080')
     * - ProxyConfig object: Detailed proxy configuration
     */
    proxy?: false | string | ProxyConfig;
    /**
     * Comma-separated list of domains to bypass proxy.
     * Example: 'localhost,127.0.0.1,.example.com'
     * This takes precedence over NO_PROXY environment variable.
     */
    noProxy?: string;
    /**
     * Custom HTTP agent options.
     */
    agent?: any;
    /**
     * Retry configuration.
     */
    retry?: number | any;
    /**
     * Enable debug logging.
     */
    debug?: boolean;
    /**
     * Any other axios configuration options.
     */
    [key: string]: any;
  }

  /**
   * Configuration options for initializing the Report Portal client.
   *
   * @example API Key Authentication
   * ```typescript
   * const rp = new ReportPortalClient({
   *   endpoint: 'https://your.reportportal.server/api/v1',
   *   project: 'your_project_name',
   *   apiKey: 'your_api_key',
   * });
   * ```
   *
   * @example OAuth 2.0 Authentication
   * ```typescript
   * const rp = new ReportPortalClient({
   *   endpoint: 'https://your.reportportal.server/api/v1',
   *   project: 'your_project_name',
   *   oauth: {
   *     tokenEndpoint: 'https://your-oauth-server.com/oauth/token',
   *     username: 'your-username',
   *     password: 'your-password',
   *     clientId: 'your-client-id',
   *     clientSecret: 'your-client-secret', // optional
   *     scope: 'reportportal', // optional
   *   }
   * });
   * ```
   *
   * @example With Proxy Configuration
   * ```typescript
   * const rp = new ReportPortalClient({
   *   endpoint: 'https://your.reportportal.server/api/v1',
   *   project: 'your_project_name',
   *   apiKey: 'your_api_key',
   *   restClientConfig: {
   *     proxy: {
   *       protocol: 'https',
   *       host: '127.0.0.1',
   *       port: 8080,
   *     },
   *     noProxy: 'localhost,.local.domain',
   *   }
   * });
   * ```
   */
  export interface ReportPortalConfig {
    apiKey?: string;
    endpoint: string;
    launch: string;
    project: string;
    headers?: Record<string, string>;
    debug?: boolean;
    isLaunchMergeRequired?: boolean;
    launchUuidPrint?: boolean;
    launchUuidPrintOutput?: string;
    restClientConfig?: RestClientConfig;
    token?: string;
    skippedIsNotIssue?: boolean;
    /**
     * OAuth 2.0 configuration object. When provided, OAuth authentication will be used instead of API key.
     */
    oauth?: OAuthConfig;
    /**
     * Enable batch logging to optimize network requests by grouping multiple logs into a single request.
     * @default false
     */
    batchLogs?: boolean;
    /**
     * Maximum number of logs in a single batch.
     * @default 20
     */
    batchLogsSize?: number;
    /**
     * Maximum batch payload size in bytes.
     * @default 67108864 (64MB)
     */
    batchPayloadLimit?: number;
  }

  /**
   * Options to start a new launch.
   *
   * @example
   * ```typescript
   * const launch = rp.startLaunch({
   *   name: 'My Test Launch',
   *   startTime: rp.helpers.now(),
   * });
   * ```
   */
  export interface LaunchOptions {
    name?: string;
    startTime?: string | number;
    description?: string;
    attributes?: Array<{ key?: string; value?: string } | string>;
    mode?: string;
    id?: string;
  }

  /**
   * Options to start a new test item (e.g., test case or suite).
   *
   * @example
   * ```typescript
   * const testItem = rp.startTestItem({
   *   name: 'My Test Case',
   *   type: 'TEST',
   *   startTime: rp.helpers.now(),
   * });
   * ```
   */
  export interface StartTestItemOptions {
    name: string;
    type: string;
    description?: string;
    startTime?: string | number;
    attributes?: Array<{ key?: string; value?: string } | string>;
    hasStats?: boolean;
  }

  /**
   * Options to send logs to Report Portal.
   *
   * @example
   * ```typescript
   * await rp.sendLog(testItem.tempId, {
   *   level: 'INFO',
   *   message: 'Step executed successfully',
   *   time: rp.helpers.now(),
   * });
   * ```
   */
  export interface LogOptions {
    level?: string;
    message?: string;
    time?: string | number;
    file?: {
      name: string;
      content: string;
      type: string;
    };
  }

  /**
   * Options to finish a test item.
   *
   * @example
   * ```typescript
   * await rp.finishTestItem(testItem.tempId, {
   *   status: 'PASSED',
   *   endTime: rp.helpers.now(),
   * });
   * ```
   */
  export interface FinishTestItemOptions {
    status?: string;
    endTime?: string | number;
    issue?: {
      issueType: string;
      comment?: string;
      externalSystemIssues?: Array<any>;
    };
  }

  /**
   * Options to finish a launch.
   *
   * @example
   * ```typescript
   * await rp.finishLaunch(launch.tempId, {
   *   endTime: rp.helpers.now(),
   * });
   * ```
   */
  export interface FinishLaunchOptions {
    endTime?: string | number;
    status?: string;
  }

  /**
   * Main Report Portal client for interacting with the API.
   */
  export default class ReportPortalClient {
    /**
     * Initializes a new Report Portal client.
     */
    constructor(config: ReportPortalConfig, agentInfo?: { name?: string; version?: string });

    /**
     * Starts a new launch.
     * @example
     * ```typescript
     * const launchObj = rpClient.startLaunch({
     *     name: 'Client test',
     *     startTime: rpClient.helpers.now(),
     *     description: 'description of the launch',
     *     attributes: [
     *         {
     *             'key': 'yourKey',
     *             'value': 'yourValue'
     *         },
     *         {
     *             'value': 'yourValue'
     *         }
     *     ],
     *     //this param used only when you need client to send data into the existing launch
     *     id: 'id'
     * });
     * await launchObj.promise;
     * ```
     */
    startLaunch(options: LaunchOptions): { tempId: string; promise: Promise<any> };

    /**
     * Finishes an active launch.
     * @example
     * ```typescript
     * const launchFinishObj = rpClient.finishLaunch(launchObj.tempId, {
     *     endTime: rpClient.helpers.now()
     * });
     * await launchFinishObj.promise;
     * ```
     */
    finishLaunch(
      launchId: string,
      options?: FinishLaunchOptions,
    ): { tempId: string; promise: Promise<any> };

    /**
     * Update the launch data
     * @example
     * ```typescript
     * const updateLunch = rpClient.updateLaunch(
     *     launchObj.tempId,
     *     {
     *         description: 'new launch description',
     *         attributes: [
     *             {
     *                 key: 'yourKey',
     *                 value: 'yourValue'
     *             },
     *             {
     *                 value: 'yourValue'
     *             }
     *         ],
     *         mode: 'DEBUG'
     *     }
     * );
     * await updateLaunch.promise;
     * ```
     */
    updateLaunch(
      launchId: string,
      options: LaunchOptions,
    ): { tempId: string; promise: Promise<any> };

    /**
     * Starts a new test item under a launch or parent item.
     * @example
     * ```typescript
     * const suiteObj = rpClient.startTestItem({
     *     description: makeid(),
     *     name: makeid(),
     *     startTime: rpClient.helpers.now(),
     *     type: 'SUITE'
     * }, launchObj.tempId);
     * const stepObj = rpClient.startTestItem({
     *     description: makeid(),
     *     name: makeid(),
     *     startTime: rpClient.helpers.now(),
     *     attributes: [
     *         {
     *             key: 'yourKey',
     *             value: 'yourValue'
     *         },
     *         {
     *             value: 'yourValue'
     *         }
     *     ],
     *     type: 'STEP'
     * }, launchObj.tempId, suiteObj.tempId);
     * ```
     */
    startTestItem(
      options: StartTestItemOptions,
      launchId: string,
      parentId?: string,
    ): {
      tempId: string;
      promise: Promise<any>;
    };

    /**
     * Finishes a test item.
     * @example
     * ```typescript
     * const finishObj = rpClient.finishTestItem(itemObj.tempId, {
     *     status: 'failed'
     * });
     * await finishObj.promise;
     * ```
     */
    finishTestItem(
      itemId: string,
      options: FinishTestItemOptions,
    ): { tempId: string; promise: Promise<any> };

    /**
     * Sends a log entry to a test item.
     * @example
     * ```typescript
     * const logObj = rpClient.sendLog(stepObj.tempId, {
     *     level: 'INFO',
     *     message: 'User clicks login button',
     *     time: rpClient.helpers.now()
     * });
     * await logObj.promise;
     * ```
     */
    sendLog(
      itemId: string,
      options: LogOptions,
      file?: { name: string; content: string | Buffer; type: string },
    ): { tempId: string; promise: Promise<any> };

    /**
     * Flushes all pending logs from the batch queue.
     * This method is only relevant when batch logging is enabled (batchLogs: true).
     * It sends any accumulated logs immediately, without waiting for the batch to fill.
     *
     * @returns Promise that resolves when all pending logs are sent
     *
     * @example
     * ```typescript
     * // Enable batch logging in config
     * const rpClient = new ReportPortalClient({
     *   endpoint: 'https://your.reportportal.server/api/v1',
     *   project: 'your_project_name',
     *   apiKey: 'your_api_key',
     *   batchLogs: true,
     *   batchLogsSize: 20
     * });
     *
     * // Send multiple logs (they will be batched)
     * await rpClient.sendLog(testItem.tempId, {
     *   level: 'INFO',
     *   message: 'First log',
     *   time: rpClient.helpers.now()
     * });
     *
     * await rpClient.sendLog(testItem.tempId, {
     *   level: 'INFO',
     *   message: 'Second log',
     *   time: rpClient.helpers.now()
     * });
     *
     * // Manually flush remaining logs before finishing
     * await rpClient.flushLogs();
     * ```
     */
    flushLogs(): Promise<void>;

    /**
     * Waits for all test items to be finished.
     * @example
     * ```typescript
     * await agent.getPromiseFinishAllItems(agent.tempLaunchId);
     * ```
     */
    getPromiseFinishAllItems(launchId: string): Promise<any>;

    /**
     * Check if connection is established
     * @example
     * ```typescript
     * await agent.checkConnect();
     * ```
     */
    checkConnect(): Promise<any>;

    helpers: {
      /**
       * Generate ISO timestamp
       * @example
       * ```typescript
       * await rpClient.sendLog(stepObj.tempId, {
       *     level: 'INFO',
       *     message: 'User clicks login button',
       *     time: rpClient.helpers.now()
       * });
       * ```
       */
      now(): string;
    };
  }
}
