/* eslint-disable quotes,no-console,class-methods-use-this */
const UniqId = require("uniqid");
const helpers = require("./helpers");
const RestClient = require("./rest");
const Analytics = require("../analytics/analytics");
const { CLIENT_JAVASCRIPT_EVENTS } = require("./../analytics/events");

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
        this.isLaunchMergeRequired =
            params.isLaunchMergeRequired === undefined
                ? false
                : params.isLaunchMergeRequired;
        this.map = {};
        this.baseURL = [params.endpoint, params.project].join("/");
        this.options = {
            headers: {
                "User-Agent": "NodeJS",
                Authorization: `bearer ${params.token}`
            }
        };
        this.headers = {
            "User-Agent": "NodeJS",
            Authorization: `bearer ${params.token}`
        };
        this.token = params.token;
        this.config = params;
        this.helpers = helpers;
        this.restClient = new RestClient({
            baseURL: this.baseURL,
            headers: this.headers
        });
        this.analytics = new Analytics();
        this.analytics.setPersistentParams();
        this.launchUuid = "";
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
            promise: Promise.reject(error)
        };
    }

    getNewItemObj(startPromiseFunc) {
        let resolveFinish;
        let rejectFinish;
        const obj = {
            promiseStart: new Promise(startPromiseFunc),
            realId: "",
            childrens: [],
            finishSend: false,
            promiseFinish: new Promise((resolve, reject) => {
                resolveFinish = resolve;
                rejectFinish = reject;
            })
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
        ids.forEach(id => {
            delete this.map[id];
        });
    }

    checkConnect() {
        const url = [this.config.endpoint.replace("/v2", "/v1"), "user"].join(
            "/"
        );
        return RestClient.request("GET", url, {}, { headers: this.headers });
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
            this.map[tempId] = this.getNewItemObj(resolve =>
                resolve(launchDataRQ)
            );
            this.map[tempId].realId = launchDataRQ.id;
        } else {
            const launchData = Object.assign(
                {
                    name: this.config.launch || "Test launch name",
                    startTime: this.helpers.now()
                },
                launchDataRQ
            );

            this.map[tempId] = this.getNewItemObj((resolve, reject) => {
                const url = "launch";
                this.logDebug(`Start launch ${tempId}`);
                this.restClient
                    .create(url, launchData, { headers: this.headers })
                    .then(
                        response => {
                            this.map[tempId].realId = response.id;
                            this.launchUuid = response.id;
                            this.restClient
                                .retrieve(`launch/uuid/${this.launchUuid}`)
                                .then(
                                    ({ id }) => {
                                        if (this.isLaunchMergeRequired) {
                                            helpers.saveLaunchIdToFile(
                                                this.config.launch,
                                                response.number,
                                                id
                                            );
                                        }
                                        resolve(response);
                                    },
                                    error => {
                                        console.dir(error);
                                        reject(error);
                                    }
                                );
                        },
                        error => {
                            console.dir(error);
                            reject(error);
                        }
                    );
            });
        }
        this.analytics.trackEvent(CLIENT_JAVASCRIPT_EVENTS.START_LAUNCH);
        return {
            tempId,
            promise: this.map[tempId].promiseStart
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
                new Error(`Launch "${launchTempId}" not found`)
            );
        }

        const finishExecutionData = Object.assign(
            { endTime: this.helpers.now() },
            finishExecutionRQ
        );

        launchObj.finishSend = true;
        Promise.all(
            launchObj.childrens.map(itemId => this.map[itemId].promiseFinish)
        ).then(
            () => {
                launchObj.promiseStart.then(
                    () => {
                        this.logDebug(`Finish launch ${launchTempId}`);
                        const url = ["launch", launchObj.realId, "finish"].join(
                            "/"
                        );
                        this.restClient
                            .update(url, finishExecutionData, {
                                headers: this.headers
                            })
                            .then(
                                response => {
                                    this.logDebug(
                                        `Success finish launch ${launchTempId}`
                                    );
                                    launchObj.resolveFinish(response);
                                },
                                error => {
                                    this.logDebug(
                                        `Error finish launch ${launchTempId}`
                                    );
                                    console.dir(error);
                                    launchObj.rejectFinish(error);
                                }
                            );
                    },
                    error => {
                        launchObj.rejectFinish(error);
                    }
                );
            },
            error => {
                launchObj.rejectFinish(error);
            }
        );

        return {
            tempId: launchTempId,
            promise: launchObj.promiseFinish
        };
    }

        /*
     * This method is used for force stop launches in ReportPortal.
     *
     * Please, keep in mind that this method is work only in case
     * the option isLaunchMergeRequired is true.
     */
    forceStopAndDeleteSkippedTests() {
        if (this.isLaunchMergeRequired) {
            const statusUrl = ["launch", "status"].join("/");
            const stopUrl = ["launch", "stop"].join("/");
            const launchIds = helpers.readLaunchesFromFile();

            this.restClient
                .retrieve(`${statusUrl}?ids=${launchIds.join()}`)
                .then(response => {
                    const arr = [];
                    for (let item in response) {
                        response[item] === "IN_PROGRESS" && arr.push(item);
                    }
                    const data = {};
                    arr.map(
                        item =>
                            (data[item] = {
                                endTime: this.helpers.now(),
                                status: "STOPPED"
                            })
                    );
                    this.restClient
                        .update(
                            stopUrl,
                            { entities: data },
                            { headers: this.headers }
                        )
                        .then(response => {
                            this.logDebug(`Launches successfully stopped!`);
                            this.deleteSkippedTest()
                        });
                });
        } else {
            this.logDebug(`Option isLaunchMergeRequired is false'`);
        }
    }


