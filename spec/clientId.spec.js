const fs = require('fs');
const os = require('os');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getClientId } = require('../statistics/clientId');

const uuidv4Validation = /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i;
const clientIdFile = path.join(os.homedir(), '.rp', 'rp.properties');

describe('Client ID test suite', () => {
  it('getClientId should return the same client ID for two calls', () => {
    const clientId1 = getClientId();
    const clientId2 = getClientId();

    expect(clientId2).toEqual(clientId1);
  });

  it('getClientId should return different client IDs if store file removed', () => {
    const clientId1 = getClientId();
    fs.unlinkSync(clientIdFile);
    const clientId2 = getClientId();
    expect(clientId2).not.toEqual(clientId1);
  });

  it('getClientId should return UUID client ID', () => {
    const clientId = getClientId();
    expect(clientId).toMatch(uuidv4Validation);
  });

  it('getClientId should save client ID to ~/.rp/rp.properties', () => {
    fs.unlinkSync(clientIdFile);
    const clientId = getClientId();
    const content = fs.readFileSync(clientIdFile, 'utf-8');
    expect(content).toMatch(new RegExp(`^client\\.id\\s*=\\s*${clientId}\\s*(?:$|\n)`));
  });

  it('getClientId should read client ID from ~/.rp/rp.properties', () => {
    fs.unlinkSync(clientIdFile);
    const clientId = uuidv4(undefined, undefined, 0);
    fs.writeFileSync(clientIdFile, `client.id=${clientId}\n`, 'utf-8');
    expect(getClientId()).toEqual(clientId);
  });

  it(
    'getClientId should read client ID from ~/.rp/rp.properties if it is not empty and client ID is the ' +
      'first line',
    () => {
      fs.unlinkSync(clientIdFile);
      const clientId = uuidv4(undefined, undefined, 0);
      fs.writeFileSync(clientIdFile, `client.id=${clientId}\ntest.property=555\n`, 'utf-8');
      expect(getClientId()).toEqual(clientId);
    },
  );

  it(
    'getClientId should read client ID from ~/.rp/rp.properties if it is not empty and client ID is not the ' +
      'first line',
    () => {
      fs.unlinkSync(clientIdFile);
      const clientId = uuidv4(undefined, undefined, 0);
      fs.writeFileSync(clientIdFile, `test.property=555\nclient.id=${clientId}\n`, 'utf-8');
      expect(getClientId()).toEqual(clientId);
    },
  );

  it('getClientId should write client ID to ~/.rp/rp.properties if it is not empty', () => {
    fs.unlinkSync(clientIdFile);
    fs.writeFileSync(clientIdFile, `test.property=555`, 'utf-8');
    const clientId = getClientId();
    const content = fs.readFileSync(clientIdFile, 'utf-8');
    expect(content).toMatch(new RegExp(`(?:^|\n)client\\.id\\s*=\\s*${clientId}\\s*(?:$|\n)`));
    expect(content).toMatch(/(?:^|\n)test\.property=555(?:$|\n)/);
  });
});
