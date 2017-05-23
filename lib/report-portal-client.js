'use strict';

var rq = require('request-promise');
var fs = require('fs');
var helpers = require('./helpers');
var boundary = Math.floor(Math.random() * 10000000000).toString();

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

    startLaunch(startLaunchRQ) {
        var url = [this.baseURL, "launch"].join("/");
        return helpers.getServerResult(url, startLaunchRQ, {headers: this.headers}, "POST");
    }
    updateLaunchDescription(id, description) {
        var request = {
            description: description
        };
        var url = [this.baseURL, "launch",  id, 'update'].join("/");
        return helpers.getServerResult(url, request,  {headers: this.headers}, "PUT");
    }

    finishLaunch(launchID, finishExecutionRQ) {
        var url = [this.baseURL, "launch", launchID, "finish"].join("/");
        return helpers.getServerResult(url, finishExecutionRQ,  {headers: this.headers}, "PUT");
    }


    startTestItem( startTestItemRQ, parentItemId) {
        var url;
        if (!parentItemId) {
            url = [this.baseURL, "item"].join("/");
        } else {
            url = [this.baseURL, "item", parentItemId].join("/");
        }
        return helpers.getServerResult(url, startTestItemRQ, {headers: this.headers}, "POST");
    }


    finishTestItem(itemId, finishTestItemRQ) {
        var url = [this.baseURL, "item", itemId].join("/");
        return helpers.getServerResult(url, finishTestItemRQ, {headers: this.headers}, "PUT");
    }

    log(saveLogRQ) {
        var url = [this.baseURL, "log"].join("/");
        return helpers.getServerResult(url, saveLogRQ, {headers: this.headers}, "POST");
    }

    sendFile(saveLogRQ, fileName, fileData, mimeType) {
        var url = [this.baseURL, "log"].join("/");
        var file = {
            name: fileName,
            type: mimeType,
            content: fileData
        };
        var rq_options = {
            method: 'POST',
            uri: url,
            body: _self.buildMultiPartStream(saveLogRQ, file, boundary),
            headers: {
                "Authorization": 'bearer ' + _self.token,
                "Content-Type": 'multipart/form-data; boundary=' + boundary
            }
        }
        var response = (resolve, reject) => {
            rq(rq_options).then(function (data) {
                resolve(data);
            }).catch((err) => {
                console.log(err)
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