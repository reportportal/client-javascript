// client-id.js
const fs = require('fs');
const ini = require('ini');
const { v4: uuidv4 } = require('uuid');
const { ENCODING, CLIENT_ID_KEY, RP_FOLDER_PATH, RP_PROPERTIES_FILE_PATH } = require('./constants');

function readClientId() {
  if (fs.existsSync(RP_PROPERTIES_FILE_PATH)) {
    const propertiesContent = fs.readFileSync(RP_PROPERTIES_FILE_PATH, ENCODING);
    const properties = ini.parse(propertiesContent);
    return properties[CLIENT_ID_KEY];
  }
  return null;
}

function storeClientId(clientId) {
  const properties = {};
  if (fs.existsSync(RP_PROPERTIES_FILE_PATH)) {
    const propertiesContent = fs.readFileSync(RP_PROPERTIES_FILE_PATH, ENCODING);
    Object.assign(properties, ini.parse(propertiesContent));
  }
  properties[CLIENT_ID_KEY] = clientId;
  const propertiesContent = ini.stringify(properties);
  fs.mkdirSync(RP_FOLDER_PATH, { recursive: true });
  fs.writeFileSync(RP_PROPERTIES_FILE_PATH, propertiesContent, ENCODING);
}

function getClientId() {
  let clientId = readClientId();
  if (!clientId) {
    clientId = uuidv4(undefined, undefined, 0);
    storeClientId(clientId);
  }
  return clientId;
}

module.exports = { getClientId };
