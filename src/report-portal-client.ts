import { randomUUID } from 'crypto';
import { URLSearchParams } from 'url';
import * as helpers from './helpers';
import RestClient from './rest';
import { getClientConfig } from './commons/config';
import Statistics from './statistics/statistics';
import { EVENT_NAME } from './statistics/constants';
import { STATUSES } from './constants/statuses';
import type { AgentParams, Attachment, ClientResponse } from './models/common';
import type { NormalizedClientConfig, ReportPortalConfig } from './models/config';
import type {
  FinishLaunchOptions,
  FinishTestItemOptions,
  FinishTestItemRQ,
  LogOptions,
  MergeLaunchesOptions,
  StartLaunchOptions,
  StartTestItemOptions,
  StartTestItemRQ,
  UpdateLaunchOptions,
} from './models/requests';
import type {
  FinishLaunchResponse,
  FinishTestItemResponse,
  LaunchSearchResponse,
  MergeLaunchesResponse,
  PageLaunchResource,
  ServerInfoResponse,
  StartLaunchResponse,
  StartTestItemResponse,
  UpdateLaunchResponse,
} from './models/responses';

const MULTIPART_BOUNDARY = Math.floor(Math.random() * 10000000000).toString();

// Executor for a launch or item promise.
type PromiseExecutor<T = unknown> = (
  resolve: (value: T) => void,
  reject: (reason?: Error) => void,
) => void;

interface ItemObj<T = unknown> {
  promiseStart: Promise<T>;
  realId: string;
  children: string[];
  finishSend: boolean;
  promiseFinish: Promise<T>;
  resolveFinish: (value: T) => void;
  rejectFinish: (reason?: Error) => void;
}

type RequestPromiseFunc = (itemUuid: string, launchUuid: string) => Promise<unknown>;

class RPClient {
  private config: NormalizedClientConfig;

  private debug?: boolean;

  private isLaunchMergeRequired: boolean;

  private apiKey: string | null;

  // deprecated
  private token: string | null;

  private map: Record<string, ItemObj>;

  private baseURL: string;

  private headers: Record<string, string>;

  public helpers: typeof helpers;

  private restClient: RestClient;

  private statistics: Statistics;

  private launchUuid: string;

  private itemRetriesChainMap: Map<string, Promise<unknown>>;

  private itemRetriesChainKeyMapByTempId: Map<string, string>;

