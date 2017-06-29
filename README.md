[![Build Status](https://travis-ci.org/reportportal/client-javascript.svg?branch=master)](https://travis-ci.org/reportportal/client-javascript)[![Code Coverage](https://codecov.io/gh/reportportal/client-javascript/branch/master/graph/badge.svg)](https://codecov.io/gh/reportportal/client-javascript)[![npm version](https://badge.fury.io/js/reportportal-client.svg)](https://badge.fury.io/js/reportportal-client)

#ReportPortal js client 
Client to communicate with the Report Portal on node js.

Library used only for implementors of custom listeners for ReportPortal.

## Allready implemented listeners:
* EMPTY


## Installation
The latest version is available on npm:
```cmd
npm install reportportal-client
```
    


## Example

```javascript
let RPClient = require('reportportal-client');

let rpClient = new RPClient({
    token: "00000000-0000-0000-0000-000000000000",
    endpoint: "http://your-instance.com:8080/api/v1",
    launch: "LAUNCH_NAME",
    project: "PROJECT_NAME"
});

rpClient.checkConnect().then((responce) => {
    console.log('You have successfully connected to the server.');
    console.log(`You are using an account: ${responce.full_name}`);
}, (error) => {
    console.log('Error connection to server');
    console.dir(error);
});
```

## Settings
When creating a client instance, you need to specify the following parameters:

Parameter | Description
--------- | -----------
token     | user's token Report Portal from which you want to send requests. It can be found on the profile page of this user.
endpoint  | URL of your server. For example, if you visit the page at 'https://server:8080/ui', then endpoint will be equal to 'https://server:8080/api/v1'.
launch    | Name of lunch at creation.
project   | The name of the project in which the lunches will be created.

## Api
Each method (except checkConnect) returns an object of a specific format:
```javascript
{
    tempId: '4ds43fs', // generated by the client id for further work with the created item
    promise: Promise // An object indicating the completion of an operation
}
```
The client works synchronously, so to send the following requests it is not necessary to wait for the end of previous ones.

### checkConnect
 checkConnect - asynchronous method for verifying the correct connection of the client
```javascript
rpClient.checkConnect().then((responce) => {
    console.log('You have successfully connected to the server.');
    console.log(`You are using an account: ${responce.full_name}`);
}, (error) => {
    console.log('Error connection to server');
    console.dir(error);
});
```

### startLaunch
startLaunch - starts a new launch, return temp id that you want to use for all items within this lunch.
```javascript
let launchObj = rpClient.startLaunch({
    name: "Client test",
    start_time: rpClient.helpers.now(),
    description: "description of the launch",
    tags: ["tag1", "tag2"]
});
console.log(launchObj.tempId);
```
The method takes one argument:
* launch data object:

Parameter | Description
--------- | -----------
start_time | (optional) start time launch(unix time). Default: rpClient.helpers.now()
name      | (optional) lunch name. Default: parameter 'launch' specified when creating the client instance
mode      | (optional) "DEFAULT" or "DEBUG". Default: "DEFAULT"
description | (optional) description of the launch (supports markdown syntax)
tags      | (optional) array of launch tags

If you want to know the real id launch, wait for the method to finish (the real id does not participate in the client's work)
```javascript
let launchObj = rpClient.startLaunch();
launchObj.promise.then((responce) => {
    console.log(`Launch real id: ${responce.id}`);
}, (error) => {
    console.dir(`Error at the start of lunch: ${error}`);
})
```

### finishLaunch
finishLaunch - finish of the launch. After calling this method, you can not add items to the launch.
The request to finish the lunch will be sent only after all items within it have finished.
```javascript
// launchObj - object returned by method 'startLaunch'
let launchFinishObj = rpClient.finishLaunch(launchObj.tempId, {
    end_time: rpClient.helpers.now()
});
```
The method takes two arguments:
* id launch (returned by method 'startLaunch')
* data object:

Parameter | Description
--------- | -----------
end_time  | (optional) end time of lunch. Default: rpClient.helpers.now()
status    | (optional) status launch, one of "", "PASSED", "FAILED", "STOPPED", "SKIPPED", "RESTED", "CANCELLED". Default: "".

### updateLaunch
updateLaunch - updates lunch data. Will send a request to the server only after finishing the lunch.
```javascript
// launchObj - object returned by method 'startLaunch'
rpClient.updateLaunch(
    launchObj.tempId, {
        description: 'new launch description',
        tags: ['new_tag1', 'new_tag2'],
        mode: 'DEBUG'
    }
);
```
The method takes two arguments:
* id launch (returned by method 'startLaunch')
* data object - can contain the following fields: description, tags, mode. These fields can be looked up in the method "startLaunch".

### startTestItem
startTestItem - starts a new test item.
```javascript
// launchObj - object returned by method 'startLaunch'
let suiteObj = rpClient.startTestItem({
        description: makeid(),
        name: makeid(),
        start_time: rpClient.helpers.now(),
        type: "SUITE"
    }, launchObj.tempId);
let stepObj = rpClient.startTestItem({
        description: makeid(),
        name: makeid(),
        start_time: rpClient.helpers.now(),
        tags: ['step_tag', 'step_tag2', 'step_tag3'],
        type: "STEP"
    }, launchObj.tempId, suiteObj.tempId);

```
The method takes three arguments:
* test item data object:

Parameter       | Description
--------- | -----------
name        | item name
type        | Item type, one of 'SUITE', 'STORY', 'TEST', 'SCENARIO', 'STEP', 'BEFORE_CLASS', 'BEFORE_GROUPS','BEFORE_METHOD', 'BEFORE_SUITE', 'BEFORE_TEST', 'AFTER_CLASS', 'AFTER_GROUPS', 'AFTER_METHOD', 'AFTER_SUITE', 'AFTER_TEST'
description | (optional) description of the launch (supports markdown syntax)
start_time  | (optional) start time item(unix time). Default: rpClient.helpers.now()
tags        | (optional) array of item tags

* id launch (returned by method 'startLaunch')
* id parent item (optional) (returned by method 'startTestItem')


### finishTestItem
finishTestItem -  finish of the item. After calling this method, you can not add items to the item.
The request to finish the item will be sent only after all items within it have finished.
```javascript
// itemObj - object returned by method 'startTestItem'
rpClient.finishTestItem(itemObj.tempId, {
    status: "failed"
})
```
The method takes two arguments:
* id item (returned by method 'startTestItem')
* data object:

Parameter | Description
--------- | -----------
end_time  | (optional) end time of lunch. Default: rpClient.helpers.now()
status    | (optional) status launch, one of "", "PASSED", "FAILED", "STOPPED", "SKIPPED", "RESTED", "CANCELLED". Default: "PASSED".
issue     | (optional) object issue 

Example issue object:
```
{
    comment: "string",
    externalSystemIssues: [
        {
            submitDate: 0,
            submitter: "string",
            systemId: "string",
            ticketId: "string",
            url: "string"
        }
    ]
}
```

### sendLog
sendLog - adds a log to the item
```javascript
// stepObj - object returned by method 'startTestItem'
rpClient.sendLog(stepObj.tempId, {
    level: "INFO",
    message: makeid(),
    time: rpClient.helpers.now()
})
```
The method takes two arguments:
* id item (returned by method 'startTestItem')
* data object:

Parameter | Description
--------- | -----------
time      | (optional) time of log. Default: rpClient.helpers.now()
message   | (optional) message log. Default: ''.
status    | (optional) status log, one of 'trace', 'debug', 'info', 'warn', 'error', ''. Default "".

* file object (optional):

Parameter | Description
--------- | -----------
name      | file name
type      | file mimeType, example "image/png" (support types: 'image/*', application/ ['xml', 'javascript', 'json', 'css', 'php'] , another format will be opened in a new browser tab ),
content   | file

# Copyright Notice
Licensed under the [GPLv3](https://www.gnu.org/licenses/quick-guide-gplv3.html)
license (see the LICENSE.txt file).