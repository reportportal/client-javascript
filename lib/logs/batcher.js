const { calculateMultipartSize } = require('./helpers');
const { MAX_LOG_BATCH_SIZE, MAX_LOG_BATCH_PAYLOAD_SIZE } = require('./constants');

/**
 * Batches log entries to optimize network requests.
 * Accumulates logs until reaching size or count limits, then returns complete batches.
 */
class LogBatcher {
  /**
   * Creates a new LogBatcher instance.
   * @param {number} entryNum - maximum number of log entries per batch
   * @param {number} payloadLimit - maximum payload size in bytes per batch
   */
  constructor(entryNum = MAX_LOG_BATCH_SIZE, payloadLimit = MAX_LOG_BATCH_PAYLOAD_SIZE) {
    this.entryNum = entryNum;
    this.payloadLimit = payloadLimit;
    this.batch = [];
    this.payloadSize = 0;
  }

  /**
   * Internal method to append a log request with known size.
   * @private
   * @param {number} size - calculated size of the log request in bytes
   * @param {Object} logReq - log request object with payload and optional file
   * @returns {Array|null} batch array if ready to send, null otherwise
   */
  appendInternal(size, logReq) {
    if (size >= this.payloadLimit) {
      if (this.batch.length > 0) {
        const { batch } = this;
        this.batch = [logReq];
        this.payloadSize = size;
        return batch;
      }
      return [logReq];
    }

    if (this.payloadSize + size >= this.payloadLimit) {
      if (this.batch.length > 0) {
        const { batch } = this;
        this.batch = [logReq];
        this.payloadSize = size;
        return batch;
      }
    }

    this.batch.push(logReq);
    this.payloadSize += size;

    if (this.batch.length < this.entryNum) {
      return null;
    }

    const { batch } = this;
    this.batch = [];
    this.payloadSize = 0;
    return batch;
  }

  /**
   * Appends a log request to the batch.
   * @param {Object} logReq - log request with payload and optional file
   * @returns {Array|null} batch if ready, null otherwise
   */
  append(logReq) {
    const size = calculateMultipartSize(logReq.payload, logReq.file);
    return this.appendInternal(size, logReq);
  }

  /**
   * Flushes all pending log requests in the current batch.
   * @returns {Array|null} batch array if there are pending logs, null if empty
   */
  flush() {
    if (this.batch.length <= 0) {
      return null;
    }

    const { batch } = this;
    this.batch = [];
    this.payloadSize = 0;
    return batch;
  }

  /**
   * Gets the current number of log entries in the batch.
   * @returns {number} number of pending log entries
   */
  get batchSize() {
    return this.batch.length;
  }

  /**
   * Gets the current payload size of the batch in bytes.
   * @returns {number} current payload size in bytes
   */
  get currentPayloadSize() {
    return this.payloadSize;
  }
}

module.exports = LogBatcher;
