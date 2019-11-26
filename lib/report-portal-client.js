/* eslint-disable quotes,no-console,class-methods-use-this */
const UniqId = require('uniqid');
const helpers = require('./helpers');
const RestClient = require('./rest');

const MULTIPART_BOUNDARY = Math.floor(Math.random() * 10000000000).toString();

class RPClient {
    /**
     * Create a client for RP.
     * @param {Object} params - config object.
     * params should look like this
     * {
     *      token: "00000000-0000-0000-0000-000000000000",
     *      endpoint: "http://localhost:8080/api/v1",
     *      launch: "YOUR LAUNCH NAME",
     *      project: "PROJECT NAME",
     * }
     */
    constructor(params) {
        this.debug = params.debug;
        this.isLaunchMergeRequired = params.isLaunchMergeRequired === undefined ? false : params.isLaunchMergeRequired;
        this.map = {};
        this.baseURL = [params.endpoint, params.project].join('/');
        this.options = {
            headers: {
                'User-Agent': 'NodeJS',
                Authorization: `bearer ${params.token}`,
            },
        };
        this.headers = {
            'User-Agent': 'NodeJS',
            Authorization: `bearer ${params.token}`,
        };
        this.token = params.token;
        this.config = params;
        this.helpers = helpers;
        this.restClient = new RestClient({
            baseURL: this.baseURL,
            headers: this.headers,
        });
    }

    // eslint-disable-next-line valid-jsdoc
    /**
   *
   * @Private
   */
    logDebug(msg) {
        if (this.debug) {
            console.log(msg);
        }
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
            promiseStart: (new Promise(startPromiseFunc)),
            realId: '',
            childrens: [],
            finishSend: false,
            promiseFinish: (new Promise((resolve, reject) => {
                resolveFinish = resolve;
                rejectFinish = reject;
            })),
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
        const url = [this.config.endpoint, 'user'].join('/');
        return RestClient.request('GET', url, {}, { headers: this.headers });
    }

