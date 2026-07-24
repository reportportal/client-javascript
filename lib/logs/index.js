const LogBatcher = require('./batcher');
const {
  calculateJsonPartSize,
  calculateFilePartSize,
  calculateMultipartSize,
} = require('./helpers');
const { MAX_LOG_BATCH_SIZE, MAX_LOG_BATCH_PAYLOAD_SIZE } = require('./constants');

module.exports = {
  LogBatcher,
  calculateJsonPartSize,
  calculateFilePartSize,
  calculateMultipartSize,
  MAX_LOG_BATCH_SIZE,
  MAX_LOG_BATCH_PAYLOAD_SIZE,
};
