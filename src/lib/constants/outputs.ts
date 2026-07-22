import * as helpers from '../helpers';

export type OutputHandler = (launchUuid: string) => void;

export const OUTPUT_TYPES: Record<string, OutputHandler> = {
  // eslint-disable-next-line no-console
  STDOUT: (launchUuid) => console.log(`Report Portal Launch UUID: ${launchUuid}`),
  // eslint-disable-next-line no-console
  STDERR: (launchUuid) => console.error(`Report Portal Launch UUID: ${launchUuid}`),
  // eslint-disable-next-line no-return-assign
  ENVIRONMENT: (launchUuid) => (process.env.RP_LAUNCH_UUID = launchUuid),
  FILE: helpers.saveLaunchUuidToFile,
};
