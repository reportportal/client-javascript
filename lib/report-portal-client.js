let rq = require('request-promise');
let fs = require('fs');
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
    startLaunch(startLaunchRQ) {
        let url = [this.baseURL, "launch"].join("/");
        return helpers.getServerResult(url, startLaunchRQ, {headers: this.headers}, "POST");
    }

    /**
     * Update launch description.
     * @param {string} id - launch id.
     * @param {string} description - new launch description.
     */
    updateLaunchDescription(id, description) {
        let request = {
            description: description
        };
        let url = [this.baseURL, "launch",  id, 'update'].join("/");
        return helpers.getServerResult(url, request,  {headers: this.headers}, "PUT");
    }

    /**
     * Finish launch.
     * @param {string} launchID - launch id.
     * @param {Object} finishExecutionRQ - finish launch info should include time and status.
     */
    finishLaunch(launchID, finishExecutionRQ) {
        let url = [this.baseURL, "launch", launchID, "finish"].join("/");
        return helpers.getServerResult(url, finishExecutionRQ,  {headers: this.headers}, "PUT");
    }

    /**
     * If there is no parentItemId starts Suite, else starts test or item.
     * @param {Object} startTestItemRQ - object with item parameters
     * @param {string} parentItemId - parent item id.
     */
    startTestItem( startTestItemRQ, parentItemId) {
        let url;
        if (!parentItemId) {
            url = [this.baseURL, "item"].join("/");
        } else {
            url = [this.baseURL, "item", parentItemId].join("/");
        }
        return helpers.getServerResult(url, startTestItemRQ, {headers: this.headers}, "POST");
    }

    /**
     * Finish Suite or Step level.
     * @param {string} itemId - item id.
     * @param {Object}  finishTestItemRQ - object with item parameters.
     */
    finishTestItem(itemId, finishTestItemRQ) {
        let url = [this.baseURL, "item", itemId].join("/");
        return helpers.getServerResult(url, finishTestItemRQ, {headers: this.headers}, "PUT");
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
    log(saveLogRQ) {
        let url = [this.baseURL, "log"].join("/");
        return helpers.getServerResult(url, saveLogRQ, {headers: this.headers}, "POST");
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
    sendFile(saveLogRQ, fileName, fileData, mimeType) {
        let url = [this.baseURL, "log"].join("/");
        let file = {
            name: fileName,
            type: mimeType,
            content: fileData
        };
        let rq_options = {
            method: 'POST',
            uri: url,
            body: _self.buildMultiPartStream(saveLogRQ, file, boundary),
            headers: {
                "Authorization": 'bearer ' + _self.token,
                "Content-Type": 'multipart/form-data; boundary=' + boundary
            }
        }
        let response = (resolve, reject) => {
            rq(rq_options).then(function (data) {
                resolve(data);
            }).catch((err) => {
                console.log(err)
            });
        };
        return new Promise(response);
    };

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