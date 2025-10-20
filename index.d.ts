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
    restClientConfig?: Record<string, unknown>;
    token?: string;
    /**
     * OAuth 2.0 configuration object. When provided, OAuth authentication will be used instead of API key.
     */
    oauth?: OAuthConfig;
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
    startTime?: string;
    description?: string;
    attributes?: Array<{ key: string; value?: string } | string>;
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
    startTime?: string;
    attributes?: Array<{ key: string; value?: string } | string>;
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
    time?: string;
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
    endTime?: string;
    issue?: {
      issueType: string;
      comment?: string;
      externalSystemIssues?: Array<any>
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
    endTime?: string;
    status?: string;
  }

  /**
   * Main Report Portal client for interacting with the API.
   */
  export default class ReportPortalClient {
    /**
     * Initializes a new Report Portal client.
     */
    constructor(config: ReportPortalConfig);

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
    finishLaunch(launchId: string, options?: FinishLaunchOptions): Promise<any>;

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
    updateLaunch(options: LaunchOptions): { tempId: string; promise: Promise<any> };

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
    startTestItem(options: StartTestItemOptions, launchId: string, parentId?: string): {
      tempId: string;
      promise: Promise<any>
    };

    /**
     * Finishes a test item.
     * @example
     * ```typescript
     * rpClient.finishTestItem(itemObj.tempId, {
     *     status: 'failed'
     * });
     * ```
     */
    finishTestItem(itemId: string, options: FinishTestItemOptions): Promise<any>;

    /**
     * Sends a log entry to a test item.
     * @example
     * ```typescript
     * await rpClient.sendLog(stepObj.tempId, {
     *     level: 'INFO',
     *     message: 'User clicks login button',
     *     time: rpClient.helpers.now()
     * });
     * ```
     */
    sendLog(itemId: string, options: LogOptions): Promise<any>;

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
      now(): string
    }
  }
}
