const { ReportPortalRequiredOptionError, ReportPortalValidationError } = require('./errors');
const { OUTPUT_TYPES } = require('../constants/outputs');

const getOption = (options, optionName, defaultValue) => {
  if (!Object.prototype.hasOwnProperty.call(options, optionName) || !options[optionName]) {
    return defaultValue;
  }

  return options[optionName];
};

const getRequiredOption = (options, optionName) => {
  if (!Object.prototype.hasOwnProperty.call(options, optionName) || !options[optionName]) {
    throw new ReportPortalRequiredOptionError(optionName);
  }

  return options[optionName];
};

const getApiKey = ({ apiKey, token }) => {
  let calculatedApiKey = apiKey;
  if (!calculatedApiKey) {
    calculatedApiKey = token;
    if (!calculatedApiKey) {
      throw new ReportPortalRequiredOptionError('apiKey');
    } else {
      console.warn(`Option 'token' is deprecated. Use 'apiKey' instead.`);
    }
  }

  return calculatedApiKey;
};

const getClientConfig = (options) => {
  let calculatedOptions = options;
  try {
    if (typeof options !== 'object') {
      throw new ReportPortalValidationError('`options` must be an object.');
    }
    const apiKey = getApiKey(options);
    const project = getRequiredOption(options, 'project');
    const endpoint = getRequiredOption(options, 'endpoint');

    const launchUuidPrintOutputType = getOption(options, 'launchUuidPrintOutput', 'STDOUT')
      .toString()
      .toUpperCase();
    const launchUuidPrintOutput = getOption(
      OUTPUT_TYPES,
      launchUuidPrintOutputType,
      OUTPUT_TYPES.STDOUT,
    );

    calculatedOptions = {
      apiKey,
      project,
      endpoint,
      launch: options.launch,
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
    console.dir(error);
  }

  return calculatedOptions;
};

module.exports = {
  getClientConfig,
  getRequiredOption,
  getApiKey,
};
