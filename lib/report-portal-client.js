/* eslint-disable quotes,no-console,class-methods-use-this */
const UniqId = require('uniqid');
const { URLSearchParams } = require('url');
const helpers = require('./helpers');
const RestClient = require('./rest');
const { getClientConfig } = require('./commons/config');
const Statistics = require('../statistics/statistics');
const { EVENT_NAME } = require('../statistics/constants');
const { RP_STATUSES } = require('./constants/statuses');

const MULTIPART_BOUNDARY = Math.floor(Math.random() * 10000000000).toString();

class RPClient {
  /**
   * Create a client for RP.
   * @param {Object} options - config object.
   * options should look like this
   * {
   *      apiKey: "reportportalApiKey",
   *      endpoint: "http://localhost:8080/api/v1",
   *      launch: "YOUR LAUNCH NAME",
   *      project: "PROJECT NAME",
   * }
   *
   * @param {Object} agentParams - agent's info object.
   * agentParams should look like this
   * {
   *     name: "AGENT NAME",
   *     version: "AGENT VERSION",
   * }
   */
  constructor(options, agentParams) {
    this.config = getClientConfig(options);
    this.debug = this.config.debug;
    this.isLaunchMergeRequired = this.config.isLaunchMergeRequired;
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

  // eslint-disable-next-line valid-jsdoc
  /**
   *
   * @Private
   */
  logDebug(msg, dataMsg = '') {
    if (this.debug) {
      console.log(msg, dataMsg);
    }
  }

  calculateItemRetriesChainMapKey(launchId, parentId, name, itemId = '') {
    return `${launchId}__${parentId}__${name}__${itemId}`;
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   *
   * @Private
   */
  cleanItemRetriesChain(tempIds) {
    tempIds.forEach((id) => {
      const key = this.itemRetriesChainKeyMapByTempId.get(id);

      if (key) {
        this.itemRetriesChainMap.delete(key);
      }

      this.itemRetriesChainKeyMapByTempId.delete(id);
    });
  }

  getUniqId() {
    return UniqId();
  }

  getRejectAnswer(tempId, error) {
    return {
      tempId,
      promise: Promise.reject(error),
    };
  }

  getNewItemObj(startPromiseFunc) {
    let resolveFinish;
    let rejectFinish;
    const obj = {
      promiseStart: new Promise(startPromiseFunc),
      realId: '',
      children: [],
      finishSend: false,
      promiseFinish: new Promise((resolve, reject) => {
        resolveFinish = resolve;
        rejectFinish = reject;
      }),
    };
    obj.resolveFinish = resolveFinish;
    obj.rejectFinish = rejectFinish;
    return obj;
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   *
   * @Private
   */
  cleanMap(ids) {
    ids.forEach((id) => {
      delete this.map[id];
    });
  }

  checkConnect() {
    const url = [this.config.endpoint.replace('/v2', '/v1'), 'user'].join('/');
    return this.restClient.request('GET', url, {});
  }

  async triggerStatisticsEvent() {
    if (process.env.REPORTPORTAL_CLIENT_JS_NO_ANALYTICS) {
      return;
    }
    await this.statistics.trackEvent();
  }

  /**
     * Start launch and report it.
     * @param {Object} launchDataRQ - request object.
     * launchDataRQ should look like this
     * {
            "description": "string" (support markdown),
            "mode": "DEFAULT" or "DEBUG",
            "name": "string",
            "startTime": this.helper.now(),
            "attributes": [
                {
                    "key": "string",
                    "value": "string"
                },
                {
                    "value": "string"
                }
            ]
     * }
     * @Returns an object which contains a tempID and a promise
     *
     * As system attributes, this method sends the following data (these data are not for public use):
     * client name, version;
     * agent name, version (if given);
     * browser name, version (if given);
     * OS type, architecture;
     * RAMSize;
     * nodeJS version;
     *
     * This method works in two ways:
     * First - If launchDataRQ object doesn't contain ID field,
     * it would create a new Launch instance at the Report Portal with it ID.
     * Second - If launchDataRQ would contain ID field,
     * client would connect to the existing Launch which ID
     * has been sent , and would send all data to it.
     * Notice that Launch which ID has been sent must be 'IN PROGRESS' state at the Report Portal
     * or it would throw an error.
     * @Returns {Object} - an object which contains a tempID and a promise
     */
  startLaunch(launchDataRQ) {
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
   * @param {string} launchTempId - temp launch id (returned in the query "startLaunch").
   * @param {Object} finishExecutionRQ - finish launch info should include time and status.
   * finishExecutionRQ should look like this
   * {
   *      "endTime": this.helper.now(),
   *      "status": "passed" or one of ‘passed’, ‘failed’, ‘stopped’, ‘skipped’, ‘interrupted’, ‘cancelled’
   * }
   * @Returns {Object} - an object which contains a tempID and a promise
   */
  finishLaunch(launchTempId, finishExecutionRQ) {
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
   *
   * @Returns {Object} - an object which contains a data for merge launches in ReportPortal.
   */
  getMergeLaunchesRequest(launchIds, mergeOptions = {}) {
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
   * @param {Object} mergeOptions - options for merge request, can override default options.
   * mergeOptions should look like this
   * {
   *      "extendSuitesDescription": boolean,
   *      "description": string,
   *      "mergeType": 'BASIC' | 'DEEP',
   *      "name": string
   * }
   * Please, keep in mind that this method is work only in case
   * the option isLaunchMergeRequired is true.
   *
   * @returns {Promise} - action promise
   */
  mergeLaunches(mergeOptions = {}) {
    if (this.isLaunchMergeRequired) {
      const launchUUIds = helpers.readLaunchesFromFile();
      const params = new URLSearchParams({
        'filter.in.uuid': launchUUIds,
        'page.size': launchUUIds.length,
      });
      const launchSearchUrl =
        this.config.mode === 'DEBUG'
          ? `launch/mode?${params.toString()}`
          : `launch?${params.toString()}`;
      this.logDebug(`Find launches with UUIDs to merge: ${launchUUIds}`);
      return this.restClient
        .retrieveSyncAPI(launchSearchUrl)
        .then(
          (response) => {
            const launchIds = response.content.map((launch) => launch.id);
            this.logDebug(`Found launches: ${launchIds}`, response.content);
            return launchIds;
          },
          (error) => {
            this.logDebug(`Error during launches search with UUIDs: ${launchUUIds}`, error);
            console.dir(error);
          },
        )
        .then((launchIds) => {
          const request = this.getMergeLaunchesRequest(launchIds, mergeOptions);
          this.logDebug(`Merge launches with ids: ${launchIds}`, request);
          const mergeURL = 'launch/merge';
          return this.restClient.create(mergeURL, request);
        })
        .then((response) => {
          this.logDebug(`Launches with UUIDs: ${launchUUIds} were successfully merged!`);
          if (this.config.launchUuidPrint) {
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
  }

  /*
   * This method is used for frameworks as Jasmine. There is problem when
   * it doesn't wait for promise resolve and stop the process. So it better to call
   * this method at the spec's function as @afterAll() and manually resolve this promise.
   *
   * @return Promise
   */
  getPromiseFinishAllItems(launchTempId) {
    const launchObj = this.map[launchTempId];
    return Promise.all(launchObj.children.map((itemId) => this.map[itemId].promiseFinish));
  }

  /**
     * Update launch.
     * @param {string} launchTempId - temp launch id (returned in the query "startLaunch").
     * @param {Object} launchData - new launch data
     * launchData should look like this
     * {
            "description": "string" (support markdown),
            "mode": "DEFAULT" or "DEBUG",
            "attributes": [
                {
                    "key": "string",
                    "value": "string"
                },
                {
                    "value": "string"
                }
            ]
        }
     * @Returns {Object} - an object which contains a tempId and a promise
     */
  updateLaunch(launchTempId, launchData) {
    const launchObj = this.map[launchTempId];
    if (!launchObj) {
      return this.getRejectAnswer(
        launchTempId,
        new Error(`Launch with tempId "${launchTempId}" not found`),
      );
    }
    let resolvePromise;
    let rejectPromise;
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
     * @param {Object} testItemDataRQ - object with item parameters
     * testItemDataRQ should look like this
     * {
            "description": "string" (support markdown),
            "name": "string",
            "startTime": this.helper.now(),
            "attributes": [
                {
                    "key": "string",
                    "value": "string"
                },
                {
                    "value": "string"
                }
            ],
            "type": 'SUITE' or one of 'SUITE', 'STORY', 'TEST',
                    'SCENARIO', 'STEP', 'BEFORE_CLASS', 'BEFORE_GROUPS',
                    'BEFORE_METHOD', 'BEFORE_SUITE', 'BEFORE_TEST',
                    'AFTER_CLASS', 'AFTER_GROUPS', 'AFTER_METHOD',
                    'AFTER_SUITE', 'AFTER_TEST'
        }
     * @param {string} launchTempId - temp launch id (returned in the query "startLaunch").
     * @param {string} parentTempId (optional) - temp item id (returned in the query "startTestItem").
     * @Returns {Object} - an object which contains a tempId and a promise
     */
  startTestItem(testItemDataRQ, launchTempId, parentTempId) {
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
          testItemData.launchUuid = realLaunchId;
          this.logDebug(`Start test item with tempId ${tempId}`, testItemData);
          this.restClient.create(url, testItemData).then(
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
     * @param {string} itemTempId - temp item id (returned in the query "startTestItem").
     * @param {Object} finishTestItemRQ - object with item parameters.
     * finishTestItemRQ should look like this
     {
        "endTime": this.helper.now(),
        "issue": {
          "comment": "string",
          "externalSystemIssues": [
            {
              "submitDate": 0,
              "submitter": "string",
              "systemId": "string",
              "ticketId": "string",
              "url": "string"
            }
          ],
          "issueType": "string"
        },
        "status": "passed" or one of 'passed', 'failed', 'stopped', 'skipped', 'interrupted', 'cancelled'
     }
     * @Returns {Object} - an object which contains a tempId and a promise
     */
  finishTestItem(itemTempId, finishTestItemRQ) {
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

  saveLog(itemObj, requestPromiseFunc) {
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

  sendLog(itemTempId, saveLogRQ, fileObj) {
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
   * @param {string} itemTempId - temp item id (returned in the query "startTestItem").
   * @param {Object} saveLogRQ - object with data of test result.
   * saveLogRQ should look like this
   * {
   *      level: 'error' or one of 'trace', 'debug', 'info', 'warn', 'error', '',
   *      message: 'string' (support markdown),
   *      time: this.helpers.now()
   * }
   * @Returns {Object} - an object which contains a tempId and a promise
   */
  sendLogWithoutFile(itemTempId, saveLogRQ) {
    const itemObj = this.map[itemTempId];
    if (!itemObj) {
      return this.getRejectAnswer(
        itemTempId,
        new Error(`Item with tempId "${itemTempId}" not found`),
      );
    }

    const requestPromise = (itemUuid, launchUuid) => {
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
     * @param {string} itemTempId - temp item id (returned in the query "startTestItem").
     * @param {Object} saveLogRQ - object with data of test result.
     * saveLogRQ should look like this
     * {
     *      level: 'error' or one of 'trace', 'debug', 'info', 'warn', 'error', '',
     *      message: 'string' (support markdown),
     *      time: this.helpers.now()
     * }
     * @param {Object} fileObj - object with file data.
     * fileObj should look like this
     * {
          name: 'string',
          type: "image/png" or your file mimeType
            (supported types: 'image/*', application/ ['xml', 'javascript', 'json', 'css', 'php'],
            another format will be opened in a new browser tab ),
          content: file
     * }
     * @Returns {Object} - an object which contains a tempId and a promise
     */
  sendLogWithFile(itemTempId, saveLogRQ, fileObj) {
    const itemObj = this.map[itemTempId];
    if (!itemObj) {
      return this.getRejectAnswer(
        itemTempId,
        new Error(`Item with tempId "${itemTempId}" not found`),
      );
    }

    const requestPromise = (itemUuid, launchUuid) => {
      const isItemUuid = itemUuid !== launchUuid;

      return this.getRequestLogWithFile(
        Object.assign(saveLogRQ, { launchUuid }, isItemUuid && { itemUuid }),
        fileObj,
      );
    };

    return this.saveLog(itemObj, requestPromise);
  }

  getRequestLogWithFile(saveLogRQ, fileObj) {
    const url = 'log';
    // eslint-disable-next-line no-param-reassign
    saveLogRQ.file = { name: fileObj.name };
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

  // eslint-disable-next-line valid-jsdoc
  /**
   *
   * @Private
   */
  buildMultiPartStream(jsonPart, filePart, boundary) {
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
      Buffer.from(filePart.content, 'base64'),
      Buffer.from(`${eol + bx}--${eol}`),
    ];
    return Buffer.concat(buffers);
  }

  finishTestItemPromiseStart(itemObj, itemTempId, finishTestItemData) {
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

module.exports = RPClient;
