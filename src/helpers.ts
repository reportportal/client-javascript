import fs from 'fs';
import { sync as globSync } from 'glob';
import os from 'os';
import RestClient from './rest';
import { PJSON_NAME, PJSON_VERSION } from './pjson';
import { TestItemParameter } from './models/requests';
import { Attribute } from './models/common';

const MIN = 3;
const MAX = 256;

const getUUIDFromFileName = (filename: string): string => {
  const match = filename.match(/rplaunch-(.*)\.tmp/);
  return match ? match[1] : '';
};

export const formatName = (name: string): string => {
  const len = name.length;
  // eslint-disable-next-line no-mixed-operators
  return (len < MIN ? name + new Array(MIN - len + 1).join('.') : name).slice(-MAX);
};

export const now = (): number => {
  return new Date().valueOf();
};

// TODO: deprecate and remove
export const getServerResult = (
  url: string,
  request: unknown,
  options: ConstructorParameters<typeof RestClient>[0],
  method: string,
): Promise<unknown> => {
  return new RestClient(options).request(method, url, request, options);
};

export const readLaunchesFromFile = (): string[] => {
  const files = globSync('rplaunch-*.tmp');
  const ids = files.map(getUUIDFromFileName);

  return ids;
};

export const saveLaunchIdToFile = (launchId: string): void => {
  const filename = `rplaunch-${launchId}.tmp`;
  fs.open(filename, 'w', (err) => {
    if (err) {
      throw err;
    }
  });
};

export const getSystemAttributes = (): Attribute[] => {
  const osType = os.type();
  const osArchitecture = os.arch();
  const RAMSize = os.totalmem();
  const nodeVersion = process.version;
  const systemAttr: Attribute[] = [
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
      value: `${RAMSize}`,
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

export const generateTestCaseId = (
  codeRef?: string,
  params?: TestItemParameter[],
): string | undefined => {
  if (!codeRef) {
    return undefined;
  }

  if (!params) {
    return codeRef;
  }

  const parameters = params.reduce<string[]>(
    (result, item) => (item.value ? result.concat(item.value) : result),
    [],
  );

  return `${codeRef}[${parameters}]`;
};

export const saveLaunchUuidToFile = (launchUuid: string): void => {
  const filename = `rp-launch-uuid-${launchUuid}.tmp`;
  fs.open(filename, 'w', (err) => {
    if (err) {
      throw err;
    }
  });
};

// Default export preserves the historical CommonJS shape (`module.exports = { ... }`)
// so consumers importing `helpers` as a default still work.
export default {
  formatName,
  now,
  getServerResult,
  readLaunchesFromFile,
  saveLaunchIdToFile,
  getSystemAttributes,
  generateTestCaseId,
  saveLaunchUuidToFile,
};
