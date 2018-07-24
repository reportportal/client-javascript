const UniqId = require('uniqid');

let rest = require('restler');
let helpers = require('./helpers');
let boundary = Math.floor(Math.random() * 10000000000).toString();

class RPClient {
    /**
     * Create a client for RP.
     * @param {Object} params - Config object.
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
        this.map = {};
        this.baseURL = [params.endpoint, params.project].join("/");
        this.options = {
            headers: {
                "User-Agent": 'NodeJS',
                "Authorization": `bearer ${params.token}`
            }
        };
        this.headers = {
            "User-Agent": 'NodeJS',
            "Authorization": `bearer ${params.token}`
        };
        this.token = params.token;
        this.config = params;
        this.helpers = helpers;
    }
    getUniqId() {
        return UniqId();
    }
    getRejectAnsver(tempId, error) {
        return {
            tempId,
            promise: Promise.reject(error)
        }
    }
    getNewItemObj(startPrpmiseFunc) {
        let resolveFinish;
        let rejectFinish;
        let obj = {
            promiseStart: (new Promise(startPrpmiseFunc)),
            realId: '',
            childrens: [],
            finishSend: false,
            promiseFinish: (new Promise((resolve, reject) => {
                resolveFinish = resolve;
                rejectFinish = reject;
            }))
        }
        obj.resolveFinish = resolveFinish;
        obj.rejectFinish = rejectFinish;
        return obj;
    }
    cleanMap(ids) {
        ids.forEach((id) => {
            delete this.map[id];
        })
    }
    checkConnect() {
        const url = [this.config.endpoint, "user"].join("/");
        return helpers.getServerResult(url, {}, {headers: this.headers}, "GET")
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
     * First - If launchDataRQ object doesn't contain ID field , it would create a new Launch instance at the
     * Report Portal with it ID.
     * Second - If launchDataRQ would contain ID field , client would connect to the existing Launch which ID
     * has been sent , and would send all data to it.
     * Notice that Launch which ID has been sent must be 'IN PROGRESS' state at the Report Portal
     * or it would throw an error.
     *
     */
    startLaunch(launchDataRQ) {
        const tempId = this.getUniqId();
        if (launchDataRQ.id) {
            this.map[tempId]= this.getNewItemObj((resolve, reject) => {
                resolve(launchDataRQ);
            });
            this.map[tempId].realId = launchDataRQ.id;
        } else{
            let launchData = Object.assign({
                name: this.config.launch || 'Test launch name',
                start_time: this.helpers.now()
            }, launchDataRQ);

            this.map[tempId] = this.getNewItemObj((resolve, reject) => {
                const url = [this.baseURL, "launch"].join("/");
                this.debug && console.log(`Start launch ${tempId}`);
                helpers.getServerResult(url, launchData, {headers: this.headers}, "POST")
                    .then((responce) => {
                        this.map[tempId].realId = responce.id;
                        resolve(responce);
                    }, (error) => {
                        console.dir(error);
                        reject();
                    })
            });
        }
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
     *      "end_time": this.helper.now(),
     *      "status": "PASSED" or one of ‘PASSED’, ‘FAILED’, ‘STOPPED’, ‘SKIPPED’, ‘RESTED’, ‘CANCELLED’
     * }
     *    @Returns an object which contains a tempID and a promise
     */
    finishLaunch(launchTempId, finishExecutionRQ) {
        const launchObj = this.map[launchTempId];
        if(!launchObj) {
            return this.getRejectAnsver(launchTempId, new Error('Launch "'+ launchTempId+'" not found'));
        }

        let finishExecutionData = Object.assign({
            end_time: this.helpers.now(),
            status: ''
        }, finishExecutionRQ);

        launchObj.finishSend = true;
        Promise.all( launchObj.childrens.map((itemId) => { return this.map[itemId].promiseFinish; }) )
            .then(() => {
                launchObj.promiseStart
                    .then( () => {
                        let url = [this.baseURL, "launch", launchObj.realId, "finish"].join("/");
                        this.debug && console.log(`Finish launch ${launchTempId}`);
                        helpers.getServerResult(url, finishExecutionData,   {headers: this.headers}, "PUT")
                            .then((responce) => {
                                this.debug && console.log(`Success finish launch ${launchTempId}`);
                                launchObj.resolveFinish(responce);
                            }, (error) => {
                                this.debug && console.log(`Error finish launch ${launchTempId}:`);
                                console.dir(error);
                                launchObj.rejectFinish(error);
                            })
                    }, (error) => {
                        launchObj.rejectFinish(error);
                    })
            }, (error) => {
                launchObj.rejectFinish(error);
            });

        return {
            tempId: launchTempId,
            promise: launchObj.promiseFinish
        };
    }

