/* eslint-disable quotes,no-console,class-methods-use-this */
import UniqId from 'uniqid';
import { URLSearchParams } from 'url';
import * as helpers from './helpers';
import RestClient from './rest';
import { getClientConfig } from './commons/config';
import { Statistics } from '../statistics/statistics';
import { EVENT_NAME } from '../statistics/constants';
import { RP_STATUSES } from './constants/statuses';
import {
  AgentParams,
  Attribute,
  ClientConfig,
  FileObj,
  FinishExecutionRQ,
  FinishTestItemRQ,
  ItemObj,
  LaunchDataRQ, MapType,
  MergeOptions,
  SaveLogRQ,
  TestItemDataRQ,
  TempIdPromise,
} from './types';

const MULTIPART_BOUNDARY = Math.floor(Math.random() * 10000000000).toString();

class RPClient {
  protected config: ClientConfig;
  protected debug: boolean;
  protected isLaunchMergeRequired: boolean;
  protected apiKey: string;
  private token: string;
  private map: MapType;
  private baseURL: string;
  private headers: Record<string, string>;
  private helpers: typeof helpers;
  private restClient: RestClient;
  private statistics: Statistics;
  private launchUuid: string;
  private itemRetriesChainMap: Map<string, Promise<any>>;
  private itemRetriesChainKeyMapByTempId: Map<string, string>;

  constructor(options: Partial<ClientConfig>, agentParams?: AgentParams) {
    this.config = getClientConfig(options);
    this.debug = Boolean(this.config.debug);
    this.isLaunchMergeRequired = Boolean(this.config.isLaunchMergeRequired);
    this.apiKey = this.config.apiKey;
    // deprecated
    this.token = this.apiKey;

    this.map = {};
    this.baseURL = [this.config.endpoint, this.config.project].join('/');
    this.headers = {
      'User-Agent': 'NodeJS',
      'Content-Type': 'application/json; charset=UTF-8',
      Authorization: `Bearer ${this.apiKey}`,
      ...(this.config.headers || {}),
    };
    this.helpers = helpers;
    this.restClient = new RestClient({
      baseURL: this.baseURL,
      headers: this.headers,
      restClientConfig: this.config.restClientConfig,
    });
    this.statistics = new Statistics(EVENT_NAME, agentParams);
    this.launchUuid = '';
    this.itemRetriesChainMap = new Map();
    this.itemRetriesChainKeyMapByTempId = new Map();
  }

  /**
   *
   * @Private
   */
  private logDebug(msg: string, dataMsg: any = ''): void {
    if (this.debug) {
      // eslint-disable-next-line no-console
      console.log(msg, dataMsg);
    }
  }

  calculateItemRetriesChainMapKey(
    launchId: string,
    parentId: string | undefined,
    name: string,
    itemId: string = '',
  ): string {
    return `${launchId}__${parentId}__${name}__${itemId}`;
  }

  /**
   *
   * @Private
   */
  private cleanItemRetriesChain(tempIds: string[]): void {
    tempIds.forEach((id) => {
      const key = this.itemRetriesChainKeyMapByTempId.get(id);

      if (key) {
        this.itemRetriesChainMap.delete(key);
      }

      this.itemRetriesChainKeyMapByTempId.delete(id);
    });
  }

  getUniqId(): string {
    return UniqId();
  }

  getRejectAnswer(tempId: string, error: Error): TempIdPromise {
    return {
      tempId,
      promise: Promise.reject(error),
    };
  }

  getNewItemObj(
    startPromiseFunc: (resolve: (value?: any) => void, reject: (reason?: any) => void) => void,
  ): ItemObj {
    let resolveFinish: (value?: any) => void;
    let rejectFinish: (reason?: any) => void;
    const obj: Partial<ItemObj> = {
      promiseStart: new Promise(startPromiseFunc),
      realId: '',
      children: [],
      finishSend: false,
      promiseFinish: new Promise((resolve, reject) => {
        resolveFinish = resolve;
        rejectFinish = reject;
      }),
    };
    obj.resolveFinish = resolveFinish!;
    obj.rejectFinish = rejectFinish!;
    return obj as ItemObj;
  }

