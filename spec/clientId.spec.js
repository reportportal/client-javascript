const fs = require('fs');
const util = require('util');
const os = require('os');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getClientId } = require('../statistics/clientId');

const uuidv4Validation = /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i;
const clientIdFile = path.join(os.homedir(), '.rp', 'rp.properties');

const unlink = util.promisify(fs.unlink);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

describe('Client ID test suite', () => {
  it('getClientId should return the same client ID for two calls', async () => {
    const clientId1 = await getClientId();
    const clientId2 = await getClientId();

    expect(clientId2).toEqual(clientId1);
  });

  it('getClientId should return different client IDs if store file removed', async () => {
    const clientId1 = await getClientId();
    await unlink(clientIdFile);
    const clientId2 = await getClientId();
    expect(clientId2).not.toEqual(clientId1);
  });

  it('getClientId should return UUID client ID', async () => {
    const clientId = await getClientId();
    expect(clientId).toMatch(uuidv4Validation);
  });

  it('getClientId should save client ID to ~/.rp/rp.properties', async () => {
    await unlink(clientIdFile);
    const clientId = await getClientId();
    const content = await readFile(clientIdFile, 'utf-8');
    expect(content).toMatch(new RegExp(`^client\\.id\\s*=\\s*${clientId}\\s*(?:$|\n)`));
  });

  it('getClientId should read client ID from ~/.rp/rp.properties', async () => {
    await unlink(clientIdFile);
    const clientId = uuidv4(undefined, undefined, 0);
    await writeFile(clientIdFile, `client.id=${clientId}\n`, 'utf-8');
    expect(await getClientId()).toEqual(clientId);
  });

  it(
    'getClientId should read client ID from ~/.rp/rp.properties if it is not empty and client ID is the ' +
      'first line',
    async () => {
      await unlink(clientIdFile);
      const clientId = uuidv4(undefined, undefined, 0);
      await writeFile(clientIdFile, `client.id=${clientId}\ntest.property=555\n`, 'utf-8');
      expect(await getClientId()).toEqual(clientId);
    },
  );

  it(
    'getClientId should read client ID from ~/.rp/rp.properties if it is not empty and client ID is not the ' +
      'first line',
    async () => {
      await unlink(clientIdFile);
      const clientId = uuidv4(undefined, undefined, 0);
      await writeFile(clientIdFile, `test.property=555\nclient.id=${clientId}\n`, 'utf-8');
      expect(await getClientId()).toEqual(clientId);
    },
  );

  it('getClientId should write client ID to ~/.rp/rp.properties if it is not empty', async () => {
    await unlink(clientIdFile);
    await writeFile(clientIdFile, `test.property=555`, 'utf-8');
    const clientId = await getClientId();
    const content = await readFile(clientIdFile, 'utf-8');
    expect(content).toMatch(new RegExp(`(?:^|\n)client\\.id\\s*=\\s*${clientId}\\s*(?:$|\n)`));
    expect(content).toMatch(/(?:^|\n)test\.property\s*=\s*555(?:$|\n)/);
  });
});
