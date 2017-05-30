'use strict';

var rest = require('restler');
var fs = require('fs');


class RPClient {
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
    }
    _formatName(name) {
        var MIN = 3;
        var MAX = 256;
        var len = name.length;
        return ((len < MIN) ? (name + new Array(MIN - len + 1).join('.')) : name).slice(-MAX);
    }

    _now() {
        return new Date().valueOf();
    }

    _getResponsePromise(url, rq, options, method) {
        var response = function (resolve, reject) {
            rest.json(url, rq, options, method)
                .on("success", function (data) {
                    resolve(data);
                })
                .on("fail", function (data) {
                    reject(data);
                })
                .on("error", function (data) {
                    reject(data);
                });
        };
        return new Promise(response);
    }

    startLaunch(startLaunchRQ) {
        var url = [this.baseURL, "launch"].join("/");
        return this._getResponsePromise(url, startLaunchRQ, {headers: this.headers}, "POST");
    }
    updateLaunchDescription(id, description) {
        var request = {
            description: description
        };
        var url = [this.baseURL, "launch",  id, 'update'].join("/");
        return this._getResponsePromise(url, request,  {headers: this.headers}, "PUT");
    }

    finishLaunch(launchID, finishExecutionRQ) {
        var url = [this.baseURL, "launch", launchID, "finish"].join("/");
        return this._getResponsePromise(url, finishExecutionRQ,  {headers: this.headers}, "PUT");
    }


    startTestItem( startTestItemRQ, parentItemId) {
        var url;
        if (!parentItemId) {
            url = [this.baseURL, "item"].join("/");
        } else {
            url = [this.baseURL, "item", parentItemId].join("/");
        }
        return this._getResponsePromise(url, startTestItemRQ, {headers: this.headers}, "POST");
    }


    finishTestItem(itemId, finishTestItemRQ) {
        var url = [this.baseURL, "item", itemId].join("/");
        return this._getResponsePromise(url, finishTestItemRQ, {headers: this.headers}, "PUT");
    }

    log(saveLogRQ) {
        var url = [this.baseURL, "log"].join("/");
        return this._getResponsePromise(url, saveLogRQ, {headers: this.headers}, "POST");
    }

    sendFile(saveLogRQ, fileName, fileData, mimeType) {
        var url = [this.baseURL, "log"].join("/");
        var _self = this;
        var response = function (resolve, reject) {
            var boundary = Math.floor(Math.random() * 10000000000).toString();
            var file = {
                name: fileName,
                type: mimeType,
                content: fileData
            };
            rest.post(url, {
                data: _self.buildMultiPartStream([saveLogRQ], file, boundary),
                headers: {
                    "Authorization": 'bearer ' + _self.token,
                    "Content-Type": 'multipart/form-data; boundary=' + boundary
                }
            }).on('complete', function (data, r) {
                resolve(data);
            }).on('fail', (data, res) => {
                console.log(res.statusCode, data)
        });
        };
        return new Promise(response);
    };

    buildMultiPartStream(jsonPart, filePart, boundary) {
        var eol = "\r\n";
        var bx = "--" + boundary;
        var buffers = [
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