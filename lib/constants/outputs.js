const helpers = require('../helpers');

const OUTPUT_TYPES = {
  // eslint-disable-next-line no-console
  STDOUT: (launchUuid) => console.log(`Report Portal Launch UUID: ${launchUuid}`),
  // eslint-disable-next-line no-console
  STDERR: (launchUuid) => console.error(`Report Portal Launch UUID: ${launchUuid}`),
  // eslint-disable-next-line no-return-assign
  ENVIRONMENT: (launchUuid) => (process.env.RP_LAUNCH_UUID = launchUuid),
  FILE: helpers.saveLaunchUuidToFile,
};

module.exports = { OUTPUT_TYPES };
