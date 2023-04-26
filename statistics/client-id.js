const fs = require('fs');
const util = require('util');
const ini = require('ini');
const { v4: uuidv4 } = require('uuid');
const { ENCODING, CLIENT_ID_KEY, RP_FOLDER_PATH, RP_PROPERTIES_FILE_PATH } = require('./constants');

const exists = util.promisify(fs.exists);
const readFile = util.promisify(fs.readFile);
const mkdir = util.promisify(fs.mkdir);
const writeFile = util.promisify(fs.writeFile);

async function readClientId() {
  if (await exists(RP_PROPERTIES_FILE_PATH)) {
    const propertiesContent = await readFile(RP_PROPERTIES_FILE_PATH, ENCODING);
    const properties = ini.parse(propertiesContent);
    return properties[CLIENT_ID_KEY];
  }
  return null;
}

async function storeClientId(clientId) {
  const properties = {};
  if (await exists(RP_PROPERTIES_FILE_PATH)) {
    const propertiesContent = await readFile(RP_PROPERTIES_FILE_PATH, ENCODING);
    Object.assign(properties, ini.parse(propertiesContent));
  }
  properties[CLIENT_ID_KEY] = clientId;
  const propertiesContent = ini.stringify(properties);
  await mkdir(RP_FOLDER_PATH, { recursive: true });
  await writeFile(RP_PROPERTIES_FILE_PATH, propertiesContent, ENCODING);
}

async function getClientId() {
  let clientId = await readClientId();
  if (!clientId) {
    clientId = uuidv4(undefined, undefined, 0);
    try {
      await storeClientId(clientId);
    } catch (ignore) {
      // do nothing on saving error, client ID will be always new
    }
  }
  return clientId;
}

module.exports = { getClientId };
