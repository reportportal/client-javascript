const Bowser = require('bowser');
const pjson = require('../package.json');

const ENCODING = 'utf-8';
const PJSON_VERSION = pjson.version;
const PJSON_NAME = pjson.name;
const CLIENT_ID_KEY = 'client.id';
const RP_FOLDER = '.rp';
const RP_PROPERTIES_FILE = 'rp.properties';
const CLIENT_INFO = atob('Ry1XUDU3UlNHOFhMOmVFazhPMGJ0UXZ5MmI2VXVRT19TOFE=');
const [MEASUREMENT_ID, API_KEY] = CLIENT_INFO.split(':');
const EVENT_NAME = 'start_launch';

function getBrowser() {
  /* eslint-disable */
  if (typeof window !== 'undefined') {
    if (window.navigator) {
      const userAgent = window.navigator.userAgent;
      if (userAgent) {
        const browser = Bowser.getParser(userAgent);
        const { name, version } = browser.getBrowser();
        return `${name} ${version}`;
      }
    }
  }
  /* eslint-enable */
  return null;
}

const BROWSER_VERSION = getBrowser();

function getNodeVersion() {
  if (process) {
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
  RP_PROPERTIES_FILE,
  MEASUREMENT_ID,
  API_KEY,
  INTERPRETER,
};
