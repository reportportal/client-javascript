const os = require('os');
const path = require('path');
const Bowser = require('bowser');
const pjson = require('../package.json');

const ENCODING = 'utf-8';
const PJSON_VERSION = pjson.version;
const PJSON_NAME = pjson.name;
const CLIENT_ID_KEY = 'client.id';
const RP_FOLDER = '.rp';
const RP_PROPERTIES_FILE = 'rp.properties';
const RP_FOLDER_PATH = path.join(os.homedir(), RP_FOLDER);
const RP_PROPERTIES_FILE_PATH = path.join(RP_FOLDER_PATH, RP_PROPERTIES_FILE);
const CLIENT_INFO = atob('Ry1XUDU3UlNHOFhMOmVFazhPMGJ0UXZ5MmI2VXVRT19TOFE=');
const [MEASUREMENT_ID, API_KEY] = CLIENT_INFO.split(':');
const EVENT_NAME = 'start_launch';

function getBrowser() {
  // A workaround to avoid reference error in case this is not a browser
  if (typeof window !== 'undefined') {
    /* eslint-disable */
    if (window.navigator) {
      const userAgent = window.navigator.userAgent;
      if (userAgent) {
        const browser = Bowser.getParser(userAgent);
        const { name, version } = browser.getBrowser();
        return `${name} ${version}`;
      }
    }
    /* eslint-enable */
  }
  return null;
}

const BROWSER_VERSION = getBrowser();

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

const NODE_VERSION = getNodeVersion();

const INTERPRETER = BROWSER_VERSION || NODE_VERSION;

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
