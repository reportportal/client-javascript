const LogBatcher = require('../lib/logs/batcher');
const { MAX_LOG_BATCH_SIZE, MAX_LOG_BATCH_PAYLOAD_SIZE } = require('../lib/logs/constants');

describe('LogBatcher', () => {
  describe('constructor', () => {
    it('should create instance with default values', () => {
      const batcher = new LogBatcher();

      expect(batcher.entryNum).toBe(MAX_LOG_BATCH_SIZE);
      expect(batcher.payloadLimit).toBe(MAX_LOG_BATCH_PAYLOAD_SIZE);
      expect(batcher.batchSize).toBe(0);
      expect(batcher.currentPayloadSize).toBe(0);
    });

    it('should create instance with custom values', () => {
      const batcher = new LogBatcher(5, 1024);

      expect(batcher.entryNum).toBe(5);
      expect(batcher.payloadLimit).toBe(1024);
    });
  });

  describe('append', () => {
    it('should add log to batch and return null when not full', () => {
      const batcher = new LogBatcher(3, 10000);

      const logReq = {
        payload: { message: 'Test log', level: 'info' },
        file: null,
      };

      const result = batcher.append(logReq);

      expect(result).toBeNull();
      expect(batcher.batchSize).toBe(1);
    });

    it('should return batch when entry limit is reached', () => {
      const batcher = new LogBatcher(2, 10000);

      const logReq1 = {
        payload: { message: 'Test log 1', level: 'info' },
        file: null,
      };
      const logReq2 = {
        payload: { message: 'Test log 2', level: 'info' },
        file: null,
      };

      const result1 = batcher.append(logReq1);
      expect(result1).toBeNull();

      const result2 = batcher.append(logReq2);
      expect(result2).toBeInstanceOf(Array);
      expect(result2).toHaveLength(2);
      expect(result2[0]).toBe(logReq1);
      expect(result2[1]).toBe(logReq2);
      expect(batcher.batchSize).toBe(0);
    });

    it('should return batch when payload limit is exceeded', () => {
      const batcher = new LogBatcher(10, 300); // Small payload limit

      const logReq1 = {
        payload: { message: 'Small log', level: 'info' },
        file: null,
      };
      const logReq2 = {
        payload: {
          message: 'Large log with lots of content to exceed the payload limit',
          level: 'info',
        },
        file: null,
      };

      const result1 = batcher.append(logReq1);
      expect(result1).toBeNull();

      const result2 = batcher.append(logReq2);
      expect(result2).toBeInstanceOf(Array);
      expect(result2).toHaveLength(1);
      expect(result2[0]).toBe(logReq1);
      expect(batcher.batchSize).toBe(1);
    });

    it('should handle logs with file attachments', () => {
      const batcher = new LogBatcher(3, 10000);

      const logReq = {
        payload: { message: 'Test log with file', level: 'info' },
        file: {
          name: 'test.png',
          type: 'image/png',
          content: Buffer.from('fake image content').toString('base64'),
        },
      };

      const result = batcher.append(logReq);

      expect(result).toBeNull();
      expect(batcher.batchSize).toBe(1);
    });
  });

  describe('oversized log handling', () => {
    it('should return existing batch when adding an oversized log', () => {
      const batcher = new LogBatcher(10, 300);

      const normalLog = {
        payload: { message: 'Small log', level: 'info' },
        file: null,
      };

      const oversizedLog = {
        payload: {
          message: 'x'.repeat(1000), // This will exceed the 300 byte limit
          level: 'info',
        },
        file: null,
      };

      // Add a normal log first
      const result1 = batcher.append(normalLog);
      expect(result1).toBeNull();
      expect(batcher.batchSize).toBe(1);

      // Add an oversized log - should return the existing batch and queue the oversized log
      const result2 = batcher.append(oversizedLog);
      expect(result2).toBeInstanceOf(Array);
      expect(result2).toHaveLength(1);
      expect(result2[0]).toBe(normalLog);
      expect(batcher.batchSize).toBe(1); // oversized log is queued for next flush
    });

    it('should return oversized log as single-item batch when batch is empty', () => {
      const batcher = new LogBatcher(10, 300);

      const oversizedLog = {
        payload: {
          message: 'x'.repeat(1000), // This will exceed the 300 byte limit
          level: 'info',
        },
        file: null,
      };

      // Add an oversized log to empty batch
      const result = batcher.append(oversizedLog);
      expect(result).toBeInstanceOf(Array);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(oversizedLog);
      expect(batcher.batchSize).toBe(0);
    });

    it('should handle consecutive oversized logs correctly', () => {
      const batcher = new LogBatcher(10, 300);

      const oversizedLog1 = {
        payload: { message: 'x'.repeat(1000), level: 'info' },
        file: null,
      };

      const oversizedLog2 = {
        payload: { message: 'y'.repeat(1000), level: 'info' },
        file: null,
      };

      // First oversized log should be returned immediately
      const result1 = batcher.append(oversizedLog1);
      expect(result1).toBeInstanceOf(Array);
      expect(result1).toHaveLength(1);
      expect(result1[0]).toBe(oversizedLog1);

      // Second oversized log should also be returned immediately
      const result2 = batcher.append(oversizedLog2);
      expect(result2).toBeInstanceOf(Array);
      expect(result2).toHaveLength(1);
      expect(result2[0]).toBe(oversizedLog2);

      expect(batcher.batchSize).toBe(0);
    });
  });

  describe('flush', () => {
    it('should return null when batch is empty', () => {
      const batcher = new LogBatcher();

      const result = batcher.flush();

      expect(result).toBeNull();
    });

    it('should return current batch and clear it', () => {
      const batcher = new LogBatcher(10, 10000);

      const logReq1 = {
        payload: { message: 'Test log 1', level: 'info' },
        file: null,
      };
      const logReq2 = {
        payload: { message: 'Test log 2', level: 'info' },
        file: null,
      };

      batcher.append(logReq1);
      batcher.append(logReq2);

      const result = batcher.flush();

      expect(result).toBeInstanceOf(Array);
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(logReq1);
      expect(result[1]).toBe(logReq2);
      expect(batcher.batchSize).toBe(0);
      expect(batcher.currentPayloadSize).toBe(0);
    });

    it('should return null on second flush call', () => {
      const batcher = new LogBatcher(10, 10000);

      const logReq = {
        payload: { message: 'Test log', level: 'info' },
        file: null,
      };

      batcher.append(logReq);
      batcher.flush();

      const result = batcher.flush();

      expect(result).toBeNull();
    });
  });

  describe('batch accumulation', () => {
    it('should accumulate multiple batches correctly', () => {
      const batcher = new LogBatcher(2, 10000);

      const logReqs = [
        { payload: { message: 'Log 1' }, file: null },
        { payload: { message: 'Log 2' }, file: null },
        { payload: { message: 'Log 3' }, file: null },
        { payload: { message: 'Log 4' }, file: null },
      ];

      const batch1 = batcher.append(logReqs[0]);
      expect(batch1).toBeNull();

      const batch2 = batcher.append(logReqs[1]);
      expect(batch2).toHaveLength(2);

      const batch3 = batcher.append(logReqs[2]);
      expect(batch3).toBeNull();

      const batch4 = batcher.append(logReqs[3]);
      expect(batch4).toHaveLength(2);
    });
  });

  describe('edge cases', () => {
    it('should handle empty payload', () => {
      const batcher = new LogBatcher();

      const logReq = {
        payload: {},
        file: null,
      };

      const result = batcher.append(logReq);

      expect(result).toBeNull();
      expect(batcher.batchSize).toBe(1);
    });

    it('should handle very large single log', () => {
      const batcher = new LogBatcher(10, 100);

      const largeLogReq = {
        payload: {
          message: 'x'.repeat(1000),
        },
        file: null,
      };

      const result = batcher.append(largeLogReq);

      // Should return immediately as single-item batch
      expect(result).toBeInstanceOf(Array);
      expect(result).toHaveLength(1);
      expect(batcher.batchSize).toBe(0);
    });

    it('should handle file content as Buffer', () => {
      const batcher = new LogBatcher(3, 10000);

      const logReq = {
        payload: { message: 'Test log with Buffer', level: 'info' },
        file: {
          name: 'test.txt',
          type: 'text/plain',
          content: Buffer.from('test content'),
        },
      };

      const result = batcher.append(logReq);

      expect(result).toBeNull();
      expect(batcher.batchSize).toBe(1);
    });

    it('should handle file content as string', () => {
      const batcher = new LogBatcher(3, 10000);

      const logReq = {
        payload: { message: 'Test log with string', level: 'info' },
        file: {
          name: 'test.txt',
          type: 'text/plain',
          content: 'test content as string',
        },
      };

      const result = batcher.append(logReq);

      expect(result).toBeNull();
      expect(batcher.batchSize).toBe(1);
    });

    it('should handle file content as array-like object', () => {
      const batcher = new LogBatcher(3, 10000);

      const logReq = {
        payload: { message: 'Test log with array-like', level: 'info' },
        file: {
          name: 'test.txt',
          type: 'text/plain',
          content: [1, 2, 3, 4, 5],
        },
      };

      const result = batcher.append(logReq);

      expect(result).toBeNull();
      expect(batcher.batchSize).toBe(1);
    });
  });
});