  /**
   * Create a client for RP.
   */
  constructor(options: ReportPortalConfig, agentParams?: AgentParams) {
    this.config = getClientConfig(options);
    this.debug = this.config.debug;
    this.isLaunchMergeRequired = this.config.isLaunchMergeRequired;
    this.apiKey = this.config.apiKey;
    // deprecated
    this.token = this.apiKey;

    this.map = {};
    this.baseURL = [this.config.endpoint, this.config.project].join('/');

    const headers: Record<string, string> = {
      'User-Agent': 'NodeJS',
      'Content-Type': 'application/json; charset=UTF-8',
      ...(this.config.headers || {}),
    };

    // Only set API key header if OAuth is not configured
    // OAuth interceptor will handle Authorization header when configured
    if (!this.config.oauth && this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    this.headers = headers;
    this.helpers = helpers;
    this.restClient = new RestClient({
      baseURL: this.baseURL,
      headers: this.headers,
      restClientConfig: this.config.restClientConfig,
      oauthConfig: this.config.oauth,
      debug: this.debug,
    });
    this.statistics = new Statistics(EVENT_NAME, agentParams);
    this.launchUuid = '';
    this.itemRetriesChainMap = new Map();
    this.itemRetriesChainKeyMapByTempId = new Map();
  }

  logDebug(msg: unknown, dataMsg: unknown = ''): void {
    if (this.debug) {
      console.log(msg, dataMsg);
    }
  }

  calculateItemRetriesChainMapKey(
    launchId: string,
    parentId: string | undefined,
    name: string,
    itemId = '',
  ): string {
    return `${launchId}__${parentId}__${name}__${itemId}`;
  }

  cleanItemRetriesChain(tempIds: string[]): void {
    tempIds.forEach((id) => {
      const key = this.itemRetriesChainKeyMapByTempId.get(id);

      if (key) {
        this.itemRetriesChainMap.delete(key);
      }

      this.itemRetriesChainKeyMapByTempId.delete(id);
    });
  }

  getUniqId(): string {
    return randomUUID();
  }

  getRejectAnswer<T = unknown>(tempId: string, error: Error): ClientResponse<T> {
    return {
      tempId,
      promise: Promise.reject<T>(error),
    };
  }

  getNewItemObj<T = unknown>(startPromiseFunc: PromiseExecutor<T>): ItemObj<T> {
    let resolveFinish!: (value: T) => void;
    let rejectFinish!: (reason?: Error) => void;
    const obj: ItemObj<T> = {
      promiseStart: new Promise<T>(startPromiseFunc),
      realId: '',
      children: [],
      finishSend: false,
      promiseFinish: new Promise<T>((resolve, reject) => {
        resolveFinish = resolve;
        rejectFinish = reject;
      }),
      resolveFinish,
      rejectFinish,
    };
    return obj;
  }

  cleanMap(ids: string[]): void {
    ids.forEach((id) => {
      delete this.map[id];
    });
  }

  checkConnect(): Promise<PageLaunchResource> {
    const url = [this.config.endpoint.replace('/v2', '/v1'), this.config.project, 'launch']
      .join('/')
      .concat('?page.page=1&page.size=1');
    return this.restClient.request<PageLaunchResource>('GET', url, {});
  }

  getServerInfoUrl(): string {
    return this.config.endpoint.replace('/v1', '/info').replace('/v2', '/info');
  }

  async fetchServerInfo(): Promise<ServerInfoResponse> {
    const url = this.getServerInfoUrl();
    return this.restClient.request<ServerInfoResponse>('GET', url, {});
  }

  async triggerStatisticsEvent(): Promise<void> {
    if (process.env.REPORTPORTAL_CLIENT_JS_NO_ANALYTICS) {
      return;
    }
    try {
      const serverInfo = await this.fetchServerInfo();
      const instanceID = serverInfo?.extensions?.result?.['server.details.instance'];
      if (instanceID) {
        this.statistics.setInstanceID(instanceID);
      }
    } catch (e) {
      this.statistics.setInstanceID('not_set');
    }
    await this.statistics.trackEvent();
  }

  /**
   * Start launch and report it.
   */
  startLaunch(
    launchDataRQ: StartLaunchOptions,
  ): ClientResponse<StartLaunchResponse | StartLaunchOptions> {
    const tempId = this.getUniqId();
    // Result of starting or reusing a launch.
    let launchObj: ItemObj<StartLaunchResponse | StartLaunchOptions>;

    if (launchDataRQ.id) {
      this.logDebug(`Use existing launch with tempId ${tempId}`, launchDataRQ);
      launchObj = this.getNewItemObj<StartLaunchResponse | StartLaunchOptions>((resolve) =>
        resolve(launchDataRQ),
      );
      this.map[tempId] = launchObj as ItemObj;
      this.map[tempId].realId = launchDataRQ.id;
      this.launchUuid = launchDataRQ.id;
    } else {
      const systemAttr = helpers.getSystemAttributes();
      if (this.config.skippedIsNotIssue === true) {
        const skippedIsNotIssueAttribute = {
          key: 'skippedIssue',
          value: 'false',
          system: true,
        };
        systemAttr.push(skippedIsNotIssueAttribute);
      }
      const attributes = Array.isArray(launchDataRQ.attributes)
        ? launchDataRQ.attributes.concat(systemAttr)
        : systemAttr;
      const launchData = {
        name: this.config.launch || 'Test launch name',
        startTime: this.helpers.now(),
        ...launchDataRQ,
        attributes,
      };

      launchObj = this.getNewItemObj<StartLaunchResponse | StartLaunchOptions>(
        (resolve, reject) => {
          const url = 'launch';
          this.logDebug(`Start launch with tempId ${tempId}`, launchData);
          this.restClient.create<StartLaunchResponse>(url, launchData).then(
            (response) => {
              this.map[tempId].realId = response.id;
              this.launchUuid = response.id;
              if (this.config.launchUuidPrint) {
                this.config.launchUuidPrintOutput(this.launchUuid);
              }

              if (this.isLaunchMergeRequired) {
                helpers.saveLaunchIdToFile(response.id);
              }

              this.logDebug(`Success start launch with tempId ${tempId}`, response);
              resolve(response);
            },
            (error) => {
              this.logDebug(`Error start launch with tempId ${tempId}`, error);
              console.dir(error);
              reject(error);
            },
          );
        },
      );
      this.map[tempId] = launchObj as ItemObj;
    }
    this.triggerStatisticsEvent().catch(console.error);
    return {
      tempId,
      promise: launchObj.promiseStart,
    };
  }

  /**
   * Finish launch.
   */
  finishLaunch(
    launchTempId: string,
    finishExecutionRQ: FinishLaunchOptions = {},
  ): ClientResponse<FinishLaunchResponse> {
    const launchObj = this.map[launchTempId] as ItemObj<FinishLaunchResponse> | undefined;
    if (!launchObj) {
      return this.getRejectAnswer(
        launchTempId,
        new Error(`Launch with tempId "${launchTempId}" not found`),
      );
    }

    const finishExecutionData = { endTime: this.helpers.now(), ...finishExecutionRQ };

    launchObj.finishSend = true;
    Promise.all(launchObj.children.map((itemId) => this.map[itemId].promiseFinish)).then(
      () => {
        launchObj.promiseStart.then(
          () => {
            this.logDebug(`Finish launch with tempId ${launchTempId}`, finishExecutionData);
            const url = ['launch', launchObj.realId, 'finish'].join('/');
            this.restClient.update<FinishLaunchResponse>(url, finishExecutionData).then(
              (response) => {
                this.logDebug(`Success finish launch with tempId ${launchTempId}`, response);
                console.log(`\nReportPortal Launch Link: ${response.link}`);
                launchObj.resolveFinish(response);
              },
              (error) => {
                this.logDebug(`Error finish launch with tempId ${launchTempId}`, error);
                console.dir(error);
                launchObj.rejectFinish(error);
              },
            );
          },
          (error) => {
            console.dir(error);
            launchObj.rejectFinish(error);
          },
        );
      },
      (error) => {
        console.dir(error);
        launchObj.rejectFinish(error);
      },
    );

    return {
      tempId: launchTempId,
      promise: launchObj.promiseFinish,
    };
  }

  /*
   * This method is used to create data object for merge request to ReportPortal.
   */
  getMergeLaunchesRequest(
    launchIds: Array<string | number>,
    mergeOptions: MergeLaunchesOptions = {},
  ) {
    return {
      launches: launchIds,
      mergeType: 'BASIC',
      description: this.config.description || 'Merged launch',
      mode: this.config.mode || 'DEFAULT',
      name: this.config.launch || 'Test launch name',
      attributes: this.config.attributes,
      endTime: this.helpers.now(),
      extendSuitesDescription: true,
      ...mergeOptions,
    };
  }

  /**
   * This method is used for merge launches in ReportPortal.
   * Please, keep in mind that this method work only in case the option isLaunchMergeRequired is true.
   */
  mergeLaunches(mergeOptions: MergeLaunchesOptions = {}): Promise<void> | undefined {
    if (this.isLaunchMergeRequired) {
      const launchUUIds = helpers.readLaunchesFromFile();
      const params = new URLSearchParams({
        'filter.in.uuid': launchUUIds,
        'page.size': launchUUIds.length,
      } as unknown as Record<string, string>);
      const launchSearchUrl =
        this.config.mode === 'DEBUG'
          ? `launch/mode?${params.toString()}`
          : `launch?${params.toString()}`;
      this.logDebug(`Find launches with UUIDs to merge: ${launchUUIds}`);
      return this.restClient
        .retrieveSyncAPI<LaunchSearchResponse>(launchSearchUrl)
        .then(
          (response) => {
            const launchIds = response.content.map((launch) => launch.id);
            this.logDebug(`Found launches: ${launchIds}`, response.content);
            return launchIds;
          },
          (error): Array<string | number> => {
            this.logDebug(`Error during launches search with UUIDs: ${launchUUIds}`, error);
            console.dir(error);
            return [];
          },
        )
        .then((launchIds) => {
          const request = this.getMergeLaunchesRequest(launchIds, mergeOptions);
          this.logDebug(`Merge launches with ids: ${launchIds}`, request);
          const mergeURL = 'launch/merge';
          return this.restClient.create<MergeLaunchesResponse>(mergeURL, request);
        })
        .then((response) => {
          this.logDebug(`Launches with UUIDs: ${launchUUIds} were successfully merged!`);
          if (this.config.launchUuidPrint && response.uuid) {
            this.config.launchUuidPrintOutput(response.uuid);
          }
        })
        .catch((error) => {
          this.logDebug(`Error merging launches with UUIDs: ${launchUUIds}`, error);
          console.dir(error);
        });
    }
    this.logDebug(
      'Option isLaunchMergeRequired is false, merge process cannot be done as no launch UUIDs where saved.',
    );
    return undefined;
  }

  /*
   * This method is used for frameworks as Jasmine. There is problem when
   * it doesn't wait for promise resolve and stop the process.
   */
  getPromiseFinishAllItems(launchTempId: string): Promise<unknown[]> {
    const launchObj = this.map[launchTempId];
    return Promise.all(launchObj.children.map((itemId) => this.map[itemId].promiseFinish));
  }

  /**
   * Update launch.
   */
  updateLaunch(
    launchTempId: string,
    launchData: UpdateLaunchOptions,
  ): ClientResponse<UpdateLaunchResponse> {
    const launchObj = this.map[launchTempId];
    if (!launchObj) {
      return this.getRejectAnswer(
        launchTempId,
        new Error(`Launch with tempId "${launchTempId}" not found`),
      );
    }
    let resolvePromise!: (value: UpdateLaunchResponse) => void;
    let rejectPromise!: (reason?: Error) => void;
    const promise = new Promise<UpdateLaunchResponse>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });

