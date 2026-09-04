import axios, { AxiosInstance } from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import OAuthInterceptor from '../src/oauth';

jest.mock('axios', () => ({
  post: jest.fn(),
  isAxiosError: jest.fn(
    (error: unknown) => !!error && typeof error === 'object' && (error as { isAxiosError?: boolean }).isAxiosError === true,
  ),
}));

// The whole `axios` module is replaced by the factory above, so its real (unmocked) type
// doesn't reflect what's actually exported at runtime - this alias gives typed access to the
// mock methods (`.mockResolvedValue`, `.mock.calls`, ...) on the two functions the factory does provide.
const mockedAxios = axios as unknown as {
  post: jest.Mock;
  isAxiosError: jest.Mock;
};

// `accessToken` / `refreshToken` / `tokenExpiresAt` / `tokenRenewPromise` are private on
// OAuthInterceptor by design (external callers only need `getAccessToken`/`attach`); these tests
// deliberately reach into that internal state to set up scenarios, so they need a typed escape hatch.
interface OAuthInterceptorInternal {
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: number | null;
  tokenRenewPromise: Promise<string> | null;
  getAccessToken(): Promise<string>;
  attach(axiosInstance: AxiosInstance): void;
  logDebug(message: string, data?: unknown): void;
}
const asInternal = (interceptor: OAuthInterceptor): OAuthInterceptorInternal =>
  interceptor as unknown as OAuthInterceptorInternal;

// Minimal stand-in for the axios instance passed to `attach()` - only `interceptors.request.use`
// is exercised, so the mock only needs to capture the two handlers it's called with.
type RequestHandler = (config: { headers: Record<string, string>; url: string }) => Promise<{
  headers: Record<string, string>;
  url: string;
}>;
type RejectionHandler = (error: unknown) => Promise<unknown>;
const createAxiosInstanceMock = () => {
  let requestHandler: RequestHandler | undefined;
  let rejectionHandler: RejectionHandler | undefined;
  const axiosInstance = {
    interceptors: {
      request: {
        use: jest.fn((fulfilled: RequestHandler, rejected: RejectionHandler) => {
          requestHandler = fulfilled;
          rejectionHandler = rejected;
        }),
      },
    },
  };
  return {
    axiosInstance,
    getRequestHandler: () => requestHandler as RequestHandler,
    getRejectionHandler: () => rejectionHandler as RejectionHandler,
  };
};

