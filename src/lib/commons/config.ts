import { ReportPortalRequiredOptionError, ReportPortalValidationError } from './errors';
import { OUTPUT_TYPES } from '../constants/outputs';
import type { NormalizedClientConfig, OAuthConfig, ReportPortalConfig } from '../models/config';

const getOption = <T, K extends keyof T>(
  options: T,
  optionName: K,
  defaultValue: NonNullable<T[K]>,
): NonNullable<T[K]> => {
  const value = options[optionName];
  if (!Object.prototype.hasOwnProperty.call(options, optionName) || !value) {
    return defaultValue;
  }

  return value as NonNullable<T[K]>;
};

export const getRequiredOption = <T, K extends keyof T>(options: T, optionName: K): T[K] => {
  if (!Object.prototype.hasOwnProperty.call(options, optionName) || !options[optionName]) {
    throw new ReportPortalRequiredOptionError(String(optionName));
  }

  return options[optionName];
};

export const getApiKey = ({
  apiKey,
  token,
}: Pick<ReportPortalConfig, 'apiKey' | 'token'>): string => {
  let calculatedApiKey = apiKey;
  if (!calculatedApiKey) {
    calculatedApiKey = token;
    if (!calculatedApiKey) {
      throw new ReportPortalRequiredOptionError('apiKey');
    } else {
      // eslint-disable-next-line no-console
      console.warn(`Option 'token' is deprecated. Use 'apiKey' instead.`);
    }
  }

  return calculatedApiKey;
};

export const getOAuthConfig = (options: ReportPortalConfig): OAuthConfig | null => {
  const oauthParams = options.oauth || ({} as Partial<OAuthConfig>);

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

const DEFAULT_CLIENT_CONFIG: NormalizedClientConfig = {
  apiKey: null,
  oauth: null,
  project: '',
  endpoint: '',
  isLaunchMergeRequired: false,
  launchUuidPrintOutput: OUTPUT_TYPES.STDOUT,
  skippedIsNotIssue: false,
};

export const getClientConfig = (options: ReportPortalConfig): NormalizedClientConfig => {
  let calculatedOptions = DEFAULT_CLIENT_CONFIG;
  try {
    if (typeof options !== 'object') {
      throw new ReportPortalValidationError('`options` must be an object.');
    }

    // Try to get OAuth config first
    const oauthConfig = getOAuthConfig(options);

    // If OAuth is not configured, apiKey is required
    let apiKey: string | null;
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
      skippedIsNotIssue: !!options.skippedIsNotIssue,
    };
  } catch (error) {
    // don't throw the error up to not break the entire process
    // eslint-disable-next-line no-console
    console.dir(error);
  }

  return calculatedOptions;
};
