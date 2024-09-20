const fs = require('fs');
const glob = require('glob');
const os = require('os');
const microtime = require('microtime');
const RestClient = require('./rest');
const pjson = require('../package.json');

const MIN = 3;
const MAX = 256;
const PJSON_VERSION = pjson.version;
const PJSON_NAME = pjson.name;

const getUUIDFromFileName = (filename) => filename.match(/rplaunch-(.*)\.tmp/)[1];

const formatName = (name) => {
  const len = name.length;
  // eslint-disable-next-line no-mixed-operators
  return (len < MIN ? name + new Array(MIN - len + 1).join('.') : name).slice(-MAX);
};

const formatMicrosecondsToISOString = (timestampInMicroseconds) => {
  const milliseconds = Math.floor(timestampInMicroseconds / 1000);
  const microseconds = String(timestampInMicroseconds).slice(-3);
  const isoDate = new Date(milliseconds).toISOString();

  return isoDate.replace('Z', `${microseconds}Z`);
};

const now = () => {
  return formatMicrosecondsToISOString(microtime.now());
};

// TODO: deprecate and remove
const getServerResult = (url, request, options, method) => {
  return new RestClient(options).request(method, url, request, options);
};

const readLaunchesFromFile = () => {
  const files = glob.sync('rplaunch-*.tmp');
  const ids = files.map(getUUIDFromFileName);

  return ids;
};

const saveLaunchIdToFile = (launchId) => {
  const filename = `rplaunch-${launchId}.tmp`;
  fs.open(filename, 'w', (err) => {
    if (err) {
      throw err;
    }
  });
};

const getSystemAttribute = () => {
  const osType = os.type();
  const osArchitecture = os.arch();
  const RAMSize = os.totalmem();
  const nodeVersion = process.version;
  const systemAttr = [
    {
      key: 'client',
      value: `${PJSON_NAME}|${PJSON_VERSION}`,
      system: true,
    },
    {
      key: 'os',
      value: `${osType}|${osArchitecture}`,
      system: true,
    },
    {
      key: 'RAMSize',
      value: RAMSize,
      system: true,
    },
    {
      key: 'nodeJS',
      value: nodeVersion,
      system: true,
    },
  ];

  return systemAttr;
};

const generateTestCaseId = (codeRef, params) => {
  if (!codeRef) {
    return;
  }

  if (!params) {
    return codeRef;
  }

  const parameters = params.reduce(
    (result, item) => (item.value ? result.concat(item.value) : result),
    [],
  );

  return `${codeRef}[${parameters}]`;
};

const saveLaunchUuidToFile = (launchUuid) => {
  const filename = `rp-launch-uuid-${launchUuid}.tmp`;
  fs.open(filename, 'w', (err) => {
    if (err) {
      throw err;
    }
  });
};

module.exports = {
  formatName,
  formatMicrosecondsToISOString,
  now,
  getServerResult,
  readLaunchesFromFile,
  saveLaunchIdToFile,
  getSystemAttribute,
  generateTestCaseId,
  saveLaunchUuidToFile,
};
