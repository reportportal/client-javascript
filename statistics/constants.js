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
};
