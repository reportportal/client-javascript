import { getClientConfig, getRequiredOption, getApiKey } from '../lib/commons/config';
import {
  ReportPortalRequiredOptionError,
  ReportPortalValidationError,
} from '../lib/commons/errors';

describe('Config commons test suite', () => {
  describe('getRequiredOption', () => {
    it('should return option if it presented in options and has value', () => {
      const option = getRequiredOption({ project: 1 }, 'project');

      expect(option).toBe(1);
    });

    it('should throw ReportPortalRequiredOptionError in case of empty option', () => {
      let error;
      try {
        getRequiredOption({ project: undefined }, 'project');
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
      expect(error).toBeInstanceOf(ReportPortalRequiredOptionError);
    });

    it('should throw ReportPortalRequiredOptionError in case of option not present in options', () => {
      let error;
      try {
        getRequiredOption({ other: 1 } as any, 'project');
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
      expect(error).toBeInstanceOf(ReportPortalRequiredOptionError);
    });
  });

  describe('getApiKey', () => {
    it('should return apiKey if it presented in options and has value', () => {
      const apiKey = getApiKey({ apiKey: '1' });

      expect(apiKey).toBe('1');
    });

    it('should return apiKey if it provided in options via deprecated token option', () => {
      const apiKey = getApiKey({ token: '1' });

      expect(apiKey).toBe('1');
    });

    it('should print warning to console if deprecated token option used', () => {
      jest.spyOn(console, 'warn').mockImplementation();

      getApiKey({ token: '1' });

      expect(console.warn).toHaveBeenCalledWith(
        `Option 'token' is deprecated. Use 'apiKey' instead.`,
      );
    });

    it('should throw ReportPortalRequiredOptionError in case of no one option present', () => {
      let error;
      try {
        getApiKey({});
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
      expect(error).toBeInstanceOf(ReportPortalRequiredOptionError);
    });
  });

  describe('getClientConfig', () => {
    it('should print ReportPortalValidationError error to the console in case of options is not an object type', () => {
      jest.spyOn(console, 'dir').mockImplementation();
      getClientConfig('options' as any);

      expect(console.dir).toHaveBeenCalledWith(
        new ReportPortalValidationError('`options` must be an object.'),
      );
    });

    it('should print ReportPortalRequiredOptionError to the console in case of "endpoint" option missed', () => {
      jest.spyOn(console, 'dir').mockImplementation();
      getClientConfig({
        apiKey: '123',
        project: 'prj',
      });

      expect(console.dir).toHaveBeenCalledWith(new ReportPortalRequiredOptionError('endpoint'));
    });

    it('should print ReportPortalRequiredOptionError to the console in case of "project" option missed', () => {
      jest.spyOn(console, 'dir').mockImplementation();
      getClientConfig({
        apiKey: '123',
        endpoint: 'https://abc.com',
      });

      expect(console.dir).toHaveBeenCalledWith(new ReportPortalRequiredOptionError('project'));
    });

    it('should print ReportPortalRequiredOptionError to the console in case of "apiKey" option missed', () => {
      jest.spyOn(console, 'dir').mockImplementation();
      getClientConfig({
        project: 'prj',
        endpoint: 'https://abc.com',
      });

      expect(console.dir).toHaveBeenCalledWith(new ReportPortalRequiredOptionError('apiKey'));
    });
  });
});
