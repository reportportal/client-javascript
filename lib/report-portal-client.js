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

    /**
     * Start launch and report it.
     * @param {Object} startLaunchRQ - request object.
     * startLaunchRQ should look like this
     * {
     *      description: 'launch description',
     *      name: 'launch name',
     *      start_time: 'this.helper.now'
     * }
     */
    startLaunch(launchData) {
        const tempId = this.getUniqId();
        this.map[tempId] = this.getNewItemObj((resolve, reject) => {
            const url = [this.baseURL, "launch"].join("/");
            this.debug && console.log(`Start launch ${tempId}`);
            helpers.getServerResult(url, launchData, {headers: this.headers}, "POST")
                .then((responce) => {
                    this.map[tempId].realId = responce.id;
                    resolve(responce);
                }, (error) => { console.dir(error); reject();})
        });
        return {
            tempId,
            promise: this.map[tempId].promiseStart
        };
    }
    /**
     * Finish launch.
     * @param {string} launchID - launch id.
     * @param {Object} finishExecutionRQ - finish launch info should include time and status.
     */
    finishLaunch(launchTempId, finishExecutionRQ) {
        const launchObj = this.map[launchTempId];
        if(!launchObj) {
            return this.getRejectAnsver(launchTempId, new Error('Launch "'+ launchTempId+'" not found'));
        }
        launchObj.finishSend = true;
        Promise.all( launchObj.childrens.map((itemId) => { return this.map[itemId].promiseFinish; }) )
            .then(() => {
                launchObj.promiseStart
                    .then( () => {
                        let url = [this.baseURL, "launch", launchObj.realId, "finish"].join("/");
                        this.debug && console.log(`Finish launch ${launchTempId}`);
                        helpers.getServerResult(url, finishExecutionRQ,   {headers: this.headers}, "PUT")
                            .then((responce) => {
                                launchObj.resolveFinish(responce);
                            }, (error) => {
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


    /**
     * Update launch.
     * @param {string} launchTempId - launch id.
     * @param {string} data - new launch data {
            "description": "string",
            "mode": "DEFAULT",
            "tags": [
            "string"
        ]}.
     */
    updateLaunch(launchTempId, data) {
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
            helpers.getServerResult(url, data,   {headers: this.headers}, "PUT")
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
     * @param {Object} startTestItemRQ - object with item parameters
     * @param {string} parentItemId - parent item id.
     */
    startTestItem( testItemData, launchTempId, parentTempId) {
        let parentMapId = launchTempId;
        const launchObj = this.map[launchTempId];
        if(!launchObj) {
            return this.getRejectAnsver(launchTempId, new Error('Launch "'+ launchTempId+'" not found'));
        }
        if(launchObj.finishSend) {
            return this.getRejectAnsver(launchTempId, new Error('Launch "'+ launchTempId+'" is already finished, you can not add an item to it'));
        }
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
                        this.map[tempId].realId = responce.id;
                        resolve(responce);
                    }, (error) => { reject(error); })
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
     * @param {string} itemId - item id.
     * @param {Object}  finishTestItemRQ - object with item parameters.
     */
    finishTestItem(itemTempId, finishTestItemRQ) {
        const itemObj = this.map[itemTempId];
        if(!itemObj) {
            return this.getRejectAnsver(itemTempId, new Error('Item "'+ itemTempId+'" not found'));
        }
        itemObj.finishSend = true;
        Promise.all( itemObj.childrens.map((itemId) => { return this.map[itemId].promiseFinish; }) )
            .then(() => {
                this.cleanMap(itemObj.childrens);
                itemObj.promiseStart
                    .then( () => {
                        let url = [this.baseURL, "item", itemObj.realId].join("/");
                        this.debug && console.log(`Finish test item ${itemTempId}`);
                        helpers.getServerResult(url, finishTestItemRQ, {headers: this.headers}, "PUT")
                            .then((responce) => {
                                itemObj.resolveFinish(responce);
                            }, (error) => {
                                this.debug && console.log(`Error finish test item ${itemTempId}: ${error}` );
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
        this.debug && console.log(`Save log ${tempId}`);
        this.map[tempId] = this.getNewItemObj((resolve, reject) => {
            itemObj.promiseStart.then(() => {
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
    /**
     * Send log of test results.
     * @param {Object} saveLogRQ - object with data of test result.
     * {
     *      item_id: 'string',
     *      level: 'error',
     *      message: 'string',
     *      time: 'this.helpers.now()'
     * }
     */
    sendLog(itemTempId, saveLogRQ) {
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


    /**
     * Send log of test results.
     * @param {Object}  saveLogRQ - object with data of test result.
     * {
     *      item_id: 'string',
     *      level: 'error',
     *      message: 'string',
     *      time: 'this.helpers.now()'
     * }
     * @param {string}  fileName - name of attached file.
     * @param {string}  mimeType - type of sending file.
     */
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

    /**
     * Form body of http request with multipart data
     * @param {Object}  saveLogRequest - object with data of test result.
     * {
     *      item_id: 'string',
     *      level: 'error',
     *      message: 'string',
     *      time: 'this.helpers.now()'
     * }
     * @param {string}  fileName - name of attached file.
     * @param {string}  mimeType - type of sending file.
     */
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
            new Buffer(filePart.content, 'base64'),
            new Buffer(eol + bx + '--' + eol)
        ];
        return Buffer.concat(buffers);
    }

}

module.exports = RPClient;