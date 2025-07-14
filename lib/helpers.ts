import * as fs from 'fs';
import * as glob from 'glob';
import * as os from 'os';
import RestClient, { RequestMethod } from './rest';
import pjson from '../package.json';
import { Attribute } from './types';

const MIN = 3;
const MAX = 256;
const PJSON_VERSION: string = pjson.version;
const PJSON_NAME: string = pjson.name;

const getUUIDFromFileName = (filename: string): string | undefined => {
  return filename.match(/rplaunch-(.*)\.tmp/)?.[1];
};

const formatName = (name: string): string => {
  const len: number = name.length;
  return (len < MIN ? name + new Array(MIN - len + 1).join('.') : name).slice(-MAX);
};

const now = (): number => {
  return new Date().valueOf();
};

// TODO: deprecate and remove
const getServerResult = (
  url: string,
  request: any,
  options: any,
  method: RequestMethod,
): Promise<any> => {
  return new RestClient(options).request(method, url, request, options);
};

const readLaunchesFromFile = (): Array<string> => {
  const files = glob.sync('rplaunch-*.tmp');
  const ids = files.map(getUUIDFromFileName);
  const validIds = ids.filter((id) => id !== undefined) ?? [];

  return validIds as Array<string>;
};

const saveLaunchIdToFile = (launchId: string): void => {
  const filename = `rplaunch-${launchId}.tmp`;
  fs.open(filename, 'w', (err: NodeJS.ErrnoException | null) => {
    if (err) {
      throw err;
    }
  });
};

const getSystemAttribute = (): Attribute[] => {
  const osType = os.type();
  const osArchitecture = os.arch();
  const RAMSize = os.totalmem();
  const nodeVersion = process.version;
  return [
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
};

const generateTestCaseId = (codeRef: string, params?: Attribute[]): string | undefined => {
  if (!codeRef) {
    return;
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

const saveLaunchUuidToFile = (launchUuid: string): void => {
  const filename = `rp-launch-uuid-${launchUuid}.tmp`;
  fs.open(filename, 'w', (err: NodeJS.ErrnoException | null) => {
    if (err) {
      throw err;
    }
  });
};

export {
  formatName,
  now,
  getServerResult,
  readLaunchesFromFile,
  saveLaunchIdToFile,
  getSystemAttribute,
  generateTestCaseId,
  saveLaunchUuidToFile,
};