    /*
     * This method is used for frameworks as Jasmine. There is problems when
     * it doesn't wait for promise resolve and stop the process. So it better to call
     * this method at the spec's function as @afterAll() and manually resolve this promise.
     *
     * @return Promise
     */
    getPromiseFinishAllItems(launchTempId) {
        const launchObj = this.map[launchTempId];
        return Promise.all( launchObj.childrens.map((itemId) => { return this.map[itemId].promiseFinish; }));
    }


    /**
     * Update launch.
     * @param {string} launchTempId - temp launch id (returned in the query "startLaunch").
     * @param {string} launchData - new launch data
     * launchData should look like this
     * {
            "description": "string" (support markdown),
            "mode": "DEFAULT" or "DEBUG",
            "tags": [
                "string"
            ]
        }
     * @Returns an object which contains a tempID and a promise
     */
    updateLaunch(launchTempId, launchData) {
        const launchObj = this.map[launchTempId];
        if(!launchObj) {
            return this.getRejectAnsver(launchTempId, new Error('Launch "'+ launchTempId+'" not found'));
        }
        let resolvePromise;
        let rejectPromise;
        const promise = new Promise((resolve, reject) => {
            resolvePromise = resolve;
            rejectPromise = reject;
        })

        launchObj.promiseFinish.then(() => {
            let url = [this.baseURL, "launch",  launchObj.realId, 'update'].join("/");
            helpers.getServerResult(url, launchData,   {headers: this.headers}, "PUT")
                .then((responce) => {
                    resolvePromise(responce);
                }, (error) => {
                    rejectPromise(error);
                })
        }, (error) => {
            rejectPromise(error);
        })
        return {
            tepmId: launchTempId,
            promise
        }
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
            "type": "SUITE" or one of 'SUITE', 'STORY', 'TEST', 'SCENARIO', 'STEP', 'BEFORE_CLASS', 'BEFORE_GROUPS',
            'BEFORE_METHOD', 'BEFORE_SUITE', 'BEFORE_TEST', 'AFTER_CLASS', 'AFTER_GROUPS', 'AFTER_METHOD', 'AFTER_SUITE', 'AFTER_TEST'
        }
     * @param {string} launchTempId - temp launch id (returned in the query "startLaunch").
     * @param {string} parentTempId (optional) - temp item id (returned in the query "startTestItem").
     * @Returns an object which contains a tempID and a promise
     */
    startTestItem( testItemDataRQ, launchTempId, parentTempId) {
        let parentMapId = launchTempId;
        const launchObj = this.map[launchTempId];
        if(!launchObj) {
            return this.getRejectAnsver(launchTempId, new Error('Launch "'+ launchTempId+'" not found'));
        }
        if(launchObj.finishSend) {
            return this.getRejectAnsver(launchTempId, new Error('Launch "'+ launchTempId+'" is already finished, you can not add an item to it'));
        }

        let testItemData = Object.assign({
            start_time: this.helpers.now()
        }, testItemDataRQ);

        let parentPromise = launchObj.promiseStart;
        if (parentTempId) {
            parentMapId = parentTempId;
            const parentObj = this.map[parentTempId];
            if (!parentObj) {
                return this.getRejectAnsver(launchTempId, new Error('Item "'+ parentTempId+'" not found'));
            }
            parentPromise = parentObj.promiseStart;
        }

        const tempId = this.getUniqId();
        this.map[tempId] = this.getNewItemObj((resolve, reject) => {
            parentPromise.then(() => {
                let realLaunchId = this.map[launchTempId].realId;
                let url = [this.baseURL, "item"].join("/");
                if (parentTempId) {
                    let realParentId = this.map[parentTempId].realId;
                    url += "/" + realParentId;
                }
                testItemData.launch_id = realLaunchId;
                this.debug && console.log(`Start test item ${tempId}`);
                helpers.getServerResult(url, testItemData,  {headers: this.headers}, "POST")
                    .then((responce) => {
                        this.debug && console.log(`Success start item ${tempId}`);
                        this.map[tempId].realId = responce.id;
                        resolve(responce);
                    }, (error) => {
                        this.debug && console.log(`Error start item ${tempId}:`);
                        console.dir(error);
                        reject(error);
                    })
            }, (error) => {
                reject(error);
            });
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
     * @Returns an object which contains a tempID and a promise
     */
    finishTestItem(itemTempId, finishTestItemRQ) {
        const itemObj = this.map[itemTempId];
        if(!itemObj) {
            return this.getRejectAnsver(itemTempId, new Error('Item "'+ itemTempId+'" not found'));
        }

        let finishTestItemData = Object.assign({
            end_time: this.helpers.now(),
            status: 'PASSED'
        }, finishTestItemRQ);

        itemObj.finishSend = true;
        Promise.all( itemObj.childrens.map((itemId) => { return this.map[itemId].promiseFinish; }) )
            .then(() => {
                this.cleanMap(itemObj.childrens);
                itemObj.promiseStart
                    .then( () => {
                        let url = [this.baseURL, "item", itemObj.realId].join("/");
                        this.debug && console.log(`Finish test item ${itemTempId}`);
                        helpers.getServerResult(url, finishTestItemData, {headers: this.headers}, "PUT")
                            .then((responce) => {
                                this.debug && console.log(`Success finish item ${itemTempId}`);
                                itemObj.resolveFinish(responce);
                            }, (error) => {
                                this.debug && console.log(`Error finish test item ${itemTempId}: ` );
                                console.dir(error);
                                itemObj.rejectFinish(error);
                            })
                    }, (error) => {
                        itemObj.rejectFinish(error);
                    })
            }, (error) => {
                this.cleanMap(itemObj.childrens);
                this.debug && console.log(`Error finish test item ${itemTempId}`);
                itemObj.rejectFinish(error);
            });

        return {
            tempId: itemTempId,
            promise: itemObj.promiseFinish
        };
    }
    saveLog(itemObj, requestPromiseFunc) {
        const tempId = this.getUniqId();
        this.map[tempId] = this.getNewItemObj((resolve, reject) => {
            itemObj.promiseStart.then(() => {
                this.debug && console.log(`Save log ${tempId}`);
                requestPromiseFunc(itemObj.realId).then((responce) => {
                    this.debug && console.log(`Successfuly save log ${tempId}`);
                    resolve(responce);
                }, (error) => {
                    this.debug && console.log(`Error finish log: ${error}` );
                    reject(error);
                })
            }, (error) => {
                reject(error);
            });
        });
        itemObj.childrens.push(tempId);
        let logObj = this.map[tempId];
        logObj.finishSend = true;
        logObj.promiseStart.then((responce) => {
            logObj.resolveFinish(responce);
        }, (error) => {
            logObj.rejectFinish(error);
        })
        return {
            tempId,
            promise: this.map[tempId].promiseFinish
        };
    }

    sendLog(itemTempId, saveLogRQ, fileObj) {
        let saveLogData = Object.assign({
            time: this.helpers.now(),
            message: '',
            level: ''
        }, saveLogRQ);

        if (fileObj) {
            return this.sendLogWithFile(itemTempId, saveLogData, fileObj);
        } else {
            return this.sendLogWithoutFile(itemTempId, saveLogData);
        }
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
     */
    sendLogWithoutFile(itemTempId, saveLogRQ) {
        const itemObj = this.map[itemTempId];
        if(!itemObj) {
            return this.getRejectAnsver(itemTempId, new Error('Item "'+ itemTempId+'" not found'));
        }

        let requestPromise = (id) => {
            let url = [this.baseURL, "log"].join("/");
            saveLogRQ.item_id = id;
            return helpers.getServerResult(url, saveLogRQ, {headers: this.headers}, "POST");
        }
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
          type: "image/png" or your file mimeType (support types: 'image/*', application/ ['xml', 'javascript', 'json', 'css', 'php'] , another format will be opened in a new browser tab ),
          file: file
     * }
     */
    sendLogWithFile(itemTempId, saveLogRQ, fileObj) {
        const itemObj = this.map[itemTempId];
        if(!itemObj) {
            return this.getRejectAnsver(itemTempId, new Error('Item "'+ itemTempId+'" not found'));
        }

        let requestPromise = (id) => {
            let url = [this.baseURL, "log"].join("/");
            saveLogRQ.item_id = id;
            return this.getRequestLogWithFile(saveLogRQ, fileObj);
        }
        return this.saveLog(itemObj, requestPromise);
    }

    getRequestLogWithFile(saveLogRQ, fileObj) {
        let url = [this.baseURL, "log"].join("/");
        saveLogRQ.file = {name: fileObj.name};
        return new Promise((resolve, reject) => {
            rest.post(url, {
                data:this.buildMultiPartStream([saveLogRQ], fileObj, boundary),
                headers: {
                    "Authorization": 'bearer ' + this.token,
                    "Content-Type": 'multipart/form-data; boundary=' + boundary
                }
            }).on('complete', function (data, r) {
                resolve(data);
            }).on('fail', (data, res) => {
                console.log(res.statusCode, data)
            });
        });
    }

    buildMultiPartStream(jsonPart, filePart, boundary) {
        let eol = "\r\n";
        let bx = "--" + boundary;
        let buffers = [
            new Buffer(
                bx + eol + "Content-Disposition: form-data; name=\"json_request_part\"" +
                eol + "Content-Type: application/json" + eol +
                eol + eol + JSON.stringify(jsonPart) + eol
            ),
            new Buffer(
                bx + eol + "Content-Disposition: form-data; name=\"file\"; filename=\"" + filePart.name + "\"" + eol +
                "Content-Type: " + filePart.type + eol + eol
            ),
            new Buffer(filePart.file),
            new Buffer(eol + bx + '--' + eol)
        ];
        return Buffer.concat(buffers);
    }

}

module.exports = RPClient;