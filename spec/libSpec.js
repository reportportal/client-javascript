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
});
