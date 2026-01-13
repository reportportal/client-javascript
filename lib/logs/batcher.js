const { calculateMultipartSize } = require('./helpers');
const { MAX_LOG_BATCH_SIZE, MAX_LOG_BATCH_PAYLOAD_SIZE } = require('./constants');

/**
 * Batches log entries to optimize network requests.
 * Accumulates logs until reaching size or count limits, then returns complete batches.
 */
class LogBatcher {
  constructor(entryNum = MAX_LOG_BATCH_SIZE, payloadLimit = MAX_LOG_BATCH_PAYLOAD_SIZE) {
    this.entryNum = entryNum;
    this.payloadLimit = payloadLimit;
    this.batch = [];
    this.payloadSize = 0;
  }

  appendInternal(size, logReq) {
    if (size >= this.payloadLimit) {
      if (this.batch.length > 0) {
        const { batch } = this;
        this.batch = [];
        this.payloadSize = 0;
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
   * @param {Object} logReq - log request with payload and optional file
   * @returns {Array|null} batch if ready, null otherwise
   */
  append(logReq) {
    const size = calculateMultipartSize(logReq.payload, logReq.file);
    return this.appendInternal(size, logReq);
  }

  flush() {
    if (this.batch.length <= 0) {
      return null;
    }

    const { batch } = this;
    this.batch = [];
    this.payloadSize = 0;
    return batch;
  }

  get batchSize() {
    return this.batch.length;
  }

  get currentPayloadSize() {
    return this.payloadSize;
  }
}

module.exports = LogBatcher;
