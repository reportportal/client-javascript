import os from 'os';
import path from 'path';
import { PJSON_NAME, PJSON_VERSION } from '../pjson';

export const ENCODING = 'utf-8';
export { PJSON_NAME, PJSON_VERSION };
export const CLIENT_ID_KEY = 'client.id';
export const RP_FOLDER = '.rp';
export const RP_PROPERTIES_FILE = 'rp.properties';
const HOME_DIRECTORY = process.env.RP_CLIENT_JS_HOME || os.homedir();
export const RP_FOLDER_PATH = path.join(HOME_DIRECTORY, RP_FOLDER);
export const RP_PROPERTIES_FILE_PATH = path.join(RP_FOLDER_PATH, RP_PROPERTIES_FILE);
const CLIENT_INFO = Buffer.from(
  'Ry1XUDU3UlNHOFhMOmVFazhPMGJ0UXZ5MmI2VXVRT19TOFE=',
  'base64',
).toString('binary');
export const [MEASUREMENT_ID, API_KEY] = CLIENT_INFO.split(':');
export const EVENT_NAME = 'start_launch';

function getNodeVersion(): string | null {
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

export const INTERPRETER = getNodeVersion();