    /**
     * Start launch and report it.
     * @param {Object} launchDataRQ - request object.
     * launchDataRQ should look like this
     * {
            "description": "string" (support markdown),
            "mode": "DEFAULT" or "DEBUG",
            "name": "string",
            "start_time": this.helper.now(),
            "tags": [
              "string"
            ]
     * }
     * @Returns an object which contains a tempID and a promise
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
            this.map[tempId] = this.getNewItemObj(resolve => resolve(launchDataRQ));
            this.map[tempId].realId = launchDataRQ.id;
        } else {
            const launchData = Object.assign(
                { name: this.config.launch || 'Test launch name', start_time: this.helpers.now() },
                launchDataRQ,
            );

            this.map[tempId] = this.getNewItemObj((resolve, reject) => {
                const url = 'launch';
                this.logDebug(`Start launch ${tempId}`);
                this.restClient.create(url, launchData, { headers: this.headers })
                    .then((response) => {
                        this.map[tempId].realId = response.id;

                        if (this.isLaunchMergeRequired) {
                            helpers.saveLaunchIdToFile(this.config.launch, response.number, response.id);
                        }

                        resolve(response);
                    }, (error) => {
                        console.dir(error);
                        reject(error);
                    });
            });
        }
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
     *      "end_time": this.helper.now(),
     *      "status": "PASSED" or one of ‘PASSED’, ‘FAILED’, ‘STOPPED’, ‘SKIPPED’, ‘RESTED’, ‘CANCELLED’
     * }
     * @Returns {Object} - an object which contains a tempID and a promise
     */
    finishLaunch(launchTempId, finishExecutionRQ) {
        const launchObj = this.map[launchTempId];
        if (!launchObj) {
            return this.getRejectAnswer(launchTempId, new Error(`Launch "${launchTempId}" not found`));
        }

        const finishExecutionData = Object.assign({ end_time: this.helpers.now(), status: '' }, finishExecutionRQ);

        launchObj.finishSend = true;
        Promise.all(launchObj.childrens.map(itemId => this.map[itemId].promiseFinish))
            .then(() => {
                launchObj.promiseStart
                    .then(() => {
                        this.logDebug(`Finish launch ${launchTempId}`);
                        const url = ['launch', launchObj.realId, 'finish'].join('/');
                        this.restClient.update(url, finishExecutionData, { headers: this.headers })
                            .then((response) => {
                                this.logDebug(`Success finish launch ${launchTempId}`);
                                launchObj.resolveFinish(response);
                            }, (error) => {
                                this.logDebug(`Error finish launch ${launchTempId}`);
                                console.dir(error);
                                launchObj.rejectFinish(error);
                            });
                    }, (error) => {
                        launchObj.rejectFinish(error);
                    });
            }, (error) => {
                launchObj.rejectFinish(error);
            });

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
    getMergeLaunchesData(launchIds) {
        return {
            description: "Merged launch",
            end_time: this.helpers.now(),
            extendSuitesDescription: true,
            launches: launchIds,
            merge_type: "BASIC",
            mode: "DEFAULT",
            name: this.config.launch || 'Test launch name',
            tags: this.config.tags,
        };
    }

    /*
     * This method is used for merge launches in ReportPortal.
     *
     * Please, keep in mind that this method is work only in case
     * the option isLaunchMergeRequired is true.
     */
    mergeLaunches(project) {
        if (this.isLaunchMergeRequired) {
            const url = ["launch", "merge"].join("/");
            const launchIds = helpers.readLaunchesFromFile(project);
            const data = this.getMergeLaunchesData(launchIds);

            this.restClient.create(url, data, { headers: this.headers })
                .then(() => {
                    this.logDebug(`Launches successfully merged!`);
                });
        } else {
            this.logDebug(`Option isLaunchMergeRequired is false'`);
        }
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
        return Promise.all(launchObj.childrens.map(itemId => this.map[itemId].promiseFinish));
    }


    /**
     * Update launch.
     * @param {string} launchTempId - temp launch id (returned in the query "startLaunch").
     * @param {Object} launchData - new launch data
     * launchData should look like this
     * {
            "description": "string" (support markdown),
            "mode": "DEFAULT" or "DEBUG",
            "tags": [
                "string"
            ]
        }
     * @Returns {Object} - an object which contains a tempId and a promise
     */
    updateLaunch(launchTempId, launchData) {
        const launchObj = this.map[launchTempId];
        if (!launchObj) {
            return this.getRejectAnswer(launchTempId, new Error(`Launch "${launchTempId}" not found`));
        }
        let resolvePromise;
        let rejectPromise;
        const promise = new Promise((resolve, reject) => {
            resolvePromise = resolve;
            rejectPromise = reject;
        });

        launchObj.promiseFinish.then(() => {
            const url = ['launch', launchObj.realId, 'update'].join('/');
            this.restClient.update(url, launchData, { headers: this.headers })
                .then((response) => {
                    resolvePromise(response);
                }, (error) => {
                    rejectPromise(error);
                });
        }, (error) => {
            rejectPromise(error);
        });
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
            "start_time": this.helper.now(),
             "tags": [
               "string"
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
            return this.getRejectAnswer(launchTempId, new Error(`Launch "${launchTempId}" not found`));
        }
        if (launchObj.finishSend) {
            const err = new Error(`Launch "${launchTempId}" is already finished, you can not add an item to it`);
            return this.getRejectAnswer(launchTempId, err);
        }

        const testItemData = Object.assign({ start_time: this.helpers.now() }, testItemDataRQ);

        let parentPromise = launchObj.promiseStart;
        if (parentTempId) {
            parentMapId = parentTempId;
            const parentObj = this.map[parentTempId];
            if (!parentObj) {
                return this.getRejectAnswer(launchTempId, new Error(`Item "${parentTempId}" not found`));
            }
            parentPromise = parentObj.promiseStart;
        }

        const tempId = this.getUniqId();
        this.map[tempId] = this.getNewItemObj((resolve, reject) => {
            parentPromise.then(() => {
                const realLaunchId = this.map[launchTempId].realId;
                let url = 'item/';
                if (parentTempId) {
                    const realParentId = this.map[parentTempId].realId;
                    url += `${realParentId}`;
                }
                testItemData.launch_id = realLaunchId;
                this.logDebug(`Start test item ${tempId}`);
                this.restClient.create(url, testItemData, { headers: this.headers })
                    .then((response) => {
                        this.logDebug(`Success start item ${tempId}`);
                        this.map[tempId].realId = response.id;
                        resolve(response);
                    }, (error) => {
                        this.logDebug(`Error start item ${tempId}:`);
                        console.dir(error);
                        reject(error);
                    });
            }, (error) => {
                reject(error);
            });
        });
        this.map[parentMapId].childrens.push(tempId);

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
        "end_time": this.helper.now(),
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
          "issue_type": "string"
        },
        "status": "PASSED" or one of 'PASSED', 'FAILED', 'STOPPED', 'SKIPPED', 'RESETED', 'CANCELLED'
     }
     * @Returns {Object} - an object which contains a tempId and a promise
     */
    finishTestItem(itemTempId, finishTestItemRQ) {
        const itemObj = this.map[itemTempId];
        if (!itemObj) {
            return this.getRejectAnswer(itemTempId, new Error(`Item "${itemTempId}" not found`));
        }

        const finishTestItemData = Object.assign({
            end_time: this.helpers.now(),
            status: 'PASSED',
        }, finishTestItemRQ);

        itemObj.finishSend = true;
        Promise.all(itemObj.childrens.map(itemId => this.map[itemId].promiseFinish))
            .then(() => {
                this.cleanMap(itemObj.childrens);
                this.finishTestItemPromiseStart(itemObj, itemTempId, finishTestItemData);
            }, () => {
                this.cleanMap(itemObj.childrens);
                this.logDebug(`Error finish children of test item ${itemTempId}`);
                this.logDebug(`Finish test item ${itemTempId}`);
                this.finishTestItemPromiseStart(itemObj, itemTempId, finishTestItemData);
            });

        return {
            tempId: itemTempId,
            promise: itemObj.promiseFinish,
        };
    }

