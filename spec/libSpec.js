describe("ReportPortal javascript client", function () {
    let RPClient = require('../lib/report-portal-client.js');

    describe("constructor", function () {
        it('executes without error', function () {
            let client = new RPClient({token: "test"});
            expect(client.config.token).toBe("test");
        });
    });
    describe("formatName", function () {
        let client = null;

        beforeAll(function () {
            client = new RPClient({token: "formatNameTest"});
        });

        it('slice last 256 symbols', function () {
            expect(client.helpers.formatName("a" + "b".repeat(256))).toBe("b".repeat(256));
        });
        it('leave 256 symbol name as is', function () {
            expect(client.helpers.formatName("c".repeat(256))).toBe("c".repeat(256));
        });
        it('leave 3 symbol name as is', function () {
            expect(client.helpers.formatName("abc")).toBe("abc");
        });
        it('complete with dots 2 symbol name', function () {
            expect(client.helpers.formatName("ab")).toBe("ab.");
        })
    });
    describe("now", function () {
        let client;
        it("returns milliseconds from unix time", function () {
            client = new RPClient({token: "nowTest"});
            expect(new Date() - client.helpers.now()).toBeLessThan(100); // less than 100 miliseconds difference
        });
    });
    describe("startLaunch", function () {
        let client;
        it("calls getServerResult", function () {
            client = new RPClient({token: "startLaunchTest", endpoint: "https://rp.us/api/v1", project: "tst"});
            let myPromise = Promise.resolve({id: 'testidlaunch'});
            spyOn(client.helpers, 'getServerResult').and.returnValue(myPromise);

            client.startLaunch({});
            expect(client.helpers.getServerResult).toHaveBeenCalledWith("https://rp.us/api/v1/tst/launch", {}, {headers: client.headers}, "POST");
        });
    });
    xdescribe("updateLaunch", function () {
        let client;
        let launchObj;

        beforeAll(function () {

        });

        it("sends put request to update description for launch", function () {
            client = new RPClient({token: "upLaunchDescTest", endpoint: "https://rp.us/api/v1", project: "tst"});
            let myPromise = Promise.resolve({id: 'testidlaunch'});
            spyOn(client.helpers, 'getServerResult').and.returnValue(myPromise);
            launchObj = client.startLaunch({});
            client.finishLaunch(launchObj.tempId, {});
            client.updateLaunch(launchObj.tempId, {
                description: "newone"
            });
            console.dir(client.helpers.getServerResult.calls.all());
            expect(client.helpers.getServerResult.calls.length).toHaveBeenCalledWith("https://rp.us/api/v1/tst/launch/id5/update",
                {description: "newone"},
                {headers: client.headers}, "PUT");
        });
    });
    xdescribe("getServerResult", function () {
        it("creates promise to send json via rest", function (done) {
            let rest = require('restler');
            spyOn(rest, 'json');
            let client = new RPClient({token: "upLaunchDescTest", endpoint: "https://rp.us/api/v1", project: "tst"});

            client.helpers.getServerResult("url", {param: "value"}, "options", "method");

            expect(rest.json).toHaveBeenCalledWith("url", {param: "value"}, "options", "method");
            done(); // need as async code is checked
        });
    });
    xdescribe("finishLaunch", function () {
        it("sends put request to finish launch", function () {
            client = new RPClient({token: "any", endpoint: "https://rp.api", project: "prj"});
            spyOn(client, '_getResponsePromise');

            client.finishLaunch("id6", {some: "data"});

            expect(client._getResponsePromise).toHaveBeenCalledWith("https://rp.api/prj/launch/id6/finish",
                {some: "data"}, {headers: client.headers}, "PUT");
        });
    });
    xdescribe("startTestItem", function () {
        it("sends post request to item", function () {
            client = new RPClient({token: "any", endpoint: "https://rp.api", project: "prj"});
            spyOn(client, '_getResponsePromise');

            client.startTestItem({some: "data"}, "parentID5")

            expect(client._getResponsePromise).toHaveBeenCalledWith("https://rp.api/prj/item/parentID5",
                {some: "data"}, {headers: client.headers}, "POST")
        });
    });
    xdescribe("finishTestItem", function () {
        it("sends put request to item", function () {
            client = new RPClient({token: "any", endpoint: "https://rp.api", project: "prj"});
            spyOn(client, "_getResponsePromise");

            client.finishTestItem("finishedItemId", {finish: "it"});

            expect(client._getResponsePromise).toHaveBeenCalledWith("https://rp.api/prj/item/finishedItemId",
                {finish: "it"}, {headers: client.headers}, "PUT");
        });
    });
});
