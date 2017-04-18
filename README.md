#ReportPortal js client 
 It works fine, but public API could be changed.

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
'use strict';
const Service = require("reportportal-client");

let rpConfig = {
    endpoint: "http://your_reportportal_url",
    project: "project",
    token: "your_reportportal_token"
};

let rp = new Service(rpConfig);

let startLaunchRQ = {
    name: "JSLaunchName",
    description: "Some LaunchDescription",
    tags: ["tag1", "tag2"],
    mode: "DEFAULT"
};

rp.startLaunch(startLaunchRQ).then(response => {
    
    let startTestItemRQ = {
        name: "Suite1",
        description: "SuiteDescription",
        tags: ["suite_tag1", "suite_tag2"],
        launch_id: response.id,
        type: "SUITE"
    };
    
    return rp.startTestItem(startTestItemRQ)
        .then(data => {
            
            let finishTestItemRQ = {
                status: 'passed'
            };
            
            return rp.finishTestItem(data.id, finishTestItemRQ)
                .then(function () {
                    return response.id
                })
                .catch(err => console.error(err));
        })
        .catch(err => console.error(err));
}).then(launchId => {
    let finishExecutionRQ = {};
    return rp.finishLaunch(launchId, finishExecutionRQ)
}).catch(err => console.error(err));

```

# Copyright Notice
Licensed under the [GPLv3](https://www.gnu.org/licenses/quick-guide-gplv3.html)
license (see the LICENSE.txt file).