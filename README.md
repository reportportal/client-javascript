#ReportPortal js client 
This is ALPHA version. It works fine, but public API could be changed.

Library used only for implementors of custom listeners for ReportPortal.

## Allready implemented listeners:
* EMPTY


## Installation
The latest version is available on npm:

    npm install reportportal-client


## Usage

Main classes are:

- RPClient

Basic usage example:

```js
var Service = require("reportportal-client");

function now() {
    return new Date().getTime();
}

var rpConfig = {
    endpoint: "http://your_reportportal_url",
    project: "project",
    token: "your_reportportal_token"
};

var rp = new Service(rpConfig);

var startLaunchRQ = {
    name: "JSLaunchName",
    description: "Some LaunchDescription",
    tags: ["tag1", "tag2"],
    start_time: now(),
    mode: null
};

var startLaunchResponse = rp.startLaunch(startLaunchRQ);

var launchId;

startLaunchResponse.then(function (response) {
    var startTestItemRQ = {
        name: "Suite1",
        description: "SuiteDescription",
        tags: ["suite_tag1", "suite_tag2"],
        start_time: now(),
        launch_id: response.id,
        type: "SUITE"
    };
    var startSuiteResponse = rp.startTestItem(null, startTestItemRQ);
    startSuiteResponse.then(function (data) {
        var finishTestItemRQ = {
            end_time: now(),
            status: status.PASSED
        };
        rp.finishTestItem(data.id, finishTestItemRQ).then(function (data) {
            var finishExecutionRQ = {
                end_time: now(),
                status: status.PASSED
            };

            startLaunchResponse.then(function (response) {
                console.log(response.id);
                rp.finishLaunch(response.id, finishExecutionRQ)
                    .then(function (data) {
                        console.log(data);
                    })
            }, function (err) {
                console.log(err);
            });
        });
    })
});
```

# Copyright Notice
Licensed under the [GPLv3](https://www.gnu.org/licenses/quick-guide-gplv3.html)
license (see the LICENSE.txt file).