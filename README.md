# ReportPortal js client
This Client is to communicate with the Report Portal on node js.

Library is used only for implementors of custom listeners for ReportPortal.

## Already implemented listeners:
* [Jest integration](https://github.com/reportportal/agent-js-jest)
* [Cypress integration](https://github.com/reportportal/agent-js-cypress)
* [Mocha integration](https://github.com/reportportal/agent-js-mocha)
* [Jasmine integration](https://github.com/reportportal/agent-js-jasmine)
* [Nightwatch integration](https://github.com/reportportal/agent-js-nightwatch)
* [Cucumber integration](https://github.com/reportportal/agent-js-cucumber)
* [Codecept integration](https://github.com/reportportal/agent-js-codecept)
* [Postman integration](https://github.com/reportportal/agent-js-postman)

Examples for test framework integrations from the list above described in [examples](https://github.com/reportportal/examples-js) repository.

## Installation
The latest version is available on npm:
```cmd
npm install @reportportal/client-javascript
```

## Example

```javascript
let RPClient = require('@reportportal/client-javascript');

let rpClient = new RPClient({
    token: "00000000-0000-0000-0000-000000000000",
    endpoint: "http://your-instance.com:8080/api/v1",
    launch: "LAUNCH_NAME",
    project: "PROJECT_NAME"
});

rpClient.checkConnect().then((response) => {
    console.log('You have successfully connected to the server.');
    console.log(`You are using an account: ${response.fullName}`);
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
launch    | Name of launch at creation.
project   | The name of the project in which the launches will be created.
headers   | (optional) The object with custom headers for internal http client
restClientConfig | (optional) The object with `agent` property for configure [http(s)](https://nodejs.org/api/https.html#https_https_request_url_options_callback) client

## Api
Each method (except checkConnect) returns an object in a specific format:
```javascript
{
    tempId: '4ds43fs', // generated by the client id for further work with the created item
    promise: Promise // An object indicating the completion of an operation
}
```
The client works synchronously, so it is not necessary to wait for the end of the previous requests to send following ones.

## Asynchronous reporting
The client supports an asynchronous reporting.
If you want the client to work asynchronously change v1 to v2 in addresses in endpoint

### checkConnect
 checkConnect - asynchronous method for verifying the correctness of the client connection
```javascript
rpClient.checkConnect().then((response) => {
    console.log('You have successfully connected to the server.');
    console.log(`You are using an account: ${response.fullName}`);
}, (error) => {
    console.log('Error connection to server');
    console.dir(error);
});
```

### timeout (5000ms) on axios requests
There is a timeout on axios requests. If for instance the server your making a request to is taking too long to load, then axios timeout will work and you will see the error "Error: timeout of 5000ms exceeded".

### startLaunch
startLaunch - starts a new launch, return temp id that you want to use for all of the items within this launch.
```javascript
let launchObj = rpClient.startLaunch({
    name: "Client test",
    startTime: rpClient.helpers.now(),
    description: "description of the launch",
    attributes: [
        {
            "key": "yourKey",
            "value": "yourValue"
        },
        {
            "value": "yourValue"
        }
    ],
    //this param used only when you need client to send data into the existing launch
    id: 'id'
});
console.log(launchObj.tempId);
```
The method takes one argument:
* launch data object:

Parameter | Description
--------- | -----------
startTime | (optional) start time launch(unix time). Default: rpClient.helpers.now()
name      | (optional) launch name. Default: parameter 'launch' specified when creating the client instance
mode      | (optional) "DEFAULT" or "DEBUG". Default: "DEFAULT"
description | (optional) description of the launch (supports markdown syntax)
attributes  | (optional) array of launch tags
id        | id of the existing launch in which tests data would be sent, without this param new launch instance would be created

To know the real launch id wait for the method to finish. The real id is used by the client in asynchronous reporting.
```javascript
let launchObj = rpClient.startLaunch();
launchObj.promise.then((response) => {
    console.log(`Launch real id: ${response.id}`);
}, (error) => {
    console.dir(`Error at the start of launch: ${error}`);
})
```
As system attributes, this method sends the following data (these data are not for public use):
 * client name, version;
 * agent name, version (if given);
 * browser name, version (if given);
 * OS type, architecture;
 * RAMSize;
 * nodeJS version;

ReportPortal is supporting now integrations with more than 15 test frameworks simultaneously. In order to define the most popular agents and plan the team workload accordingly, we are using Google analytics.

ReportPortal collects only information about agent name and version. This information is sent to Google analytics on the launch start. Please help us to make our work effective.
If you still want to switch Off Google analytics, please change env variable.
'REPORTPORTAL_CLIENT_JS_NO_ANALYTICS=true'

### finishLaunch
finishLaunch - finish of the launch. After calling this method, you can not add items to the launch.
The request to finish the launch will be sent only after all items within it have finished.
```javascript
// launchObj - object returned by method 'startLaunch'
let launchFinishObj = rpClient.finishLaunch(launchObj.tempId, {
    endTime: rpClient.helpers.now()
});
```
The method takes two arguments:
* id launch (returned by method 'startLaunch')
* data object:

Parameter | Description
--------- | -----------
endTime  | (optional) end time of launch. Default: rpClient.helpers.now()
status    | (optional) status of launch, one of "", "PASSED", "FAILED", "STOPPED", "SKIPPED", "INTERRUPTED", "CANCELLED".

### getPromiseFinishAllItems
getPromiseFinishAllItems - returns promise that contains status about all data has been sent to the Report Protal.
This method needed when test frameworks don't wait for async methods and stop processed.

```javascript
// jasmine example. tempLaunchId - id of the client's process
agent.getPromiseFinishAllItems(agent.tempLaunchId).then(()=> done());
```
Parameter       | Description
--------- | -----------
tempLaunchId    | id of the client's process

### updateLaunch
updateLaunch - updates launch data. Will send a request to the server only after finishing the launch.
```javascript
// launchObj - object returned by method 'startLaunch'
rpClient.updateLaunch(
    launchObj.tempId, {
        description: 'new launch description',
        attributes: [
            {
                "key": "yourKey",
                "value": "yourValue"
            },
            {
                "value": "yourValue"
            }
        ],
        mode: 'DEBUG'
    }
);
```
The method takes two arguments:
* id launch (returned by method 'startLaunch')
* data object - may contain the following fields: description, tags, mode. These fields can be looked up in the method "startLaunch".

### startTestItem
startTestItem - starts a new test item.
```javascript
// launchObj - object returned by method 'startLaunch'
let suiteObj = rpClient.startTestItem({
        description: makeid(),
        name: makeid(),
        startTime: rpClient.helpers.now(),
        type: "SUITE"
    }, launchObj.tempId);
let stepObj = rpClient.startTestItem({
        description: makeid(),
        name: makeid(),
        startTime: rpClient.helpers.now(),
        attributes: [

            {
                "key": "yourKey",
                "value": "yourValue"
            },
            {
                "value": "yourValue"
            }
        ],
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
startTime  | (optional) start time item(unix time). Default: rpClient.helpers.now()
attributes        | (optional) array of item attributes

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
endTime  | (optional) end time of launch. Default: rpClient.helpers.now()
status    | (optional) item status, one of "", "PASSED", "FAILED", "STOPPED", "SKIPPED", "INTERRUPTED", "CANCELLED". Default: "PASSED".
issue     | (optional) object issue. IssueType is required, allowable values: "pb***", "ab***", "si***", "ti***", "nd001". Where *** is locator id

Example issue object:
```
{
    issueType: "string",
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
The method takes three arguments:
* id item (returned by method 'startTestItem')
* data object:

Parameter | Description
--------- | -----------
time      | (optional) time of log. Default: rpClient.helpers.now()
message   | (optional) log message. Default: ''.
status    | (optional) log status, one of 'trace', 'debug', 'info', 'warn', 'error', ''. Default "".

* file object (optional):

Parameter | Description
--------- | -----------
name      | file name
type      | file mimeType, example "image/png" (support types: 'image/*', application/ ['xml', 'javascript', 'json', 'css', 'php'] , another format will be opened in a new browser tab ),
content   | file

# Copyright Notice
Licensed under the [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0.html)
license (see the LICENSE.txt file).
