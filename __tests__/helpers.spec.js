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

  describe('cleanBinaryCharacters', () => {
    it('should return empty string for falsy input', () => {
      expect(helpers.cleanBinaryCharacters('')).toBe('');
      expect(helpers.cleanBinaryCharacters(null)).toBe('');
      expect(helpers.cleanBinaryCharacters(undefined)).toBe('');
    });

    it('should replace NUL character with replacement char', () => {
      expect(helpers.cleanBinaryCharacters('hello\x00world')).toBe('hello\uFFFDworld');
    });

    it('should replace ESC character with replacement char', () => {
      expect(helpers.cleanBinaryCharacters('test\x1Bvalue')).toBe('test\uFFFDvalue');
    });

    it('should replace multiple binary characters', () => {
      const input = '\x00start\x01mid\x1Bend';
      const result = helpers.cleanBinaryCharacters(input);
      expect(result).toBe('\uFFFDstart\uFFFDmid\uFFFDend');
      expect(result).not.toContain('\x00');
      expect(result).not.toContain('\x01');
      expect(result).not.toContain('\x1B');
    });

    it('should not replace normal whitespace characters (tab, newline, carriage return)', () => {
      const input = 'line1\tindented\nline2\r\nline3';
      expect(helpers.cleanBinaryCharacters(input)).toBe(input);
    });

    it('should leave regular text unchanged', () => {
      expect(helpers.cleanBinaryCharacters('Hello World 123!')).toBe('Hello World 123!');
    });

    it('should replace all purely binary control characters', () => {
      const binaryCodes = [
        0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x0b, 0x0c, 0x0e, 0x0f, 0x10,
        0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e,
        0x1f, 0x7f,
      ];
      const input = binaryCodes.map((c) => String.fromCharCode(c)).join('');
      const result = helpers.cleanBinaryCharacters(input);
      expect(result).toBe('\uFFFD'.repeat(binaryCodes.length));
    });

    it('should replace BS (\\x08) control character', () => {
      expect(helpers.cleanBinaryCharacters('foo\x08bar')).toBe('foo\uFFFDbar');
    });

    it('should replace VT (\\x0B) control character', () => {
      expect(helpers.cleanBinaryCharacters('foo\x0Bbar')).toBe('foo\uFFFDbar');
    });

    it('should replace FF (\\x0C) control character', () => {
      expect(helpers.cleanBinaryCharacters('foo\x0Cbar')).toBe('foo\uFFFDbar');
    });

    it('should replace SO..SI and DLE (\\x0E-\\x10) control characters', () => {
      const input = 'a\x0Eb\x0Fc\x10d';
      expect(helpers.cleanBinaryCharacters(input)).toBe('a\uFFFDb\uFFFDc\uFFFDd');
    });

    it('should replace FS..US (\\x1C-\\x1F) control characters', () => {
      const input = 'a\x1Cb\x1Dc\x1Ed\x1Fe';
      expect(helpers.cleanBinaryCharacters(input)).toBe('a\uFFFDb\uFFFDc\uFFFDd\uFFFDe');
    });

    it('should replace DEL (\\x7F) control character', () => {
      expect(helpers.cleanBinaryCharacters('foo\x7Fbar')).toBe('foo\uFFFDbar');
    });

    it('should preserve only TAB, LF, CR among C0 whitespace controls', () => {
      expect(helpers.cleanBinaryCharacters('\t\n\r')).toBe('\t\n\r');
    });
  });

  describe('sanitizeField', () => {
    it('should return null/undefined for null/undefined input', () => {
      expect(helpers.sanitizeField(null, 256)).toBeNull();
      expect(helpers.sanitizeField(undefined, 256)).toBeUndefined();
    });

    it('should return empty string for empty string input', () => {
      expect(helpers.sanitizeField('', 256)).toBe('');
    });

    it('should not truncate strings within limit', () => {
      expect(helpers.sanitizeField('short', 256)).toBe('short');
    });

    it('should truncate strings exceeding limit with "..." suffix', () => {
      const input = 'a'.repeat(300);
      const result = helpers.sanitizeField(input, 256);
      expect(result.length).toBe(256);
      expect(result.endsWith('...')).toBe(true);
    });

    it('should clean binary characters and truncate', () => {
      const input = 'bad\x00name' + 'n'.repeat(300);
      const result = helpers.sanitizeField(input, 256);
      expect(result).not.toContain('\x00');
      expect(result.length).toBe(256);
      expect(result.endsWith('...')).toBe(true);
    });

    it('should skip binary cleanup when replaceBinaryChars is false', () => {
      const input = 'bad\x00name';
      const result = helpers.sanitizeField(input, 256, { replaceBinaryChars: false });
      expect(result).toContain('\x00');
    });

    it('should skip truncation when truncateFields is false', () => {
      const input = 'a'.repeat(300);
      const result = helpers.sanitizeField(input, 256, { truncateFields: false });
      expect(result.length).toBe(300);
    });

    it('should handle limit of 0', () => {
      expect(helpers.sanitizeField('test', 0)).toBe('');
    });

    it('should handle limit smaller than replacement length', () => {
      const result = helpers.sanitizeField('a'.repeat(10), 2);
      expect(result.length).toBe(2);
    });
  });

  describe('truncateAttributes', () => {
    it('should return non-array input unchanged', () => {
      expect(helpers.truncateAttributes(null)).toBeNull();
      expect(helpers.truncateAttributes(undefined)).toBeUndefined();
    });

    it('should filter out non-object entries', () => {
      const result = helpers.truncateAttributes(['string', 123, { key: 'k', value: 'v' }]);
      expect(result).toEqual([{ key: 'k', value: 'v' }]);
    });

    it('should truncate attribute keys longer than 128 chars', () => {
      const longKey = 'k'.repeat(140);
      const result = helpers.truncateAttributes([{ key: longKey, value: 'v' }]);
      expect(result[0].key.length).toBe(128);
      expect(result[0].key.endsWith('...')).toBe(true);
    });

    it('should truncate attribute values longer than 128 chars', () => {
      const longValue = 'v'.repeat(140);
      const result = helpers.truncateAttributes([{ key: 'k', value: longValue }]);
      expect(result[0].value.length).toBe(128);
      expect(result[0].value.endsWith('...')).toBe(true);
    });

    it('should not truncate attributes within limit', () => {
      const result = helpers.truncateAttributes([{ key: 'k'.repeat(128), value: 'v'.repeat(128) }]);
      expect(result[0].key.length).toBe(128);
      expect(result[0].value.length).toBe(128);
    });

    it('should preserve system attribute flag', () => {
      const result = helpers.truncateAttributes([{ key: 'k', value: 'v', system: true }]);
      expect(result[0].system).toBe(true);
    });

    it('should limit attributes to 256 entries sorted by key', () => {
      const attributes = [];
      for (let i = 0; i < 300; i++) {
        attributes.push({ key: `k${i.toString().padStart(3, '0')}`, value: 'v' });
      }
      const result = helpers.truncateAttributes(attributes);
      expect(result.length).toBe(256);
      expect(result[0].key).toBe('k000');
      expect(result[255].key).toBe('k255');
    });

    it('should clean binary characters in attribute keys and values', () => {
      const result = helpers.truncateAttributes([{ key: 'a\x00key', value: 'v\x1Balue' }]);
      expect(result[0].key).not.toContain('\x00');
      expect(result[0].value).not.toContain('\x1B');
      expect(result[0].key).toContain('\uFFFD');
      expect(result[0].value).toContain('\uFFFD');
    });

    it('should skip binary cleanup when replaceBinaryChars is false', () => {
      const result = helpers.truncateAttributes([{ key: 'a\x00key', value: 'v\x1Balue' }], {
        replaceBinaryChars: false,
      });
      expect(result[0].key).toContain('\x00');
      expect(result[0].value).toContain('\x1B');
    });

    it('should skip length truncation when truncateAttributes is false', () => {
      const longValue = 'v'.repeat(200);
      const result = helpers.truncateAttributes([{ key: 'k', value: longValue }], {
        truncateAttributes: false,
      });
      expect(result[0].value.length).toBe(200);
    });

    it('should filter attributes without a value when truncation is enabled', () => {
      const result = helpers.truncateAttributes([
        { key: 'k1', value: 'v1' },
        { key: 'k2' },
      ]);
      expect(result.length).toBe(1);
      expect(result[0].key).toBe('k1');
    });

    it('should return empty array for empty input', () => {
      expect(helpers.truncateAttributes([])).toEqual([]);
    });
  });
});
