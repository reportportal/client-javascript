import * as helpers from '../helpers';

export const OUTPUT_TYPES = {
  STDOUT: (launchUuid: string) => console.log(`Report Portal Launch UUID: ${launchUuid}`),
  STDERR: (launchUuid: string) => console.error(`Report Portal Launch UUID: ${launchUuid}`),
  ENVIRONMENT: (launchUuid: string) => (process.env.RP_LAUNCH_UUID = launchUuid),
  FILE: helpers.saveLaunchUuidToFile,
};
