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

const getOAuthConfig = (options) => {
  const oauthParams = options.oauth || {};

  const { tokenEndpoint, username, password, clientId, clientSecret, scope } = oauthParams;

  if (!tokenEndpoint && !username && !password && !clientId) {
    return null;
  }

  if (!tokenEndpoint) {
    throw new ReportPortalRequiredOptionError('oauth.tokenEndpoint');
  }
  if (!username) {
    throw new ReportPortalRequiredOptionError('oauth.username');
  }
  if (!password) {
    throw new ReportPortalRequiredOptionError('oauth.password');
  }
  if (!clientId) {
    throw new ReportPortalRequiredOptionError('oauth.clientId');
  }

  return {
    tokenEndpoint,
    username,
    password,
    clientId,
    clientSecret,
    scope,
  };
};

const getClientConfig = (options) => {
  let calculatedOptions = options;
  try {
    if (typeof options !== 'object') {
      throw new ReportPortalValidationError('`options` must be an object.');
    }

    // Try to get OAuth config first
    const oauthConfig = getOAuthConfig(options);

    // If OAuth is not configured, apiKey is required
    let apiKey;
    if (!oauthConfig) {
      apiKey = getApiKey(options);
    } else {
      // If OAuth is configured, apiKey is optional (use it if provided)
      try {
        apiKey = getApiKey(options);
      } catch (error) {
        // Ignore error if OAuth is configured
        apiKey = null;
      }
    }

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
      oauth: oauthConfig,
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
  getOAuthConfig,
};
