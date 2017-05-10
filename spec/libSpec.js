describe("ReportPortal javascript client", function() {
  let RPClient = require('../lib/client.js');

  describe("constructor", function() {
    it('executes without error', function() {
      let client = new RPClient({token: "test"});
      expect(client.config.token).toBe("test");
    });
  });
});
