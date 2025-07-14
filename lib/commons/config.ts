import { ReportPortalRequiredOptionError, ReportPortalValidationError } from './errors';
import { OUTPUT_TYPES } from '../constants/outputs';
import { ClientConfig } from '../types';

type OutputTypeKey = keyof typeof OUTPUT_TYPES;

function getOption<T, K extends keyof T>(options: T, optionName: K, defaultValue: T[K]): T[K] {
  if (!Object.prototype.hasOwnProperty.call(options, optionName) || !options[optionName]) {
    return defaultValue;
  }
  return options[optionName];
}

function getRequiredOption<T, K extends keyof T>(options: T, optionName: K): T[K] {
  if (!Object.prototype.hasOwnProperty.call(options, optionName) || !options[optionName]) {
    throw new ReportPortalRequiredOptionError(optionName as string);
  }
  return options[optionName];
}

function getApiKey(options: { apiKey?: string; token?: string }): string {
  let calculatedApiKey = options.apiKey;
  if (!calculatedApiKey) {
    calculatedApiKey = options.token;
    if (!calculatedApiKey) {
      throw new ReportPortalRequiredOptionError('apiKey');
    } else {
      // eslint-disable-next-line no-console
      console.warn(`Option 'token' is deprecated. Use 'apiKey' instead.`);
    }
  }
  return calculatedApiKey;
}

function getClientConfig(options: Partial<ClientConfig>): ClientConfig {
  let calculatedOptions: ClientConfig;
  try {
    if (typeof options !== 'object' || options === null) {
      throw new ReportPortalValidationError('`options` must be an object.');
    }
    const apiKey = getApiKey(options);
    const project = getRequiredOption(options, 'project');
    const endpoint = getRequiredOption(options, 'endpoint');

    const launchUuidPrintOutputType = (
      getOption(options, 'launchUuidPrintOutput', 'STDOUT') ?? 'STDOUT'
    )
      .toString()
      .toUpperCase() as OutputTypeKey;
    const launchUuidPrintOutput = getOption<typeof OUTPUT_TYPES, OutputTypeKey>(
      OUTPUT_TYPES,
      launchUuidPrintOutputType,
      OUTPUT_TYPES.STDOUT,
    );

    calculatedOptions = {
      apiKey: apiKey as string,
      project: project as string,
      endpoint: endpoint as string,
      launch: options.launch as string,
      debug: options.debug,
      isLaunchMergeRequired:
        options.isLaunchMergeRequired === undefined ? false : options.isLaunchMergeRequired,
      headers: options.headers,
      restClientConfig: options.restClientConfig,
      attributes: options.attributes,
      mode: options.mode,
      description: options.description,
      launchUuidPrint: options.launchUuidPrint,
      launchUuidPrintOutput,
    };
  } catch (error) {
    // don't throw the error up to not break the entire process
    // eslint-disable-next-line no-console
    console.dir(error);
  }

  // @ts-ignore
  return calculatedOptions;
}

export { getClientConfig, getRequiredOption, getApiKey };
