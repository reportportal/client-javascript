describe("ReportPortal javascript client", function() {
  let RPClient = require('../lib/client.js');
  
  describe("constructor", function() {
    it('executes without error', function() {
      let client = new RPClient({token: "test"});
      expect(client.config.token).toBe("test");
    });
  });
  describe("formatName", function() {
    let client = null;
    
    beforeAll(function() {
      client = new RPClient({token: "formatNameTest"});
    });

    it('slice last 256 symbols', function() {
      expect(client._formatName("a"+"b".repeat(256))).toBe("b".repeat(256));
    });
    it('leave 256 symbol name as is', function() {
      expect(client._formatName("c".repeat(256))).toBe("c".repeat(256));
    });
    it('leave 3 symbol name as is', function() {
      expect(client._formatName("abc")).toBe("abc");
    });
    it('complete with dots 2 symbol name', function() {
      expect(client._formatName("ab")).toBe("ab.");
    })
  });
  describe("now", function() {
    it("returns milliseconds from unix time", function() {
      client = new RPClient({token: "nowTest"});
      expect(new Date() - client._now()).toBeLessThan(100); // less than 100 miliseconds difference
    });
  });
  describe("startLaunch", function() {
    it("calls getResponsePromise", function() {
      client = new RPClient({token: "startLaunchTest", endpoint: "https://rp.us/api/v1", project:"tst"});
      myPromise = new Promise(()=>{});
      spyOn(client, '_getResponsePromise').and.returnValue(myPromise);

      client.startLaunch({});

      expect(client._getResponsePromise).
        toHaveBeenCalledWith("https://rp.us/api/v1/tst/launch", {}, {headers: client.headers}, "POST");
    });
  });
  describe("updateLaunchDescription", function() {
    it("sends put request to update description for launch", function() {
      client = new RPClient({token: "upLaunchDescTest", endpoint: "https://rp.us/api/v1", project:"tst"});
      spyOn(client, '_getResponsePromise');

      client.updateLaunchDescription("id5", "newone");

      expect(client._getResponsePromise).
        toHaveBeenCalledWith("https://rp.us/api/v1/tst/launch/id5/update",
        {description: "newone"},
        {headers: client.headers}, "PUT");
    });
  });
  describe("_getResponsePromise", function() {
    it("creates promise to send json via rest", function(done) {
      let rest = require('restler');
      spyOn(rest, 'json');

      client._getResponsePromise("url", {param: "value"}, "options", "method");

      expect(rest.json).toHaveBeenCalledWith("url", {param:"value"}, "options", "method");
      done(); // need as async code is checked
    });
  });
});
