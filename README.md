# ReportPortal js client

This Client is to communicate with the Report Portal on Node.js.

Library is used only for implementors of custom listeners for ReportPortal.

## Already implemented listeners:

* [Playwright integration](https://github.com/reportportal/agent-js-playwright)
* [Cypress integration](https://github.com/reportportal/agent-js-cypress)
* [Jest integration](https://github.com/reportportal/agent-js-jest)
* [Mocha integration](https://github.com/reportportal/agent-js-mocha)
* [Webdriverio integration](https://github.com/reportportal/agent-js-webdriverio)
* [Postman integration](https://github.com/reportportal/agent-js-postman)
* [Cucumber integration](https://github.com/reportportal/agent-js-cucumber)
* [Vitest integration](https://github.com/reportportal/agent-js-vitest)
* [Jasmine integration](https://github.com/reportportal/agent-js-jasmine)
* [TestCafe integration](https://github.com/reportportal/agent-js-testcafe)
* [Codecept integration](https://github.com/reportportal/agent-js-codecept)
* [Nightwatch integration](https://github.com/reportportal/agent-js-nightwatch)

Examples for test framework integrations from the list above described in [examples](https://github.com/reportportal/examples-js) repository.

## Installation

The latest version is available on npm:
```cmd
npm install @reportportal/client-javascript
```

## Usage example

```javascript
const RPClient = require('@reportportal/client-javascript');

const rpClient = new RPClient({
    apiKey: 'reportportalApiKey',
    endpoint: 'http://your-instance.com:8080/api/v1',
    launch: 'LAUNCH_NAME',
    project: 'PROJECT_NAME'
});

rpClient.checkConnect().then((response) => {
    console.log('You have successfully connected to the server.');
    console.log(`You are using an account: ${response.fullName}`);
}, (error) => {
    console.log('Error connection to server');
    console.dir(error);
});
```

## Configuration

When creating a client instance, you need to specify the following options:

| Option                | Necessity  | Default  | Description                                                                                                                                                                                                                                                                                                                     |
|-----------------------|------------|----------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| apiKey                | Required   |          | User's reportportal token from which you want to send requests. It can be found on the profile page of this user.                                                                                                                                                                                                               |
| endpoint              | Required   |          | URL of your server. For example, if you visit the page at 'https://server:8080/ui', then endpoint will be equal to 'https://server:8080/api/v1'.                                                                                                                                                                                |
| launch                | Required   |          | Name of the launch at creation.                                                                                                                                                                                                                                                                                                 |
| project               | Required   |          | The name of the project in which the launches will be created.                                                                                                                                                                                                                                                                  |
| headers               | Optional   | {}       | The object with custom headers for internal http client.                                                                                                                                                                                                                                                                        |
| debug                 | Optional   | false    | This flag allows seeing the logs of the client. Useful for debugging.                                                                                                                                                                                                                                                           |
| isLaunchMergeRequired | Optional   | false    | Allows client to merge launches into one at the end of the run via saving their UUIDs to the temp files at filesystem. At the end of the run launches can be merged using `mergeLaunches` method. Temp file format: `rplaunch-${launch_uuid}.tmp`.                                                                              |
| restClientConfig      | Optional   | Not set  | `axios` like http client [config](https://github.com/axios/axios#request-config). May contain `agent` property for configure [http(s)](https://nodejs.org/api/https.html#https_https_request_url_options_callback) client, and other client options eg. `timeout`. For debugging and displaying logs you can set `debug: true`. |
| launchUuidPrint       | Optional   | false    | Whether to print the current launch UUID.                                                                                                                                                                                                                                                                                       |
| launchUuidPrintOutput | Optional   | 'STDOUT' | Launch UUID printing output. Possible values: 'STDOUT', 'STDERR', 'FILE', 'ENVIRONMENT'. Works only if `launchUuidPrint` set to `true`. File format: `rp-launch-uuid-${launch_uuid}.tmp`. Env variable: `RP_LAUNCH_UUID`.                                                                                                       |
| token                 | Deprecated | Not set  | Use `apiKey` instead.                                                                                                                                                                                                                                                                                                           |

## Asynchronous reporting

The client supports an asynchronous reporting (via the ReportPortal asynchronous API).
If you want the client to report through the asynchronous API, change `v1` to `v2` in the `endpoint` address.

## API

Each method (except checkConnect) returns an object in a specific format:
```javascript
{
    tempId: '4ds43fs', // generated by the client id for further work with the created item
    promise: Promise // An object indicating the completion of an operation
}
```
The client works synchronously, so it is not necessary to wait for the end of the previous requests to send following ones.

### Timeout (30000ms) on axios requests

There is a timeout on axios requests. If for instance the server your making a request to is taking too long to load, then axios timeout will work and you will see the error 'Error: timeout of 30000ms exceeded'.

You can simply change this timeout by adding a `timeout` property to `restClientConfig` with your desired numeric value (in _ms_) or *0* to disable it.

### checkConnect

 `checkConnect` - asynchronous method for verifying the correctness of the client connection

```javascript
rpClient.checkConnect().then((response) => {
    console.log('You have successfully connected to the server.');
    console.log(`You are using an account: ${response.fullName}`);
}, (error) => {
    console.log('Error connection to server');
    console.dir(error);
});
```

### startLaunch

`startLaunch` - starts a new launch, return temp id that you want to use for the all items within this launch.

```javascript
const launchObj = rpClient.startLaunch({
    name: 'Client test',
    startTime: rpClient.helpers.now(),
    description: 'description of the launch',
    attributes: [
        {
            'key': 'yourKey',
            'value': 'yourValue'
        },
        {
            'value': 'yourValue'
        }
    ],
    //this param used only when you need client to send data into the existing launch
    id: 'id'
});
console.log(launchObj.tempId);
```
The method takes one argument:
* launch data object:

| Option      | Necessity | Default                                                        | Description                                                                                                        |
|-------------|-----------|----------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------|
| startTime   | Optional  | rpClient.helpers.now()                                         | Start time of the launch (Unix Epoch time, see [time format](#time-format)).                                                                  |
| name        | Optional  | parameter 'launch' specified when creating the client instance | Name of the launch.                                                                                                |
| mode        | Optional  | 'DEFAULT'                                                      | 'DEFAULT' - results will be submitted to Launches page, 'DEBUG' - results will be submitted to Debug page.         |
| description | Optional  | ''                                                             | Description of the launch (supports markdown syntax).                                                              |
| attributes  | Optional  | []                                                             | Array of launch attributes (tags).                                                                                 |
| id          | Optional  | Not set                                                        | `ID` of the existing launch in which tests data would be sent, without this param new launch instance will be created. |

To get the real launch `ID` (also known as launch `UUID` from database) wait for the returned promise to finish.

```javascript
const launchObj = rpClient.startLaunch();
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

ReportPortal is supporting now integrations with more than 15 test frameworks simultaneously.
In order to define the most popular agents and plan the team workload accordingly, we are using Google Analytics.

ReportPortal collects only information about agent name, version and version of Node.js. This information is sent to Google Analytics on the launch start.
Please help us to make our work effective.
If you still want to switch Off Google Analytics, please change env variable.
'REPORTPORTAL_CLIENT_JS_NO_ANALYTICS=true'

### finishLaunch

`finishLaunch` - finish of the launch. After calling this method, you can not add items to the launch.
The request to finish the launch will be sent only after all items within it have finished.

```javascript
// launchObj - object returned by method 'startLaunch'
const launchFinishObj = rpClient.finishLaunch(launchObj.tempId, {
    endTime: rpClient.helpers.now()
});
```

The method takes two arguments:
* launch `tempId` (returned by the method `startLaunch`)
* data object:

|Option | Necessity | Default | Description                                                                                        |
|--------- |-----------|---------|----------------------------------------------------------------------------------------------------|
|endTime  | Optional  | rpClient.helpers.now() | End time of the launch (Unix Epoch time, see [time format](#time-format)).                         |
|status    | Optional   | '' | Status of launch, one of '', 'PASSED', 'FAILED', 'STOPPED', 'SKIPPED', 'INTERRUPTED', 'CANCELLED'. |

### getPromiseFinishAllItems

`getPromiseFinishAllItems` - returns promise that contains status about all data has been sent to the reportportal.
This method needed when test frameworks don't wait for async methods until finished.

```javascript
// jasmine example. tempLaunchId - tempId of the launch started by the current client process
agent.getPromiseFinishAllItems(agent.tempLaunchId).then(() => done());
```

| Option       | Necessity | Default | Description                |
|--------------|-----------|---------|----------------------------|
| tempLaunchId | Required  |         | `tempId` of the launch started by the current client process |

### updateLaunch

`updateLaunch` - updates the launch data. Will send a request to the server only after finishing the launch.

```javascript
// launchObj - object returned by method 'startLaunch'
rpClient.updateLaunch(
    launchObj.tempId,
  {
        description: 'new launch description',
        attributes: [
            {
                key: 'yourKey',
                value: 'yourValue'
            },
            {
                value: 'yourValue'
            }
        ],
        mode: 'DEBUG'
    }
);
```
The method takes two arguments:
* launch `tempId` (returned by the method 'startLaunch')
* data object - may contain the following fields: `description`, `attributes`, `mode`. These fields can be looked up in the method `startLaunch`.

### startTestItem

`startTestItem` - starts a new test item.

```javascript
// launchObj - object returned by method 'startLaunch'
const suiteObj = rpClient.startTestItem({
        description: makeid(),
        name: makeid(),
        startTime: rpClient.helpers.now(),
        type: 'SUITE'
    }, launchObj.tempId);
const stepObj = rpClient.startTestItem({
        description: makeid(),
        name: makeid(),
        startTime: rpClient.helpers.now(),
        attributes: [

            {
                key: 'yourKey',
                value: 'yourValue'
            },
            {
                value: 'yourValue'
            }
        ],
        type: 'STEP'
    }, launchObj.tempId, suiteObj.tempId);

```
The method takes three arguments:
* test item data object:

|Option | Necessity | Default                | Description                                                                                                                                                                                                                     |
|--------- |-----------|------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|name  | Required  |                        | Test item name                                                                                                                                                                                                                  |
|type    | Required  |                        | Test item type, one of 'SUITE', 'STORY', 'TEST', 'SCENARIO', 'STEP', 'BEFORE_CLASS', 'BEFORE_GROUPS','BEFORE_METHOD', 'BEFORE_SUITE', 'BEFORE_TEST', 'AFTER_CLASS', 'AFTER_GROUPS', 'AFTER_METHOD', 'AFTER_SUITE', 'AFTER_TEST' |
|hasStats  | Optional  | true                   | Changes behavior for test item of type 'STEP'. When set to `true`, step is treaten as a test case (entity containig statistics). When false, step becomes a nested step.                                                        |
|description  | Optional  |         ''               | Description of the test item (supports markdown syntax).                                                                                                                                                                        |
|startTime  | Optional  | rpClient.helpers.now() | Start time of the test item (Unix Epoch time, see [time format](#time-format)).                                                                                                                                                                                        |
|attributes  | Optional  | []                     | Array of the test item attributes.                                                                                                                                                                                              |

* launch `tempId` (returned by the method `startLaunch`)
* parent test item `tempId` (*optional*) (returned by method `startTestItem`)

### finishTestItem

`finishTestItem` -  finish of the test item. After calling this method, you can not add items to the test item.
The request to finish the test item will be sent only after all test items within it have finished.

```javascript
// itemObj - object returned by method 'startTestItem'
rpClient.finishTestItem(itemObj.tempId, {
    status: 'failed'
})
```
The method takes two arguments:
* test item `tempId` (returned by the method `startTestItem`)
* data object:

| Option  | Necessity | Default                | Description                                                                                                                              |
|---------|-----------|------------------------|------------------------------------------------------------------------------------------------------------------------------------------|
| issue   | Optional  | true                   | Test item issue object. `issueType` is required, allowable values: 'pb***', 'ab***', 'si***', 'ti***', 'nd001'. Where `***` is locator id |
| status  | Optional  | 'PASSED'               | Test item status, one of '', 'PASSED', 'FAILED', 'STOPPED', 'SKIPPED', 'INTERRUPTED', 'CANCELLED'.                                       |
| endTime | Optional  | rpClient.helpers.now() | End time of the launch (Unix Epoch time, see [time format](#time-format)).                           |

Example issue object:
```
{
    issueType: 'string',
    comment: 'string',
    externalSystemIssues: [
        {
            submitDate: 0,
            submitter: 'string',
            systemId: 'string',
            ticketId: 'string',
            url: 'string'
        }
    ]
}
```

### sendLog

`sendLog` - adds a log to the test item.

```javascript
// stepObj - object returned by method 'startTestItem'
rpClient.sendLog(stepObj.tempId, {
    level: 'INFO',
    message: 'User clicks login button',
    time: rpClient.helpers.now()
})
```
The method takes three arguments:
* test item `tempId` (returned by method `startTestItem`)
* data object:

| Option  | Necessity | Default                | Description                                                         |
|---------|-----------|------------------------|---------------------------------------------------------------------|
| message | Optional  | ''                     | The log message.                                                    |
| level   | Optional  | ''                     | The log level, one of 'trace', 'debug', 'info', 'warn', 'error', ''. |
| time    | Optional  | rpClient.helpers.now() | The time of the log (Unix Epoch time, see [time format](#time-format)).                                               |

* file object (optional):

| Option  | Necessity | Default | Description                                                                                                                                                                                         |
|---------|-----------|---------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| name    | Required  |         | The name of the file.                                                                                                                                                                               |
| type    | Required  |         | The file mimeType, example 'image/png' (support types: 'image/*', application/['xml', 'javascript', 'json', 'css', 'php'], other formats will be opened in reportportal in a new browser tab only). |
| content | Required  |         | base64 encoded file content.                                                                                                                                                                        |

### mergeLaunches

`mergeLaunches` - merges already completed runs into one (useful when running tests in multiple threads on the same machine).

**Note:** Works only if `isLaunchMergeRequired` option is set to `true`.

```javascript
rpClient.mergeLaunches({
    description: 'Regression tests',
    attributes: [
      {
        key: 'build',
        value: '1.0.0'
      }
    ],
    endTime: rpClient.helpers.now(),
    extendSuitesDescription: false,
    launches: [1, 2, 3],
    mergeType: 'BASIC',
    mode: 'DEFAULT',
    name: 'Launch name',
})
```
The method takes one argument:

* merge options object (optional):

| Option                  | Necessity | Default                                 | Description                                                                                                |
|-------------------------|-----------|-----------------------------------------|------------------------------------------------------------------------------------------------------------|
| description             | Optional  | config.description or 'Merged launch'   | Description of the launch (supports markdown syntax).                                                      |
| attributes              | Optional  | config.attributes or []                 | Array of launch attributes (tags).                                                                         |
| endTime                 | Optional  | rpClient.helpers.now()                  | End time of the launch (Unix Epoch time, see [time format](#time-format)).                                 |
| extendSuitesDescription | Optional  | true                                    | Whether to extend suites description or not.                                                               |
| launches                | Optional  | ids of the launches saved to filesystem | The array of the real launch ids, not UUIDs                                                                |
| mergeType               | Optional  | 'BASIC'                                 | The type of the merge operation. Possible values are 'BASIC' or 'DEEP'.                                    |
| mode                    | Optional  | config.mode or 'DEFAULT'                | 'DEFAULT' - results will be submitted to Launches page, 'DEBUG' - results will be submitted to Debug page. |
| name                    | Optional  | config.launch or 'Test launch name'     | Name of the launch after merge.                                                                            |

## Time format

The unix Epoch time ISO string.

The [ReportPortal since product version 24.2]() (Service API version 5.12.0) supports the time with microsecond precision in the ISO string format (`2024-09-23T11:10:46.793546Z`).
Thus, it is recommended to report time in this format to have more accurate logs and test items order on the ReportPortal UI.
**Note:** Reporting the time in ISO string format with millisecond precision (`2024-09-23T11:10:46.793Z`) or as a number of milliseconds (`1727089846793`) is also acceptable with microseconds automatically added as zeros for backward compatibility.

The client use time with microsecond precision in the ISO string format by default since [version 5.3.0]().

# Copyright Notice

Licensed under the [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0.html)
license (see the LICENSE.txt file).
