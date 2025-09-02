import { OUTPUT_TYPES } from '../lib/constants/outputs';

describe('OUTPUT_TYPES', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    process.env.RP_LAUNCH_UUID = '';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('STDOUT', () => {
    it('should log launch UUID to console.log', () => {
      const testUuid = 'test-launch-uuid-123';

      OUTPUT_TYPES.STDOUT(testUuid);

      expect(consoleLogSpy).toHaveBeenCalledWith(`Report Portal Launch UUID: ${testUuid}`);
    });
  });

  describe('STDERR', () => {
    it('should log launch UUID to console.error', () => {
      const testUuid = 'test-launch-uuid-456';

      OUTPUT_TYPES.STDERR(testUuid);

      expect(consoleErrorSpy).toHaveBeenCalledWith(`Report Portal Launch UUID: ${testUuid}`);
    });
  });

  describe('ENVIRONMENT', () => {
    it('should set RP_LAUNCH_UUID environment variable', () => {
      const testUuid = 'test-launch-uuid-789';

      OUTPUT_TYPES.ENVIRONMENT(testUuid);

      expect(process.env.RP_LAUNCH_UUID).toBe(testUuid);
    });
  });

  describe('FILE', () => {
    it('should be a function reference to helpers.saveLaunchUuidToFile', () => {
      expect(typeof OUTPUT_TYPES.FILE).toBe('function');
      expect(OUTPUT_TYPES.FILE).toBeDefined();
    });
  });
});
