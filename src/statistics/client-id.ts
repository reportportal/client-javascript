import fs from 'fs';
import util from 'util';
import * as ini from 'ini';
import { randomUUID } from 'crypto';
import { ENCODING, CLIENT_ID_KEY, RP_FOLDER_PATH, RP_PROPERTIES_FILE_PATH } from './constants';

const exists = util.promisify(fs.exists);
const readFile = util.promisify(fs.readFile);
const mkdir = util.promisify(fs.mkdir);
const writeFile = util.promisify(fs.writeFile);

async function readClientId(): Promise<string | null> {
  if (await exists(RP_PROPERTIES_FILE_PATH)) {
    const propertiesContent = await readFile(RP_PROPERTIES_FILE_PATH, ENCODING);
    const properties = ini.parse(propertiesContent);
    const value = properties[CLIENT_ID_KEY];
    return typeof value === 'string' ? value : null;
  }
  return null;
}

async function storeClientId(clientId: string): Promise<void> {
  const properties: Record<string, string> = {};
  if (await exists(RP_PROPERTIES_FILE_PATH)) {
    const propertiesContent = await readFile(RP_PROPERTIES_FILE_PATH, ENCODING);
    Object.assign(properties, ini.parse(propertiesContent));
  }
  properties[CLIENT_ID_KEY] = clientId;
  const propertiesContent = ini.stringify(properties);
  await mkdir(RP_FOLDER_PATH, { recursive: true });
  await writeFile(RP_PROPERTIES_FILE_PATH, propertiesContent, ENCODING);
}

export async function getClientId(): Promise<string> {
  let clientId = await readClientId();
  if (!clientId) {
    clientId = randomUUID();
    try {
      await storeClientId(clientId);
    } catch (ignore) {
      // do nothing on saving error, client ID will be always new
    }
  }
  return clientId;
}
