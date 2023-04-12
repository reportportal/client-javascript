// client-id.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const ini = require('ini');
const { v4: uuidv4 } = require('uuid');
const { ENCODING, CLIENT_ID_KEY, RP_FOLDER, RP_PROPERTIES_FILE } = require('./constants');

function getRpFolderPath() {
  return path.join(os.homedir(), RP_FOLDER);
}

function getRpPropertiesFilePath() {
  return path.join(getRpFolderPath(), RP_PROPERTIES_FILE);
}

function readClientId() {
  const propertiesFilePath = getRpPropertiesFilePath();

  if (fs.existsSync(propertiesFilePath)) {
    const propertiesContent = fs.readFileSync(propertiesFilePath, ENCODING);
    const properties = ini.parse(propertiesContent);
    return properties[CLIENT_ID_KEY];
  }

  return null;
}

function storeClientId(clientId) {
  const propertiesFilePath = getRpPropertiesFilePath();
  const properties = {};

  if (fs.existsSync(propertiesFilePath)) {
    const propertiesContent = fs.readFileSync(propertiesFilePath, ENCODING);
    Object.assign(properties, ini.parse(propertiesContent));
  }

  properties[CLIENT_ID_KEY] = clientId;
  const propertiesContent = ini.stringify(properties);

  fs.mkdirSync(getRpFolderPath(), { recursive: true });
  fs.writeFileSync(propertiesFilePath, propertiesContent, ENCODING);
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
