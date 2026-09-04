import fs from 'fs';
import util from 'util';
import path from 'path';
import { randomUUID } from 'crypto';

const testHomeDir = path.join(__dirname, '__tmp__', 'rp-home');
process.env.RP_CLIENT_JS_HOME = testHomeDir;

// A static `import` would be hoisted above the `process.env` assignment above, so the module
// (which reads RP_CLIENT_JS_HOME at load time) is loaded lazily via a dynamic import instead.
let getClientId: () => Promise<string>;

const uuidv4Validation = /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i;
const clientIdFile = path.join(testHomeDir, '.rp', 'rp.properties');

const unlink = util.promisify(fs.unlink);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const removeTestHomeDir = () => fs.promises.rm(testHomeDir, { recursive: true, force: true });
const unlinkFile = async (filePath: string) => {
  try {
    await unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
};

describe('Client ID test suite', () => {
  beforeAll(async () => {
    await removeTestHomeDir();
    ({ getClientId } = await import('../src/statistics/client-id'));
  });
  afterAll(removeTestHomeDir);

  it('getClientId should return the same client ID for two calls', async () => {
    const clientId1 = await getClientId();
    const clientId2 = await getClientId();

    expect(clientId2).toEqual(clientId1);
  });

  it('getClientId should return different client IDs if store file removed', async () => {
    const clientId1 = await getClientId();
    await unlinkFile(clientIdFile);
    const clientId2 = await getClientId();
    expect(clientId2).not.toEqual(clientId1);
  });

  it('getClientId should return UUID client ID', async () => {
    const clientId = await getClientId();
    expect(clientId).toMatch(uuidv4Validation);
  });

  it('getClientId should save client ID to ~/.rp/rp.properties', async () => {
    await unlinkFile(clientIdFile);
    const clientId = await getClientId();
    const content = await readFile(clientIdFile, 'utf-8');
    expect(content).toMatch(new RegExp(`^client\\.id\\s*=\\s*${clientId}\\s*(?:$|\n)`));
  });

  it('getClientId should read client ID from ~/.rp/rp.properties', async () => {
    await unlinkFile(clientIdFile);
    const clientId = randomUUID();
    await writeFile(clientIdFile, `client.id=${clientId}\n`, 'utf-8');
    expect(await getClientId()).toEqual(clientId);
  });

  it(
    'getClientId should read client ID from ~/.rp/rp.properties if it is not empty and client ID is the ' +
      'first line',
    async () => {
      await unlinkFile(clientIdFile);
      const clientId = randomUUID();
      await writeFile(clientIdFile, `client.id=${clientId}\ntest.property=555\n`, 'utf-8');
      expect(await getClientId()).toEqual(clientId);
    },
  );

  it(
    'getClientId should read client ID from ~/.rp/rp.properties if it is not empty and client ID is not the ' +
      'first line',
    async () => {
      await unlinkFile(clientIdFile);
      const clientId = randomUUID();
      await writeFile(clientIdFile, `test.property=555\nclient.id=${clientId}\n`, 'utf-8');
      expect(await getClientId()).toEqual(clientId);
    },
  );

  it('getClientId should write client ID to ~/.rp/rp.properties if it is not empty', async () => {
    await unlinkFile(clientIdFile);
    await writeFile(clientIdFile, `test.property=555`, 'utf-8');
    const clientId = await getClientId();
    const content = await readFile(clientIdFile, 'utf-8');
    expect(content).toMatch(new RegExp(`(?:^|\n)client\\.id\\s*=\\s*${clientId}\\s*(?:$|\n)`));
    expect(content).toMatch(/(?:^|\n)test\.property\s*=\s*555\s*(?:$|\n)/);
  });
});