    saveLog(itemObj, requestPromiseFunc) {
        const tempId = this.getUniqId();
        this.map[tempId] = this.getNewItemObj((resolve, reject) => {
            itemObj.promiseStart.then(() => {
                this.logDebug(`Save log ${tempId}`);
                requestPromiseFunc(itemObj.realId).then((response) => {
                    this.logDebug(`Successfully save log ${tempId}`);
                    resolve(response);
                }, (error) => {
                    this.logDebug(`Error finish log: ${error}`);
                    reject(error);
                });
            }, (error) => {
                reject(error);
            });
        });
        itemObj.childrens.push(tempId);

        const logObj = this.map[tempId];
        logObj.finishSend = true;
        logObj.promiseStart.then(response => logObj.resolveFinish(response), error => logObj.rejectFinish(error));

        return {
            tempId,
            promise: this.map[tempId].promiseFinish,
        };
    }

    sendLog(itemTempId, saveLogRQ, fileObj) {
        const saveLogData = Object.assign({
            time: this.helpers.now(),
            message: '',
            level: '',
        }, saveLogRQ);

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
            return this.getRejectAnswer(itemTempId, new Error(`Item "${itemTempId}" not found`));
        }

        const requestPromise = (id) => {
            const url = 'log';
            // eslint-disable-next-line no-param-reassign
            saveLogRQ.item_id = id;
            return this.restClient.create(url, saveLogRQ, { headers: this.headers });
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
            return this.getRejectAnswer(itemTempId, new Error(`Item "${itemTempId}" not found`));
        }

        const requestPromise = (id) => {
            // eslint-disable-next-line no-param-reassign
            saveLogRQ.item_id = id;
            return this.getRequestLogWithFile(saveLogRQ, fileObj);
        };
        return this.saveLog(itemObj, requestPromise);
    }

    getRequestLogWithFile(saveLogRQ, fileObj) {
        const url = 'log';
        // eslint-disable-next-line no-param-reassign
        saveLogRQ.file = { name: fileObj.name };
        return this.restClient.create(
            url,
            this.buildMultiPartStream([saveLogRQ], fileObj, MULTIPART_BOUNDARY),
            {
                headers: {
                    Authorization: `bearer ${this.token}`,
                    'Content-Type': `multipart/form-data; boundary=${MULTIPART_BOUNDARY}`,
                },
            },
        )
            .then(response => response)
            .catch((error) => {
                this.logDebug('ERROR');
                this.logDebug(error);
            });
    }

    // eslint-disable-next-line valid-jsdoc
    /**
   *
   * @Private
   */
    buildMultiPartStream(jsonPart, filePart, boundary) {
        const eol = "\r\n";
        const bx = `--${boundary}`;
        const buffers = [
            // eslint-disable-next-line function-paren-newline
            Buffer.from(
                // eslint-disable-next-line prefer-template
                bx + eol + "Content-Disposition: form-data; name=\"json_request_part\""
                + eol + "Content-Type: application/json" + eol
                + eol + eol + JSON.stringify(jsonPart) + eol,
            ),
            // eslint-disable-next-line function-paren-newline
            Buffer.from(
                // eslint-disable-next-line prefer-template
                bx + eol + "Content-Disposition: form-data; name=\"file\"; filename=\"" + filePart.name + "\"" + eol
                + "Content-Type: " + filePart.type + eol + eol,
            ),
            Buffer.from(filePart.content, 'base64'),
            Buffer.from(`${eol + bx}--${eol}`),
        ];
        return Buffer.concat(buffers);
    }

    finishTestItemPromiseStart(itemObj, itemTempId, finishTestItemData) {
        itemObj.promiseStart
            .then(() => {
                const url = ['item', itemObj.realId].join('/');
                this.logDebug(`Finish test item ${itemTempId}`);
                this.restClient.update(url, finishTestItemData, { headers: this.headers })
                    .then((response) => {
                        this.logDebug(`Success finish item ${itemTempId}`);
                        itemObj.resolveFinish(response);
                    }, (error) => {
                        this.logDebug(`Error finish test item ${itemTempId}`);
                        console.dir(error);
                        itemObj.rejectFinish(error);
                    });
            }, (error) => {
                itemObj.rejectFinish(error);
            });
    }
}

module.exports = RPClient;