isLaunchWithFailedTests(launchTempId) {
    const launchObj = this.map[launchTempId];

    const launch_latest_url = "/launch/latest?filter.eq.uuid="+launchObj.realId;

    return this.restClient 
    .retrieve(launch_latest_url)
    .then(response => {
        this.logDebug('Launch ID'+response.content[0].id)
        const url = "/launch?filter.eq.id="+response.content[0].id+"&filter.eq.statistics%24executions%24failed=0";
        return this.restClient
            .retrieve(url)
            .then(response => {
                this.logDebug   (`Failed test elements: `+response.page.totalElements);
                if (response.page.totalElements == 0){
                    this.logDebug(`There is failed items`);
                    return false;
                }
                    return true;
            });
    });
   
    //this.logDebug  (`There is no failed`);
    
}

async deleteSkippedTest() {
    const launchIds = helpers.readLaunchesFromFile();
    const hasSkipTestItems = [];

    for (let item in launchIds) {
      await this.restClient
            .retrieve("/item?filter.eq.launchId="+launchIds[item]+"&page.size=100")
            .then(response => {
                this.logDebug  (`Total elements in ${launchIds[item]}: `+response.page.totalElements);   
                for (var i=0;i<response.page.totalElements;i++){
                    this.logDebug('Test ID: '+response.content[i].id+' '+response.content[i].name+' Skipped:'+response.content[i].statistics.executions.skipped)
                    const item_id_url='/item/uuid/'+response.content[i].id
                    if ((response.content[i].statistics.executions.skipped==1 && response.content[i].hasChildren == false) || (response.content[i].statistics.executions.total==response.content[i].statistics.executions.skipped)){
                        this.restClient 
                           .retrieve(item_id_url)
                           .then(response => {
                               hasSkipTestItems.push(response.id)
                               this.restClient
                               .delete("/item?ids="+response.id)
                               .then(response => {
                                    this.logDebug('Deleted Skipped tests successfully');                           
                               });
                           });
                       }
                }
            });
    }
}


    /*
     * This method is used to create data object for merge request to ReportPortal.
     *
     * @Returns {Object} - an object which contains a data for merge launches in ReportPortal.
     */
    getMergeLaunchesData(launchIds, mergeDescription) {
        return {
            description: mergeDescription,
            endTime: this.helpers.now(),
            extendSuitesDescription: true,
            launches: launchIds,
            mergeType: "BASIC",
            mode: "DEFAULT",
            name: this.config.launch || "Test launch name",
            attributes: this.config.attributes
        };
    }

    /*
     * This method is used for merge launches in ReportPortal.
     *
     * Please, keep in mind that this method is work only in case
     * the option isLaunchMergeRequired is true.
     */
    async mergeLaunches(mergeDescription) {
        if (this.isLaunchMergeRequired) {
            const url = ["launch", "merge"].join("/");
            const launchIds = helpers.readLaunchesFromFile();
            
            const activeLaunches = []
            for (let items in launchIds)
            {
                await this.restClient
                .retrieve('/launch/status?ids='+launchIds[items])
                .then(response => {
                    if (response.hasOwnProperty(launchIds[items]))
                    {  
                        activeLaunches.push(launchIds[items])
                    }                
                })
            }
            const data = this.getMergeLaunchesData(activeLaunches, mergeDescription);
            this.restClient
            .create(url, data, { headers: this.headers })
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
        return Promise.all(
            launchObj.childrens.map(itemId => this.map[itemId].promiseFinish)
        );
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
                new Error(`Launch "${launchTempId}" not found`)
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
                const url = ["launch", launchObj.realId, "update"].join("/");
                this.restClient
                    .update(url, launchData, { headers: this.headers })
                    .then(
                        response => {
                            resolvePromise(response);
                        },
                        error => {
                            rejectPromise(error);
                        }
                    );
            },
            error => {
                rejectPromise(error);
            }
        );
        return {
            tempId: launchTempId,
            promise
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
                new Error(`Launch "${launchTempId}" not found`)
            );
        }
        if (launchObj.finishSend) {
            const err = new Error(
                `Launch "${launchTempId}" is already finished, you can not add an item to it`
            );
            return this.getRejectAnswer(launchTempId, err);
        }

        const testItemData = Object.assign(
            { startTime: this.helpers.now() },
            testItemDataRQ
        );

        let parentPromise = launchObj.promiseStart;
        if (parentTempId) {
            parentMapId = parentTempId;
            const parentObj = this.map[parentTempId];
            if (!parentObj) {
                return this.getRejectAnswer(
                    launchTempId,
                    new Error(`Item "${parentTempId}" not found`)
                );
            }
            parentPromise = parentObj.promiseStart;
        }

        const tempId = this.getUniqId();
        this.map[tempId] = this.getNewItemObj((resolve, reject) => {
            parentPromise.then(
                () => {
                    const realLaunchId = this.map[launchTempId].realId;
                    let url = "item/";
                    if (parentTempId) {
                        const realParentId = this.map[parentTempId].realId;
                        url += `${realParentId}`;
                    }
                    testItemData.launchUuid = realLaunchId;
                    this.logDebug(`Start test item ${tempId}`);
                    this.restClient
                        .create(url, testItemData, { headers: this.headers })
                        .then(
                            response => {
                                this.logDebug(`Success start item ${tempId}`);
                                this.map[tempId].realId = response.id;
                                resolve(response);
                            },
                            error => {
                                this.logDebug(`Error start item ${tempId}:`);
                                console.dir(error);
                                reject(error);
                            }
                        );
                },
                error => {
                    reject(error);
                }
            );
        });
        this.map[parentMapId].childrens.push(tempId);

        return {
            tempId,
            promise: this.map[tempId].promiseStart
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
                new Error(`Item "${itemTempId}" not found`)
            );
        }

        // if (finishTestItemRQ.status === 'skipped') {
        //     finishTestItemRQ = Object.assign(
        //         {
        //             "issue": {
        //                 "issueType": "nd001",
        //                 "autoAnalyzed": false,
        //                 "ignoreAnalyzer": false,
        //                 "externalSystemIssues": []
        //             }
        //         },
        //         finishTestItemRQ
        //     );
        // }

        const finishTestItemData = Object.assign(
            {
                endTime: this.helpers.now(),
                status: "passed"
            },
            finishTestItemRQ
        );

        itemObj.finishSend = true;
        Promise.all(
            itemObj.childrens.map(itemId => this.map[itemId].promiseFinish)
        ).then(
            () => {
                this.cleanMap(itemObj.childrens);
                this.finishTestItemPromiseStart(
                    itemObj,
                    itemTempId,
                    Object.assign(finishTestItemData, {
                        launchUuid: this.launchUuid
                    })
                );
            },
            () => {
                this.cleanMap(itemObj.childrens);
                this.logDebug(
                    `Error finish children of test item ${itemTempId}`
                );
                this.logDebug(`Finish test item ${itemTempId}`);
                this.finishTestItemPromiseStart(
                    itemObj,
                    itemTempId,
                    Object.assign(finishTestItemData, {
                        launchUuid: this.launchUuid
                    })
                );
            }
        );

        return {
            tempId: itemTempId,
            promise: itemObj.promiseFinish
        };
    }

    saveLog(itemObj, requestPromiseFunc) {
        const tempId = this.getUniqId();
        this.map[tempId] = this.getNewItemObj((resolve, reject) => {
            itemObj.promiseStart.then(
                () => {
                    this.logDebug(`Save log ${tempId}`);
                    requestPromiseFunc(itemObj.realId, this.launchUuid).then(
                        response => {
                            this.logDebug(`Successfully save log ${tempId}`);
                            resolve(response);
                        },
                        error => {
                            this.logDebug(`Error finish log: ${error}`);
                            reject(error);
                        }
                    );
                },
                error => {
                    reject(error);
                }
            );
        });
        itemObj.childrens.push(tempId);

        const logObj = this.map[tempId];
        logObj.finishSend = true;
        logObj.promiseStart.then(
            response => logObj.resolveFinish(response),
            error => logObj.rejectFinish(error)
        );

        return {
            tempId,
            promise: this.map[tempId].promiseFinish
        };
    }

    sendLog(itemTempId, saveLogRQ, fileObj) {
        const saveLogData = Object.assign(
            {
                time: this.helpers.now(),
                message: "",
                level: ""
            },
            saveLogRQ
        );

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
                new Error(`Item "${itemTempId}" not found`)
            );
        }

        const requestPromise = (itemUuid, launchUuid) => {
            const url = "log";
            // eslint-disable-next-line max-len
            return this.restClient.create(
                url,
                Object.assign(saveLogRQ, { itemUuid, launchUuid }),
                { headers: this.headers }
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
                new Error(`Item "${itemTempId}" not found`)
            );
        }
        // eslint-disable-next-line max-len
        const requestPromise = (itemUuid, launchUuid) =>
            this.getRequestLogWithFile(
                Object.assign(saveLogRQ, { itemUuid, launchUuid }),
                fileObj
            );

        return this.saveLog(itemObj, requestPromise);
    }

    getRequestLogWithFile(saveLogRQ, fileObj) {
        const url = "log";
        // eslint-disable-next-line no-param-reassign
        saveLogRQ.file = { name: fileObj.name };
        return this.restClient
            .create(
                url,
                this.buildMultiPartStream(
                    [saveLogRQ],
                    fileObj,
                    MULTIPART_BOUNDARY
                ),
                {
                    headers: {
                        Authorization: `bearer ${this.token}`,
                        "Content-Type": `multipart/form-data; boundary=${MULTIPART_BOUNDARY}`
                    }
                }
            )
            .then(response => response)
            .catch(error => {
                this.logDebug("ERROR");
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
                bx +
                    eol +
                    'Content-Disposition: form-data; name="json_request_part"' +
                    eol +
                    "Content-Type: application/json" +
                    eol +
                    eol +
                    eol +
                    JSON.stringify(jsonPart) +
                    eol
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
                    "Content-Type: " +
                    filePart.type +
                    eol +
                    eol
            ),
            Buffer.from(filePart.content, "base64"),
            Buffer.from(`${eol + bx}--${eol}`)
        ];
        return Buffer.concat(buffers);
    }

    finishTestItemPromiseStart(itemObj, itemTempId, finishTestItemData) {
        itemObj.promiseStart.then(
            () => {
                const url = ["item", itemObj.realId].join("/");
                this.logDebug(`Finish test item ${itemTempId}`);
                // eslint-disable-next-line max-len
                this.restClient
                    .update(
                        url,
                        Object.assign(finishTestItemData, {
                            launchUuid: this.launchUuid
                        }),
                        { headers: this.headers }
                    )
                    .then(
                        response => {
                            this.logDebug(`Success finish item ${itemTempId}`);
                            itemObj.resolveFinish(response);
                        },
                        error => {
                            this.logDebug(
                                `Error finish test item ${itemTempId}`
                            );
                            console.dir(error);
                            itemObj.rejectFinish(error);
                        }
                    );
            },
            error => {
                itemObj.rejectFinish(error);
            }
        );
    }
}

module.exports = RPClient;