    launchObj.promiseFinish.then(
      () => {
        const url = ['launch', launchObj.realId, 'update'].join('/');
        this.logDebug(`Update launch with tempId ${launchTempId}`, launchData);
        this.restClient.update<UpdateLaunchResponse>(url, launchData).then(
          (response) => {
            this.logDebug(`Launch with tempId ${launchTempId} were successfully updated`, response);
            resolvePromise(response);
          },
          (error) => {
            this.logDebug(`Error when updating launch with tempId ${launchTempId}`, error);
            console.dir(error);
            rejectPromise(error);
          },
        );
      },
      (error) => {
        rejectPromise(error);
      },
    );
    return {
      tempId: launchTempId,
      promise,
    };
  }

  /**
   * If there is no parentItemId starts Suite, else starts test or item.
   */
  startTestItem(
    testItemDataRQ: StartTestItemOptions,
    launchTempId: string,
    parentTempId?: string,
  ): ClientResponse<StartTestItemResponse> {
    let parentMapId = launchTempId;
    const launchObj = this.map[launchTempId];
    if (!launchObj) {
      return this.getRejectAnswer(
        launchTempId,
        new Error(`Launch with tempId "${launchTempId}" not found`),
      );
    }
    // TODO: Allow items reporting to finished launch
    if (launchObj.finishSend) {
      const err = new Error(
        `Launch with tempId "${launchTempId}" is already finished, you can not add an item to it`,
      );
      return this.getRejectAnswer(launchTempId, err);
    }

    const testCaseId =
      testItemDataRQ.testCaseId ||
      helpers.generateTestCaseId(testItemDataRQ.codeRef, testItemDataRQ.parameters);
    const testItemData: StartTestItemRQ = {
      startTime: this.helpers.now(),
      ...testItemDataRQ,
      ...(testCaseId && { testCaseId }),
    };

    let parentPromise = launchObj.promiseStart;
    if (parentTempId) {
      parentMapId = parentTempId;
      const parentObj = this.map[parentTempId];
      if (!parentObj) {
        return this.getRejectAnswer(
          launchTempId,
          new Error(`Item with tempId "${parentTempId}" not found`),
        );
      }
      parentPromise = parentObj.promiseStart;
    }

    const itemKey = this.calculateItemRetriesChainMapKey(
      launchTempId,
      parentTempId,
      testItemDataRQ.name,
      testItemDataRQ.uniqueId,
    );
    const executionItemPromise = testItemDataRQ.retry && this.itemRetriesChainMap.get(itemKey);

    const tempId = this.getUniqId();
    const itemObj = this.getNewItemObj<StartTestItemResponse>((resolve, reject) => {
      (executionItemPromise || parentPromise).then(
        (prevResponse) => {
          const realLaunchId = this.map[launchTempId].realId;
          let url = 'item/';
          if (parentTempId) {
            const realParentId = this.map[parentTempId].realId;
            url += `${realParentId}`;
          }
          const prevId = (prevResponse as StartTestItemResponse | undefined)?.id;
          if (executionItemPromise && prevId) {
            testItemData.retry_of = prevId;
          }
          testItemData.launchUuid = realLaunchId;
          this.logDebug(`Start test item with tempId ${tempId}`, testItemData);
          this.restClient.create<StartTestItemResponse>(url, testItemData).then(
            (response) => {
              this.logDebug(`Success start item with tempId ${tempId}`, response);
              this.map[tempId].realId = response.id;
              resolve(response);
            },
            (error) => {
              this.logDebug(`Error start item with tempId ${tempId}`, error);
              console.dir(error);
              reject(error);
            },
          );
        },
        (error) => {
          reject(error);
        },
      );
    });
    this.map[tempId] = itemObj as ItemObj;
    this.map[parentMapId].children.push(tempId);
    this.itemRetriesChainKeyMapByTempId.set(tempId, itemKey);
    this.itemRetriesChainMap.set(itemKey, itemObj.promiseStart);

    return {
      tempId,
      promise: itemObj.promiseStart,
    };
  }

  /**
   * Finish Suite or Step level.
   */
  finishTestItem(
    itemTempId: string,
    finishTestItemRQ: FinishTestItemOptions = {},
  ): ClientResponse<FinishTestItemResponse> {
    const itemObj = this.map[itemTempId] as ItemObj<FinishTestItemResponse> | undefined;
    if (!itemObj) {
      return this.getRejectAnswer(
        itemTempId,
        new Error(`Item with tempId "${itemTempId}" not found`),
      );
    }

    const finishTestItemData: FinishTestItemRQ = {
      endTime: this.helpers.now(),
      ...(itemObj.children.length ? {} : { status: STATUSES.PASSED }),
      ...finishTestItemRQ,
    };

    if (finishTestItemData.status === STATUSES.SKIPPED && this.config.skippedIsNotIssue === true) {
      finishTestItemData.issue = { issueType: 'NOT_ISSUE' };
    }

    itemObj.finishSend = true;
    this.logDebug(`Finish all children for test item with tempId ${itemTempId}`);
    Promise.allSettled(
      itemObj.children.map((itemId) => this.map[itemId] && this.map[itemId].promiseFinish),
    )
      .then((results) => {
        if (this.debug) {
          results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
              this.logDebug(
                `Successfully finish child with tempId ${itemObj.children[index]}
                 of test item with tempId ${itemTempId}`,
              );
            } else {
              this.logDebug(
                `Failed to finish child with tempId ${itemObj.children[index]}
                of test item with tempId ${itemTempId}`,
              );
            }
          });
        }
        this.cleanItemRetriesChain(itemObj.children);
        this.cleanMap(itemObj.children);

        this.logDebug(`Finish test item with tempId ${itemTempId}`, finishTestItemRQ);
        this.finishTestItemPromiseStart(
          itemObj,
          itemTempId,
          Object.assign(finishTestItemData, { launchUuid: this.launchUuid }),
        );
      })
      .catch(() => {
        this.logDebug(`Error finish children of test item with tempId ${itemTempId}`);
      });

    return {
      tempId: itemTempId,
      promise: itemObj.promiseFinish,
    };
  }

  saveLog(itemObj: ItemObj, requestPromiseFunc: RequestPromiseFunc): ClientResponse {
    const tempId = this.getUniqId();
    this.map[tempId] = this.getNewItemObj((resolve, reject) => {
      itemObj.promiseStart.then(
        () => {
          this.logDebug(`Save log with tempId ${tempId}`, itemObj);
          requestPromiseFunc(itemObj.realId, this.launchUuid).then(
            (response) => {
              this.logDebug(`Successfully save log with tempId ${tempId}`, response);
              resolve(response);
            },
            (error) => {
              this.logDebug(`Error save log with tempId ${tempId}`, error);
              console.dir(error);
              reject(error);
            },
          );
        },
        (error) => {
          reject(error);
        },
      );
    });
    itemObj.children.push(tempId);

    const logObj = this.map[tempId];
    logObj.finishSend = true;
    logObj.promiseStart.then(
      (response) => logObj.resolveFinish(response),
      (error) => logObj.rejectFinish(error),
    );

    return {
      tempId,
      promise: this.map[tempId].promiseFinish,
    };
  }

  sendLog(itemTempId: string, saveLogRQ: LogOptions, fileObj?: Attachment): ClientResponse {
    const saveLogData = {
      time: this.helpers.now(),
      message: '',
      level: '',
      ...saveLogRQ,
    };

    if (fileObj) {
      return this.sendLogWithFile(itemTempId, saveLogData, fileObj);
    }
    return this.sendLogWithoutFile(itemTempId, saveLogData);
  }

  /**
   * Send log of test results.
   */
  sendLogWithoutFile(itemTempId: string, saveLogRQ: LogOptions): ClientResponse {
    const itemObj = this.map[itemTempId];
    if (!itemObj) {
      return this.getRejectAnswer(
        itemTempId,
        new Error(`Item with tempId "${itemTempId}" not found`),
      );
    }

    const requestPromise: RequestPromiseFunc = (itemUuid, launchUuid) => {
      const url = 'log';
      const isItemUuid = itemUuid !== launchUuid;
      return this.restClient.create(
        url,
        Object.assign(saveLogRQ, { launchUuid }, isItemUuid && { itemUuid }),
      );
    };
    return this.saveLog(itemObj, requestPromise);
  }

  /**
   * Send log of test results with file.
   */
  sendLogWithFile(itemTempId: string, saveLogRQ: LogOptions, fileObj: Attachment): ClientResponse {
    const itemObj = this.map[itemTempId];
    if (!itemObj) {
      return this.getRejectAnswer(
        itemTempId,
        new Error(`Item with tempId "${itemTempId}" not found`),
      );
    }

    const requestPromise: RequestPromiseFunc = (itemUuid, launchUuid) => {
      const isItemUuid = itemUuid !== launchUuid;

      return this.getRequestLogWithFile(
        Object.assign(saveLogRQ, { launchUuid }, isItemUuid && { itemUuid }),
        fileObj,
      );
    };

    return this.saveLog(itemObj, requestPromise);
  }

  getRequestLogWithFile(saveLogRQ: LogOptions, fileObj: Attachment): Promise<unknown> {
    const url = 'log';
    // eslint-disable-next-line no-param-reassign
    saveLogRQ.file = { name: fileObj.name } as Attachment;
    this.logDebug(`Save log with file: ${fileObj.name}`, saveLogRQ);
    return this.restClient
      .create(url, this.buildMultiPartStream([saveLogRQ], fileObj, MULTIPART_BOUNDARY), {
        headers: {
          'Content-Type': `multipart/form-data; boundary=${MULTIPART_BOUNDARY}`,
        },
      })
      .then((response) => {
        this.logDebug(`Success save log with file: ${fileObj.name}`, response);
        return response;
      })
      .catch((error) => {
        this.logDebug(`Error save log with file: ${fileObj.name}`, error);
        console.dir(error);
      });
  }

  buildMultiPartStream(jsonPart: unknown[], filePart: Attachment, boundary: string): Buffer {
    const eol = '\r\n';
    const bx = `--${boundary}`;
    const buffers = [
      // eslint-disable-next-line function-paren-newline
      Buffer.from(
        // eslint-disable-next-line prefer-template
        bx +
          eol +
          'Content-Disposition: form-data; name="json_request_part"' +
          eol +
          'Content-Type: application/json' +
          eol +
          eol +
          eol +
          JSON.stringify(jsonPart) +
          eol,
      ),
      // eslint-disable-next-line function-paren-newline
      Buffer.from(
        // eslint-disable-next-line prefer-template
        bx +
          eol +
          'Content-Disposition: form-data; name="file"; filename="' +
          filePart.name +
          '"' +
          eol +
          'Content-Type: ' +
          filePart.type +
          eol +
          eol,
      ),
      Buffer.from(filePart.content as string, 'base64'),
      Buffer.from(`${eol + bx}--${eol}`),
    ];
    return Buffer.concat(buffers);
  }

  finishTestItemPromiseStart<T = unknown>(
    itemObj: ItemObj<T>,
    itemTempId: string,
    finishTestItemData: FinishTestItemRQ,
  ): void {
    itemObj.promiseStart.then(
      () => {
        const url = ['item', itemObj.realId].join('/');
        this.logDebug(`Finish test item with tempId ${itemTempId}`, itemObj);
        this.restClient
          .update<T>(url, Object.assign(finishTestItemData, { launchUuid: this.launchUuid }))
          .then(
            (response) => {
              this.logDebug(`Success finish item with tempId ${itemTempId}`, response);
              itemObj.resolveFinish(response);
            },
            (error) => {
              this.logDebug(`Error finish test item with tempId ${itemTempId}`, error);
              console.dir(error);
              itemObj.rejectFinish(error);
            },
          );
      },
      (error) => {
        itemObj.rejectFinish(error);
      },
    );
  }
}

export = RPClient;
