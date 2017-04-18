'use strict';

const rest = require('restler');
const fs = require('fs');

class RPClient {

    constructor(params) {
        this.baseURL = [params.endpoint, params.project].join("/");
        this.headers = {
            "User-Agent": 'NodeJS',
            "Authorization": `bearer ${params.token}`
        };
        this.options = {
            headers: this.headers
        };
        this.token = params.token;
        this.config = params;
    }

    _formatName(name) {
        const MIN = 3;
        const MAX = 256;
        const len = name.length;
        return ((len < MIN) ? (name + new Array(MIN - len + 1).join('.')) : name).slice(-MAX);
    }

    _now() {
        return new Date().valueOf();
    }

    _getResponsePromise(url, rq, options, method) {
        let promise = new Promise((resolve, reject) => {
            if (method === "POST") {
            return rest.postJson(url, rq, options)
                .on('complete', result => {
                    if (result instanceof Error) {
                        console.error('Error:', result.message);
                    } else {
                        resolve(result);
                    }
                });
            } else if (method === "PUT") {
                return rest.putJson(url, rq, options)
                    .on('complete', result => {
                        if (result instanceof Error) {
                            console.error('Error:', result.message);
                        } else {
                            resolve(result);
                        }
                    });
            }
        }
        );
        return promise.catch(err => console.error(err));
    }

    startLaunch(startLaunchRQ) {
        const url = [this.baseURL, "launch"].join("/");
        startLaunchRQ.start_time = this._now();
        return this._getResponsePromise(url, startLaunchRQ, {headers: this.headers}, "POST");
    }

    updateLaunchDescription(id, description) {
        let request = {
            description: description
        };
        const url = [this.baseURL, "launch",  id, 'update'].join("/");
        return this._getResponsePromise(url, request,  {headers: this.headers}, "PUT");
    }

    finishLaunch(launchID, finishExecutionRQ) {
        const url = [this.baseURL, "launch", launchID, "finish"].join("/");
        finishExecutionRQ.end_time = this._now();
        return this._getResponsePromise(url, finishExecutionRQ,  {headers: this.headers}, "PUT");
    }


    startTestItem(startTestItemRQ, parentItemId) {
        let url;
        if (!parentItemId) {
            url = [this.baseURL, "item"].join("/");
        } else {
            url = [this.baseURL, "item", parentItemId].join("/");
        }
        startTestItemRQ.start_time = this._now();
        return this._getResponsePromise(url, startTestItemRQ, {headers: this.headers}, "POST");
    }

    finishTestItem(itemId, finishTestItemRQ) {
        const url = [this.baseURL, "item", itemId].join("/");
        finishTestItemRQ.end_time = this._now();
        return this._getResponsePromise(url, finishTestItemRQ, {headers: this.headers}, "PUT");
    }

    log(saveLogRQ) {
        const url = [this.baseURL, "log"].join("/");
        return this._getResponsePromise(url, saveLogRQ, {headers: this.headers}, "POST");
    }

    sendFile(saveLogRQ, fileName, fileData, mimeType) {
        const url = [this.baseURL, "log"].join("/");
        let promise = new Promise((resolve, reject) => {
            const boundary = Math.floor(Math.random() * 1e10).toString();
            let file = {
                name: fileName,
                type: mimeType,
                content: fileData
            };
            rest.postJson(url, {
                data: this.buildMultiPartStream(saveLogRQ, file, boundary),
                headers: {
                    "Authorization": 'bearer ' + this.token,
                    "Content-Type": 'multipart/form-data; boundary=' + boundary
                }
            }).on('complete', result => {
                    if (result instanceof Error) {
                        console.error('Error:', result.message);
                    } else {
                        resolve(result);
                    }
                });
        });
        return promise.catch(err => console.error(err));
    };

    buildMultiPartStream(jsonPart, filePart, boundary) {
        const eol = "\r\n";
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
