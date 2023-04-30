const os = require('os');
const path = require('path');
const pjson = require('../package.json');

const ENCODING = 'utf-8';
const PJSON_VERSION = pjson.version;
const PJSON_NAME = pjson.name;
const CLIENT_ID_KEY = 'client.id';
const RP_FOLDER = '.rp';
const RP_PROPERTIES_FILE = 'rp.properties';
const RP_FOLDER_PATH = path.join(os.homedir(), RP_FOLDER);
const RP_PROPERTIES_FILE_PATH = path.join(RP_FOLDER_PATH, RP_PROPERTIES_FILE);
const CLIENT_INFO = Buffer.from(
  'Ry1XUDU3UlNHOFhMOmVFazhPMGJ0UXZ5MmI2VXVRT19TOFE=',
  'base64',
).toString('binary');
const [MEASUREMENT_ID, API_KEY] = CLIENT_INFO.split(':');
const EVENT_NAME = 'start_launch';

function getNodeVersion() {
  // A workaround to avoid reference error in case this is not a Node.js application
  if (typeof process !== 'undefined') {
    if (process.versions) {
      const version = process.versions.node;
      if (version) {
        return `Node.js ${version}`;
      }
    }
  }
  return null;
}

const INTERPRETER = getNodeVersion();

module.exports = {
  ENCODING,
  EVENT_NAME,
  PJSON_VERSION,
  PJSON_NAME,
  CLIENT_ID_KEY,
  RP_FOLDER,
  RP_FOLDER_PATH,
  RP_PROPERTIES_FILE,
  RP_PROPERTIES_FILE_PATH,
  MEASUREMENT_ID,
  API_KEY,
  INTERPRETER,
};
