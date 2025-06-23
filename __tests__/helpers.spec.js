const os = require('os');
const fs = require('fs');
const glob = require('glob');
const helpers = require('../lib/helpers');
const pjson = require('../package.json');

describe('Helpers', () => {
  describe('formatName', () => {
    it('slice last 256 symbols', () => {
      expect(helpers.formatName(`a${'b'.repeat(256)}`)).toBe('b'.repeat(256));
    });
    it('leave 256 symbol name as is', () => {
      expect(helpers.formatName('c'.repeat(256))).toBe('c'.repeat(256));
    });
    it('leave 3 symbol name as is', () => {
      expect(helpers.formatName('abc')).toBe('abc');
    });
    it('complete with dots 2 symbol name', () => {
      expect(helpers.formatName('ab')).toBe('ab.');
    });
  });

  describe('now', () => {
    it('returns milliseconds from unix time', () => {
      expect(new Date() - helpers.now()).toBeLessThan(100); // less than 100 miliseconds difference
    });
  });

  describe('readLaunchesFromFile', () => {
    it('should return the right ids', () => {
      jest.spyOn(glob, 'sync').mockReturnValue(['rplaunch-fileOne.tmp', 'rplaunch-fileTwo.tmp']);

      const ids = helpers.readLaunchesFromFile();

      expect(ids).toEqual(['fileOne', 'fileTwo']);
    });
  });

  describe('saveLaunchIdToFile', () => {
    it('should call fs.open method with right parameters', () => {
      jest.spyOn(fs, 'open').mockImplementation();

      helpers.saveLaunchIdToFile('fileOne');

      expect(fs.open).toHaveBeenCalledWith('rplaunch-fileOne.tmp', 'w', expect.any(Function));
    });
  });

  describe('getSystemAttribute', () => {
    it('should return correct system attributes', () => {
      jest.spyOn(os, 'type').mockReturnValue('osType');
      jest.spyOn(os, 'arch').mockReturnValue('osArchitecture');
      jest.spyOn(os, 'totalmem').mockReturnValue('1');
      const nodeVersion = process.version;
      const expectedAttr = [
        {
          key: 'client',
          value: `${pjson.name}|${pjson.version}`,
          system: true,
        },
        {
          key: 'os',
          value: 'osType|osArchitecture',
          system: true,
        },
        {
          key: 'RAMSize',
          value: '1',
          system: true,
        },
        {
          key: 'nodeJS',
          value: nodeVersion,
          system: true,
        },
      ];

      const attr = helpers.getSystemAttribute();

      expect(attr).toEqual(expectedAttr);
    });
  });

  describe('generateTestCaseId', () => {
    it('should return undefined if there is no codeRef', () => {
      const testCaseId = helpers.generateTestCaseId();

      expect(testCaseId).toEqual(undefined);
    });

    it('should return codeRef if there is no params', () => {
      const testCaseId = helpers.generateTestCaseId('codeRef');

      expect(testCaseId).toEqual('codeRef');
    });

    it('should return codeRef with parameters if there are all parameters', () => {
      const parameters = [
        {
          key: 'key',
          value: 'value',
        },
        { value: 'valueTwo' },
        { key: 'keyTwo' },
        {
          key: 'keyThree',
          value: 'valueThree',
        },
      ];

      const testCaseId = helpers.generateTestCaseId('codeRef', parameters);

      expect(testCaseId).toEqual('codeRef[value,valueTwo,valueThree]');
    });
  });

  describe('saveLaunchUuidToFile', () => {
    it('should call fs.open method with right parameters', () => {
      jest.spyOn(fs, 'open').mockImplementation();

      helpers.saveLaunchUuidToFile('fileOne');

      expect(fs.open).toHaveBeenCalledWith('rp-launch-uuid-fileOne.tmp', 'w', expect.any(Function));
    });
  });
});