describe('OAuthInterceptor', () => {
  const baseConfig = {
    tokenEndpoint: 'https://auth.example.com/oauth/token',
    username: 'user',
    password: 'password',
    clientId: 'client-id',
    clientSecret: 'client-secret',
    scope: 'basic',
  };
  const TOKEN_REFRESH_THRESHOLD_MS = 60000;
  const DEFAULT_TOKEN_EXPIRATION_MS = 3600000;

  beforeEach(() => {
    mockedAxios.post.mockReset();
  });

  it('requests an access token using password grant on first call', async () => {
    const baseTime = 1700000000000;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => baseTime);
    const oauthInterceptor = new OAuthInterceptor(baseConfig);
    mockedAxios.post.mockResolvedValue({
      data: {
        access_token: 'token-123',
        refresh_token: 'refresh-123',
        expires_in: 120,
      },
    });

    const token = await oauthInterceptor.getAccessToken();

    expect(token).toBe('token-123');
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    const [url, params, config] = mockedAxios.post.mock.calls[0];

    expect(url).toBe(baseConfig.tokenEndpoint);
    expect(params).toBeInstanceOf(URLSearchParams);
    expect(params.get('grant_type')).toBe('password');
    expect(params.get('username')).toBe(baseConfig.username);
    expect(params.get('password')).toBe(baseConfig.password);
    expect(params.get('client_id')).toBe(baseConfig.clientId);
    expect(params.get('client_secret')).toBe(baseConfig.clientSecret);
    expect(params.get('scope')).toBe(baseConfig.scope);
    expect(config.headers).toEqual({ 'Content-Type': 'application/x-www-form-urlencoded' });
    expect(config.httpsAgent).toBeDefined(); // Default agent added
    expect(asInternal(oauthInterceptor).refreshToken).toBe('refresh-123');
    expect(asInternal(oauthInterceptor).tokenExpiresAt).toBe(baseTime + 120000);

    nowSpy.mockRestore();
  });

  it('returns cached token when it is not expiring soon', async () => {
    const baseTime = 1700000100000;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => baseTime);
    const oauthInterceptor = asInternal(new OAuthInterceptor(baseConfig));
    oauthInterceptor.accessToken = 'cached-token';
    oauthInterceptor.tokenExpiresAt = baseTime + TOKEN_REFRESH_THRESHOLD_MS + 5000;

    const token = await oauthInterceptor.getAccessToken();

    expect(token).toBe('cached-token');
    expect(mockedAxios.post).not.toHaveBeenCalled();

    nowSpy.mockRestore();
  });

  it('refreshes token using stored refresh token when it is close to expiring', async () => {
    const baseTime = 1700000200000;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => baseTime);
    const oauthInterceptor = asInternal(new OAuthInterceptor(baseConfig));
    oauthInterceptor.accessToken = 'stale-token';
    oauthInterceptor.refreshToken = 'stored-refresh';
    oauthInterceptor.tokenExpiresAt = baseTime + TOKEN_REFRESH_THRESHOLD_MS - 1000;
    mockedAxios.post.mockResolvedValue({
      data: {
        access_token: 'fresh-token',
        refresh_token: 'fresh-refresh',
      },
    });

    const token = await oauthInterceptor.getAccessToken();

    expect(token).toBe('fresh-token');
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    const [, params] = mockedAxios.post.mock.calls[0];
    expect(params.get('grant_type')).toBe('refresh_token');
    expect(params.get('refresh_token')).toBe('stored-refresh');
    expect(oauthInterceptor.refreshToken).toBe('fresh-refresh');
    expect(oauthInterceptor.tokenExpiresAt).toBe(baseTime + DEFAULT_TOKEN_EXPIRATION_MS);

    nowSpy.mockRestore();
  });

  it('waits for ongoing token renewal and reuses the resolved token', async () => {
    const baseTime = 1700000300000;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => baseTime);
    const oauthInterceptor = asInternal(new OAuthInterceptor(baseConfig));

    let resolveRequest: (value: unknown) => void;
    const tokenResponsePromise = new Promise((resolve) => {
      resolveRequest = resolve;
    });
    mockedAxios.post.mockReturnValue(tokenResponsePromise);

    const firstCall = oauthInterceptor.getAccessToken();
    const secondCall = oauthInterceptor.getAccessToken();

    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    resolveRequest!({
      data: {
        access_token: 'shared-token',
        refresh_token: 'shared-refresh',
        expires_in: 1800,
      },
    });

    const [token1, token2] = await Promise.all([firstCall, secondCall]);

    expect(token1).toBe('shared-token');
    expect(token2).toBe('shared-token');
    expect(oauthInterceptor.tokenRenewPromise).toBeNull();

    nowSpy.mockRestore();
  });

  it('logs an error and throws descriptive message when token request fails', async () => {
    const oauthInterceptor = new OAuthInterceptor(baseConfig);
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    mockedAxios.post.mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 400,
        data: { error: 'invalid_grant' },
      },
    });

    await expect(oauthInterceptor.getAccessToken()).rejects.toThrow(
      'OAuth token request failed: 400 - {"error":"invalid_grant"}',
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      '[OAuth] OAuth token request failed: 400 - {"error":"invalid_grant"}',
    );

    consoleSpy.mockRestore();
  });

  it('throws a descriptive error when the token response has no access token', async () => {
    const oauthInterceptor = new OAuthInterceptor(baseConfig);
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    // Response resolves successfully but is missing the access_token field.
    mockedAxios.post.mockResolvedValue({ data: { expires_in: 120 } });

    await expect(oauthInterceptor.getAccessToken()).rejects.toThrow(
      'OAuth token request failed: No access token received from OAuth server',
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      '[OAuth] OAuth token request failed: No access token received from OAuth server',
    );

    consoleSpy.mockRestore();
  });

  it('formats non-Axios errors using their message', async () => {
    const oauthInterceptor = new OAuthInterceptor(baseConfig);
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    // A plain Error (not an AxiosError, so no response payload to include).
    mockedAxios.post.mockRejectedValue(new Error('network is unreachable'));

    await expect(oauthInterceptor.getAccessToken()).rejects.toThrow(
      'OAuth token request failed: network is unreachable',
    );

    consoleSpy.mockRestore();
  });

  it('propagates request errors through the attached rejection handler', async () => {
    const oauthInterceptor = new OAuthInterceptor(baseConfig);
    const { axiosInstance, getRejectionHandler } = createAxiosInstanceMock();

    oauthInterceptor.attach(axiosInstance as unknown as AxiosInstance);
    const error = new Error('request setup failed');

    await expect(getRejectionHandler()(error)).rejects.toBe(error);
  });

  it('logs debug messages only when debug mode is enabled', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    const oauthInterceptor = new OAuthInterceptor({
      ...baseConfig,
      restClientConfig: { debug: true },
    });
    oauthInterceptor.logDebug('message', { foo: 'bar' });

    expect(consoleSpy).toHaveBeenCalledWith('[OAuth] message', { foo: 'bar' });

    consoleSpy.mockRestore();
  });

  it('injects Authorization header through attached request interceptor', async () => {
    const baseTime = 1700000400000;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => baseTime);
    const oauthInterceptor = asInternal(new OAuthInterceptor(baseConfig));
    oauthInterceptor.accessToken = 'cached-token';
    oauthInterceptor.tokenExpiresAt = baseTime + TOKEN_REFRESH_THRESHOLD_MS + 1000;
    const { axiosInstance, getRequestHandler } = createAxiosInstanceMock();

    oauthInterceptor.attach(axiosInstance as unknown as AxiosInstance);
    const requestConfig = await getRequestHandler()({ headers: {}, url: '/launch' });

    expect(requestConfig.headers.Authorization).toBe('Bearer cached-token');
    expect(mockedAxios.post).not.toHaveBeenCalled();

    nowSpy.mockRestore();
  });

  it('keeps request going when Authorization injection fails', async () => {
    const oauthInterceptor = new OAuthInterceptor(baseConfig);
    const error = new Error('refresh failed');
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const tokenSpy = jest.spyOn(oauthInterceptor, 'getAccessToken').mockRejectedValue(error);
    const { axiosInstance, getRequestHandler } = createAxiosInstanceMock();

    oauthInterceptor.attach(axiosInstance as unknown as AxiosInstance);
    const requestConfig = await getRequestHandler()({ headers: {}, url: '/launch' });

    expect(requestConfig.headers.Authorization).toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      '[OAuth] Failed to obtain access token, request may fail:',
      'refresh failed',
    );
    expect(tokenSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
    tokenSpy.mockRestore();
  });

  it('falls back to password grant when refresh token is expired or invalid', async () => {
    const baseTime = 1700000500000;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => baseTime);
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const oauthInterceptor = asInternal(new OAuthInterceptor(baseConfig));
    oauthInterceptor.accessToken = 'old-token';
    oauthInterceptor.refreshToken = 'expired-refresh-token';
    oauthInterceptor.tokenExpiresAt = baseTime - 1000; // Token already expired

    // First call (refresh token) fails
    mockedAxios.post
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 400,
          data: { error: 'invalid_grant', error_description: 'refresh token expired' },
        },
      })
      // Second call (password grant fallback) succeeds
      .mockResolvedValueOnce({
        data: {
          access_token: 'new-token-from-password',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
        },
      });

    const token = await oauthInterceptor.getAccessToken();

    expect(token).toBe('new-token-from-password');
    expect(mockedAxios.post).toHaveBeenCalledTimes(2);

    // First call should be refresh_token grant
    const [, firstParams] = mockedAxios.post.mock.calls[0];
    expect(firstParams.get('grant_type')).toBe('refresh_token');
    expect(firstParams.get('refresh_token')).toBe('expired-refresh-token');

    // Second call should be password grant
    const [, secondParams] = mockedAxios.post.mock.calls[1];
    expect(secondParams.get('grant_type')).toBe('password');
    expect(secondParams.get('username')).toBe(baseConfig.username);
    expect(secondParams.get('password')).toBe(baseConfig.password);

    // Verify new tokens are stored
    expect(oauthInterceptor.accessToken).toBe('new-token-from-password');
    expect(oauthInterceptor.refreshToken).toBe('new-refresh-token');

    // Verify warning was logged
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[OAuth] Refresh token expired or invalid, re-authenticating with password grant',
    );

    nowSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('throws error when both refresh token and password grant fail', async () => {
    const baseTime = 1700000600000;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => baseTime);
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const oauthInterceptor = asInternal(new OAuthInterceptor(baseConfig));
    oauthInterceptor.refreshToken = 'expired-refresh-token';
    oauthInterceptor.tokenExpiresAt = baseTime - 1000;

    // Both calls fail
    mockedAxios.post
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 400,
          data: { error: 'invalid_grant' },
        },
      })
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 401,
          data: { error: 'invalid_credentials' },
        },
      });

    await expect(oauthInterceptor.getAccessToken()).rejects.toThrow(
      'OAuth password grant fallback failed: 401 - {"error":"invalid_credentials"}',
    );

    expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    expect(consoleWarnSpy).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[OAuth] OAuth password grant fallback failed: 401 - {"error":"invalid_credentials"}',
    );

    nowSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('uses proxy configuration for token requests', async () => {
    const baseTime = 1700000700000;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => baseTime);
    const configWithProxy = {
      ...baseConfig,
      restClientConfig: {
        proxy: {
          protocol: 'https',
          host: '127.0.0.1',
          port: 9000,
        },
      },
    };
    const oauthInterceptor = new OAuthInterceptor(configWithProxy);
    mockedAxios.post.mockResolvedValue({
      data: {
        access_token: 'token-with-proxy',
        expires_in: 120,
      },
    });

    const token = await oauthInterceptor.getAccessToken();

    expect(token).toBe('token-with-proxy');
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    const [url, , config] = mockedAxios.post.mock.calls[0];

    expect(url).toBe(baseConfig.tokenEndpoint);
    expect(config.headers).toEqual({ 'Content-Type': 'application/x-www-form-urlencoded' });
    expect(config.httpsAgent).toBeInstanceOf(HttpsProxyAgent);

    nowSpy.mockRestore();
  });

  it('logs the proxied token request when debug and proxy are both enabled', async () => {
    const baseTime = 1700000750000;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => baseTime);
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    const oauthInterceptor = new OAuthInterceptor({
      ...baseConfig,
      restClientConfig: {
        debug: true,
        proxy: {
          protocol: 'https',
          host: '127.0.0.1',
          port: 9000,
        },
      },
    });
    mockedAxios.post.mockResolvedValue({
      data: { access_token: 'token-debug-proxy', expires_in: 120 },
    });

    const token = await oauthInterceptor.getAccessToken();

    expect(token).toBe('token-debug-proxy');
    expect(consoleSpy).toHaveBeenCalledWith(
      `[OAuth] Making token request to ${baseConfig.tokenEndpoint} with proxy agent`,
      '',
    );

    consoleSpy.mockRestore();
    nowSpy.mockRestore();
  });

  it('bypasses proxy for token endpoint when in noProxy list', async () => {
    const baseTime = 1700000800000;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => baseTime);
    const configWithNoProxy = {
      ...baseConfig,
      restClientConfig: {
        proxy: {
          protocol: 'https',
          host: '127.0.0.1',
          port: 9000,
        },
        noProxy: 'auth.example.com',
      },
    };
    const oauthInterceptor = new OAuthInterceptor(configWithNoProxy);
    mockedAxios.post.mockResolvedValue({
      data: {
        access_token: 'token-no-proxy',
        expires_in: 120,
      },
    });

    const token = await oauthInterceptor.getAccessToken();

    expect(token).toBe('token-no-proxy');
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    const [url, , config] = mockedAxios.post.mock.calls[0];

    expect(url).toBe(baseConfig.tokenEndpoint);
    expect(config.headers).toEqual({ 'Content-Type': 'application/x-www-form-urlencoded' });
    // Should use default agent, not proxy agent
    expect(config.httpsAgent).toBeDefined();
    expect(config.httpsAgent.constructor.name).toBe('Agent');

    nowSpy.mockRestore();
  });
});