  /**
   *
   * @Private
   */
  private cleanMap(ids: string[]): void {
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

  async triggerStatisticsEvent(): Promise<void> {
    if (process.env.REPORTPORTAL_CLIENT_JS_NO_ANALYTICS === 'true') {
      return;
    }
    await this.statistics.trackEvent();
  }

  /**
   * Start launch and report it.
   */
  startLaunch(launchDataRQ: LaunchDataRQ): { tempId: string; promise: Promise<any> } {
    const tempId = this.getUniqId();

    if (launchDataRQ.id) {
      this.map[tempId] = this.getNewItemObj((resolve) => resolve(launchDataRQ));
      this.map[tempId].realId = launchDataRQ.id;
      this.launchUuid = launchDataRQ.id;
    } else {
      const systemAttr = helpers.getSystemAttribute();
      const attributes = Array.isArray(launchDataRQ.attributes)
        ? launchDataRQ.attributes.concat(systemAttr)
        : systemAttr;
      const launchData = {
        name: this.config.launch || 'Test launch name',
        startTime: this.helpers.now(),
        ...launchDataRQ,
        attributes,
      };

      this.map[tempId] = this.getNewItemObj((resolve, reject) => {
        const url = 'launch';
        this.logDebug(`Start launch with tempId ${tempId}`, launchDataRQ);
        this.restClient.create(url, launchData).then(
          (response: any) => {
            this.map[tempId].realId = response.id;
            this.launchUuid = response.id;
            if (
              this.config.launchUuidPrint &&
              typeof this.config.launchUuidPrintOutput === 'function'
            ) {
              this.config.launchUuidPrintOutput(this.launchUuid);
            }

            if (this.isLaunchMergeRequired) {
              helpers.saveLaunchIdToFile(response.id);
            }

            this.logDebug(`Success start launch with tempId ${tempId}`, response);
            resolve(response);
          },
          (error: any) => {
            this.logDebug(`Error start launch with tempId ${tempId}`, error);
            // eslint-disable-next-line no-console
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
  finishLaunch(
    launchTempId: string,
    finishExecutionRQ: FinishExecutionRQ,
  ): { tempId: string; promise: Promise<any> } {
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
            this.restClient.update(url, finishExecutionData).then(
              (response: any) => {
                this.logDebug(`Success finish launch with tempId ${launchTempId}`, response);
                // eslint-disable-next-line no-console
                console.log(`\nReportPortal Launch Link: ${response.link}`);
                launchObj.resolveFinish(response);
              },
              (error: any) => {
                this.logDebug(`Error finish launch with tempId ${launchTempId}`, error);
                // eslint-disable-next-line no-console
                console.dir(error);
                launchObj.rejectFinish(error);
              },
            );
          },
          (error: any) => {
            // eslint-disable-next-line no-console
            console.dir(error);
            launchObj.rejectFinish(error);
          },
        );
      },
      (error: any) => {
        // eslint-disable-next-line no-console
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
  getMergeLaunchesRequest(launchIds: string[], mergeOptions: MergeOptions = {}): any {
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
   */
  mergeLaunches(mergeOptions: MergeOptions = {}): Promise<void> | void {
    if (this.isLaunchMergeRequired) {
      const launchUUIds = helpers.readLaunchesFromFile();
      const params = new URLSearchParams({
        'filter.in.uuid': launchUUIds,
        'page.size': launchUUIds.length.toString(),
      });
      const launchSearchUrl =
        this.config.mode === 'DEBUG'
          ? `launch/mode?${params.toString()}`
          : `launch?${params.toString()}`;
      this.logDebug(`Find launches with UUIDs to merge: ${launchUUIds}`);
      return this.restClient
        .retrieveSyncAPI(launchSearchUrl)
        .then(
          (response: any) => {
            const launchIds = response.content.map((launch: any) => launch.id);
            this.logDebug(`Found launches: ${launchIds}`, response.content);
            return launchIds;
          },
          (error: any) => {
            this.logDebug(`Error during launches search with UUIDs: ${launchUUIds}`, error);
            // eslint-disable-next-line no-console
            console.dir(error);
          },
        )
        .then((launchIds: string[]) => {
          const request = this.getMergeLaunchesRequest(launchIds, mergeOptions);
          this.logDebug(`Merge launches with ids: ${launchIds}`, request);
          const mergeURL = 'launch/merge';
          return this.restClient.create(mergeURL, request);
        })
        .then((response: any) => {
          this.logDebug(`Launches with UUIDs: ${launchUUIds} were successfully merged!`);
          if (
            this.config.launchUuidPrint &&
            this.config.launchUuidPrintOutput &&
            typeof (this.config.launchUuidPrintOutput === 'function')
          ) {
            const uuid = response.uuid || 'STDOUT';
            // @ts-ignore
            this.config.launchUuidPrintOutput(uuid);
          }
        })
        .catch((error: any) => {
          this.logDebug(`Error merging launches with UUIDs: ${launchUUIds}`, error);
          // eslint-disable-next-line no-console
          console.dir(error);
        });
    }
    this.logDebug(
      'Option isLaunchMergeRequired is false, merge process cannot be done as no launch UUIDs where saved.',
    );
  }

  /*
   * This method is used for frameworks as Jasmine. There is problem when
   * it doesn't wait for promise resolve and stop the process. So it better to call
   * this method at the spec's function as @afterAll() and manually resolve this promise.
   */
  getPromiseFinishAllItems(launchTempId: string) {
    const launchObj = this.map[launchTempId];
    return Promise.all(launchObj.children.map((itemId) => this.map[itemId].promiseFinish));
  }

  /**
   * Update launch.
   */
  updateLaunch(launchTempId: string, launchData: any): { tempId: string; promise: Promise<any> } {
    const launchObj = this.map[launchTempId];
    if (!launchObj) {
      return this.getRejectAnswer(
        launchTempId,
        new Error(`Launch with tempId "${launchTempId}" not found`),
      );
    }
    let resolvePromise: (value?: any) => void;
    let rejectPromise: (reason?: any) => void;
    const promise = new Promise((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });

    launchObj.promiseFinish.then(
      () => {
        const url = ['launch', launchObj.realId, 'update'].join('/');
        this.logDebug(`Update launch with tempId ${launchTempId}`, launchData);
        this.restClient.update(url, launchData).then(
          (response: any) => {
            this.logDebug(`Launch with tempId ${launchTempId} were successfully updated`, response);
            resolvePromise(response);
          },
          (error: any) => {
            this.logDebug(`Error when updating launch with tempId ${launchTempId}`, error);
            // eslint-disable-next-line no-console
            console.dir(error);
            rejectPromise(error);
          },
        );
      },
      (error: any) => {
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
    testItemDataRQ: TestItemDataRQ,
    launchTempId: string,
    parentTempId?: string,
  ): TempIdPromise<any> {
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
    const testItemData = {
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
        () => {
          const realLaunchId = this.map[launchTempId].realId;
          let url = 'item/';
          if (parentTempId) {
            const realParentId = this.map[parentTempId].realId;
            url += `${realParentId}`;
          }
          (testItemData as any).launchUuid = realLaunchId;
          this.logDebug(`Start test item with tempId ${tempId}`, testItemData);
          this.restClient.create(url, testItemData).then(
            (response: any) => {
              this.logDebug(`Success start item with tempId ${tempId}`, response);
              this.map[tempId].realId = response.id;
              resolve(response);
            },
            (error: any) => {
              this.logDebug(`Error start item with tempId ${tempId}`, error);
              // eslint-disable-next-line no-console
              console.dir(error);
              reject(error);
            },
          );
        },
        (error: any) => {
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
  finishTestItem(
    itemTempId: string,
    finishTestItemRQ: FinishTestItemRQ,
  ): TempIdPromise<any> {
    const itemObj = this.map[itemTempId];
    if (!itemObj) {
      return this.getRejectAnswer(
        itemTempId,
        new Error(`Item with tempId "${itemTempId}" not found`),
      );
    }

    const finishTestItemData = {
      endTime: this.helpers.now(),
      ...(itemObj.children.length ? {} : { status: RP_STATUSES.PASSED }),
      ...finishTestItemRQ,
    };

    if (finishTestItemData.status === RP_STATUSES.SKIPPED && this.config.skippedIssue === false) {
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
            if ((result as PromiseFulfilledResult<any>).status === 'fulfilled') {
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

  saveLog(
    itemObj: ItemObj,
    requestPromiseFunc: (itemUuid: string, launchUuid: string) => Promise<any>,
  ): { tempId: string; promise: Promise<any> } {
    const tempId = this.getUniqId();
    this.map[tempId] = this.getNewItemObj((resolve, reject) => {
      itemObj.promiseStart.then(
        () => {
          this.logDebug(`Save log with tempId ${tempId}`, itemObj);
          requestPromiseFunc(itemObj.realId, this.launchUuid).then(
            (response: any) => {
              this.logDebug(`Successfully save log with tempId ${tempId}`, response);
              resolve(response);
            },
            (error: any) => {
              this.logDebug(`Error save log with tempId ${tempId}`, error);
              // eslint-disable-next-line no-console
              console.dir(error);
              reject(error);
            },
          );
        },
        (error: any) => {
          reject(error);
        },
      );
    });
    itemObj.children.push(tempId);

    const logObj = this.map[tempId];
    logObj.finishSend = true;
    logObj.promiseStart.then(
      (response: any) => logObj.resolveFinish(response),
      (error: any) => logObj.rejectFinish(error),
    );

    return {
      tempId,
      promise: this.map[tempId].promiseFinish,
    };
  }

  sendLog(
    itemTempId: string,
    saveLogRQ: SaveLogRQ,
    fileObj?: FileObj,
  ): { tempId: string; promise: Promise<any> } {
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
  sendLogWithoutFile(
    itemTempId: string,
    saveLogRQ: SaveLogRQ,
  ): { tempId: string; promise: Promise<any> } {
    const itemObj = this.map[itemTempId];
    if (!itemObj) {
      return this.getRejectAnswer(
        itemTempId,
        new Error(`Item with tempId "${itemTempId}" not found`),
      );
    }

    const requestPromise = (itemUuid: string, launchUuid: string) => {
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
  sendLogWithFile(
    itemTempId: string,
    saveLogRQ: SaveLogRQ,
    fileObj: FileObj,
  ): { tempId: string; promise: Promise<any> } {
    const itemObj = this.map[itemTempId];
    if (!itemObj) {
      return this.getRejectAnswer(
        itemTempId,
        new Error(`Item with tempId "${itemTempId}" not found`),
      );
    }

    const requestPromise = (itemUuid: string, launchUuid: string) => {
      const isItemUuid = itemUuid !== launchUuid;

      return this.getRequestLogWithFile(
        Object.assign(saveLogRQ, { launchUuid }, isItemUuid && { itemUuid }),
        fileObj,
      );
    };

    return this.saveLog(itemObj, requestPromise);
  }

  getRequestLogWithFile(saveLogRQ: SaveLogRQ, fileObj: FileObj): Promise<any> {
    const url = 'log';
    // eslint-disable-next-line no-param-reassign
    (saveLogRQ as any).file = { name: fileObj.name };
    this.logDebug(`Save log with file: ${fileObj.name}`, saveLogRQ);
    return this.restClient
      .create(url, this.buildMultiPartStream([saveLogRQ], fileObj, MULTIPART_BOUNDARY), {
        headers: {
          'Content-Type': `multipart/form-data; boundary=${MULTIPART_BOUNDARY}`,
        },
      })
      .then((response: any) => {
        this.logDebug(`Success save log with file: ${fileObj.name}`, response);
        return response;
      })
      .catch((error: any) => {
        this.logDebug(`Error save log with file: ${fileObj.name}`, error);
        // eslint-disable-next-line no-console
        console.dir(error);
      });
  }

  /**
   *
   * @Private
   */
  buildMultiPartStream(jsonPart: any, filePart: FileObj, boundary: string): Buffer {
    const eol = '\r\n';
    const bx = `--${boundary}`;
    const buffers = [
      Buffer.from(
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
      Buffer.from(
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
      Buffer.from(filePart.content, 'base64'),
      Buffer.from(`${eol + bx}--${eol}`),
    ];
    return Buffer.concat(buffers);
  }

  finishTestItemPromiseStart(itemObj: ItemObj, itemTempId: string, finishTestItemData: any): void {
    itemObj.promiseStart.then(
      () => {
        const url = ['item', itemObj.realId].join('/');
        this.logDebug(`Finish test item with tempId ${itemTempId}`, itemObj);
        this.restClient
          .update(url, Object.assign(finishTestItemData, { launchUuid: this.launchUuid }))
          .then(
            (response: any) => {
              this.logDebug(`Success finish item with tempId ${itemTempId}`, response);
              itemObj.resolveFinish(response);
            },
            (error: any) => {
              this.logDebug(`Error finish test item with tempId ${itemTempId}`, error);
              // eslint-disable-next-line no-console
              console.dir(error);
              itemObj.rejectFinish(error);
            },
          );
      },
      (error: any) => {
        itemObj.rejectFinish(error);
      },
    );
  }
}

export default RPClient;
