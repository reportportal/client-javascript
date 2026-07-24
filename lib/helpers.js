const fs = require('fs');
const glob = require('glob');
const os = require('os');
const RestClient = require('./rest');
const pjson = require('../package.json');
const {
  ATTRIBUTE_LENGTH_LIMIT,
  ATTRIBUTE_NUMBER_LIMIT,
  TRUNCATE_REPLACEMENT,
  LAUNCH_NAME_LENGTH_LIMIT,
  ITEM_NAME_LENGTH_LIMIT,
  LAUNCH_DESCRIPTION_LENGTH_LIMIT,
  ITEM_DESCRIPTION_LENGTH_LIMIT,
} = require('./constants/limits');

const MIN = 3;
const MAX = 256;
const PJSON_VERSION = pjson.version;
const PJSON_NAME = pjson.name;

const BINARY_CHAR_CODES = [
  0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x0b, 0x0c, 0x0e, 0x0f, 0x10, 0x11,
  0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f, 0x7f,
];

const BINARY_CHARS = new RegExp(
  `[${BINARY_CHAR_CODES.map((c) => `\\u${c.toString(16).padStart(4, '0')}`).join('')}]`,
  'g',
);

const cleanBinaryCharacters = (text) => {
  if (!text) return '';
  return text.replace(BINARY_CHARS, '\uFFFD');
};

const truncateString = (text, limit) => {
  if (text.length <= limit) return text;
  if (limit <= TRUNCATE_REPLACEMENT.length) return text.slice(0, limit);
  return text.slice(0, limit - TRUNCATE_REPLACEMENT.length) + TRUNCATE_REPLACEMENT;
};

const sanitizeField = (value, limit, options = {}) => {
  const { replaceBinaryChars = true, truncateFields = true } = options;
  if (!value) return value;

  let result = value;
  if (replaceBinaryChars) result = cleanBinaryCharacters(result);
  if (truncateFields) result = truncateString(result, Math.max(0, limit));
  return result;
};

const isAttributeObject = (attr) => attr !== null && typeof attr === 'object';

const compareAttributesByKey = (a, b) =>
  String(a.key || '').localeCompare(String(b.key || ''));

const cleanAttributeBinaryChars = (attr) => {
  const result = { ...attr };
  if (result.key != null) result.key = cleanBinaryCharacters(String(result.key));
  if (result.value != null) result.value = cleanBinaryCharacters(String(result.value));
  return result;
};

const truncateAttributeFields = (attr) => {
  const result = { ...attr };
  if (result.key) result.key = truncateString(String(result.key), ATTRIBUTE_LENGTH_LIMIT);
  result.value = truncateString(String(result.value), ATTRIBUTE_LENGTH_LIMIT);
  return result;
};

const truncateAttributes = (attributes, options = {}) => {
  const { replaceBinaryChars = true, truncateAttributes: truncateEnabled = true } = options;

  if (!Array.isArray(attributes)) return attributes;

  let result = attributes.filter(isAttributeObject).map((attr) => ({ ...attr }));
  if (result.length === 0) return [];

  if (result.length > ATTRIBUTE_NUMBER_LIMIT) {
    result.sort(compareAttributesByKey);
    result = result.slice(0, ATTRIBUTE_NUMBER_LIMIT);
  }

  if (replaceBinaryChars) {
    result = result.map(cleanAttributeBinaryChars);
  }

  if (!truncateEnabled) return result;

  return result.filter((attr) => attr.value != null).map(truncateAttributeFields);
};

const getUUIDFromFileName = (filename) => filename.match(/rplaunch-(.*)\.tmp/)[1];

const formatName = (name) => {
  const len = name.length;
  // eslint-disable-next-line no-mixed-operators
  return (len < MIN ? name + new Array(MIN - len + 1).join('.') : name).slice(-MAX);
};

const now = () => {
  return new Date().valueOf();
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
  ATTRIBUTE_LENGTH_LIMIT,
  ATTRIBUTE_NUMBER_LIMIT,
  TRUNCATE_REPLACEMENT,
  LAUNCH_NAME_LENGTH_LIMIT,
  ITEM_NAME_LENGTH_LIMIT,
  LAUNCH_DESCRIPTION_LENGTH_LIMIT,
  ITEM_DESCRIPTION_LENGTH_LIMIT,
  cleanBinaryCharacters,
  truncateString,
  sanitizeField,
  truncateAttributes,
  formatName,
  now,
  getServerResult,
  readLaunchesFromFile,
  saveLaunchIdToFile,
  getSystemAttribute,
  generateTestCaseId,
  saveLaunchUuidToFile,
};
