/* eslint-disable no-console, class-methods-use-this */
import { randomUUID } from 'crypto';
import { URLSearchParams } from 'url';
import * as helpers from './helpers';
import type { SystemAttribute } from './helpers';
import RestClient from './rest';
import { getClientConfig } from './commons/config';
import Statistics from '../statistics/statistics';
import { EVENT_NAME } from '../statistics/constants';
import { STATUSES } from './constants/statuses';
import type { AgentParams, Attribute, Attachment, ClientResponse } from './models/common';
import type { NormalizedClientConfig, ReportPortalConfig } from './models/config';
import type {
  FinishLaunchOptions,
  FinishTestItemOptions,
  LogOptions,
  MergeLaunchesOptions,
  StartLaunchOptions,
  StartTestItemOptions,
  UpdateLaunchOptions,
} from './models/requests';
import type {
  FinishLaunchResponse,
  LaunchSearchResponse,
  MergeLaunchesResponse,
  ServerInfoResponse,
  StartLaunchResponse,
  StartTestItemResponse,
} from './models/responses';

const MULTIPART_BOUNDARY = Math.floor(Math.random() * 10000000000).toString();

type PromiseExecutor = (
  resolve: (value?: unknown) => void,
  reject: (reason?: unknown) => void,
) => void;

interface ItemObj {
  promiseStart: Promise<unknown>;
  realId: string;
  children: string[];
  finishSend: boolean;
  promiseFinish: Promise<unknown>;
  resolveFinish: (value?: unknown) => void;
  rejectFinish: (reason?: unknown) => void;
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

  private itemRetriesChainMap: Map<string, Promise<any>>;

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

  getRejectAnswer(tempId: string, error: Error): ClientResponse {
    return {
      tempId,
      promise: Promise.reject(error),
    };
  }

  getNewItemObj(startPromiseFunc: PromiseExecutor): ItemObj {
    let resolveFinish!: (value?: any) => void;
    let rejectFinish!: (reason?: any) => void;
    const obj: ItemObj = {
      promiseStart: new Promise(startPromiseFunc),
      realId: '',
      children: [],
      finishSend: false,
      promiseFinish: new Promise((resolve, reject) => {
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

  checkConnect(): Promise<any> {
    const url = [this.config.endpoint.replace('/v2', '/v1'), this.config.project, 'launch']
      .join('/')
      .concat('?page.page=1&page.size=1');
    return this.restClient.request('GET', url, {});
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
  startLaunch(launchDataRQ: StartLaunchOptions): ClientResponse {
    const tempId = this.getUniqId();

    if (launchDataRQ.id) {
      this.logDebug(`Use existing launch with tempId ${tempId}`, launchDataRQ);
      this.map[tempId] = this.getNewItemObj((resolve) => resolve(launchDataRQ));
      this.map[tempId].realId = launchDataRQ.id;
      this.launchUuid = launchDataRQ.id;
    } else {
      const systemAttr = helpers.getSystemAttribute();
      if (this.config.skippedIsNotIssue === true) {
        const skippedIsNotIssueAttribute = {
          key: 'skippedIssue',
          value: 'false',
          system: true,
        };
        systemAttr.push(skippedIsNotIssueAttribute);
      }
      const attributes = Array.isArray(launchDataRQ.attributes)
        ? (launchDataRQ.attributes as any[]).concat(systemAttr)
        : systemAttr;
      const launchData = {
        name: this.config.launch || 'Test launch name',
        startTime: this.helpers.now(),
        ...launchDataRQ,
        attributes,
      };

      this.map[tempId] = this.getNewItemObj((resolve, reject) => {
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
      });
    }
    this.triggerStatisticsEvent().catch(console.error);
    return {
      tempId,
      promise: this.map[tempId].promiseStart,
    };
  }

  /**
   * Finish launch.
   */
  finishLaunch(launchTempId: string, finishExecutionRQ: FinishLaunchOptions = {}): ClientResponse {
    const launchObj = this.map[launchTempId];
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
            const launchIds = response.content.map((launch: any) => launch.id);
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
  getPromiseFinishAllItems(launchTempId: string): Promise<any[]> {
    const launchObj = this.map[launchTempId];
    return Promise.all(launchObj.children.map((itemId) => this.map[itemId].promiseFinish));
  }

  /**
   * Update launch.
   */
  updateLaunch(launchTempId: string, launchData: UpdateLaunchOptions): ClientResponse {
    const launchObj = this.map[launchTempId];
    if (!launchObj) {
      return this.getRejectAnswer(
        launchTempId,
        new Error(`Launch with tempId "${launchTempId}" not found`),
      );
    }
    let resolvePromise!: (value?: any) => void;
    let rejectPromise!: (reason?: any) => void;
    const promise = new Promise((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });

    launchObj.promiseFinish.then(
      () => {
        const url = ['launch', launchObj.realId, 'update'].join('/');
        this.logDebug(`Update launch with tempId ${launchTempId}`, launchData);
        this.restClient.update(url, launchData).then(
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
  ): ClientResponse {
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
    const testItemData: Record<string, any> = {
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
    this.map[tempId] = this.getNewItemObj((resolve, reject) => {
      (executionItemPromise || parentPromise).then(
        (prevResponse) => {
          const realLaunchId = this.map[launchTempId].realId;
          let url = 'item/';
          if (parentTempId) {
            const realParentId = this.map[parentTempId].realId;
            url += `${realParentId}`;
          }
          if (executionItemPromise && prevResponse?.id) {
            testItemData.retry_of = prevResponse.id;
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
    this.map[parentMapId].children.push(tempId);
    this.itemRetriesChainKeyMapByTempId.set(tempId, itemKey);
    this.itemRetriesChainMap.set(itemKey, this.map[tempId].promiseStart);

    return {
      tempId,
      promise: this.map[tempId].promiseStart,
    };
  }

  /**
   * Finish Suite or Step level.
   */
  finishTestItem(itemTempId: string, finishTestItemRQ: FinishTestItemOptions = {}): ClientResponse {
    const itemObj = this.map[itemTempId];
    if (!itemObj) {
      return this.getRejectAnswer(
        itemTempId,
        new Error(`Item with tempId "${itemTempId}" not found`),
      );
    }

    const finishTestItemData: Record<string, any> = {
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

  getRequestLogWithFile(saveLogRQ: LogOptions, fileObj: Attachment): Promise<any> {
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

  finishTestItemPromiseStart(
    itemObj: ItemObj,
    itemTempId: string,
    finishTestItemData: Record<string, any>,
  ): void {
    itemObj.promiseStart.then(
      () => {
        const url = ['item', itemObj.realId].join('/');
        this.logDebug(`Finish test item with tempId ${itemTempId}`, itemObj);
        this.restClient
          .update(url, Object.assign(finishTestItemData, { launchUuid: this.launchUuid }))
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
