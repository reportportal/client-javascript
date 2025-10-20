const axios = require('axios');
const OAuthInterceptor = require('../lib/oauth');

jest.mock('axios', () => ({
  post: jest.fn(),
}));

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
    axios.post.mockReset();
  });

  it('requests an access token using password grant on first call', async () => {
    const baseTime = 1700000000000;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => baseTime);
    const oauthInterceptor = new OAuthInterceptor(baseConfig);
    axios.post.mockResolvedValue({
      data: {
        access_token: 'token-123',
        refresh_token: 'refresh-123',
        expires_in: 120,
      },
    });

    const token = await oauthInterceptor.getAccessToken();

    expect(token).toBe('token-123');
    expect(axios.post).toHaveBeenCalledTimes(1);
    const [url, params, config] = axios.post.mock.calls[0];

    expect(url).toBe(baseConfig.tokenEndpoint);
    expect(params).toBeInstanceOf(URLSearchParams);
    expect(params.get('grant_type')).toBe('password');
    expect(params.get('username')).toBe(baseConfig.username);
    expect(params.get('password')).toBe(baseConfig.password);
    expect(params.get('client_id')).toBe(baseConfig.clientId);
    expect(params.get('client_secret')).toBe(baseConfig.clientSecret);
    expect(params.get('scope')).toBe(baseConfig.scope);
    expect(config).toEqual({
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    expect(oauthInterceptor.refreshToken).toBe('refresh-123');
    expect(oauthInterceptor.tokenExpiresAt).toBe(baseTime + 120000);

    nowSpy.mockRestore();
  });

  it('returns cached token when it is not expiring soon', async () => {
    const baseTime = 1700000100000;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => baseTime);
    const oauthInterceptor = new OAuthInterceptor(baseConfig);
    oauthInterceptor.accessToken = 'cached-token';
    oauthInterceptor.tokenExpiresAt = baseTime + TOKEN_REFRESH_THRESHOLD_MS + 5000;

    const token = await oauthInterceptor.getAccessToken();

    expect(token).toBe('cached-token');
    expect(axios.post).not.toHaveBeenCalled();

    nowSpy.mockRestore();
  });

  it('refreshes token using stored refresh token when it is close to expiring', async () => {
    const baseTime = 1700000200000;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => baseTime);
    const oauthInterceptor = new OAuthInterceptor(baseConfig);
    oauthInterceptor.accessToken = 'stale-token';
    oauthInterceptor.refreshToken = 'stored-refresh';
    oauthInterceptor.tokenExpiresAt = baseTime + TOKEN_REFRESH_THRESHOLD_MS - 1000;
    axios.post.mockResolvedValue({
      data: {
        access_token: 'fresh-token',
        refresh_token: 'fresh-refresh',
      },
    });

    const token = await oauthInterceptor.getAccessToken();

    expect(token).toBe('fresh-token');
    expect(axios.post).toHaveBeenCalledTimes(1);
    const [, params] = axios.post.mock.calls[0];
    expect(params.get('grant_type')).toBe('refresh_token');
    expect(params.get('refresh_token')).toBe('stored-refresh');
    expect(oauthInterceptor.refreshToken).toBe('fresh-refresh');
    expect(oauthInterceptor.tokenExpiresAt).toBe(baseTime + DEFAULT_TOKEN_EXPIRATION_MS);

    nowSpy.mockRestore();
  });

  it('waits for ongoing token renewal and reuses the resolved token', async () => {
    const baseTime = 1700000300000;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => baseTime);
    const oauthInterceptor = new OAuthInterceptor(baseConfig);

    let resolveRequest;
    const tokenResponsePromise = new Promise((resolve) => {
      resolveRequest = resolve;
    });
    axios.post.mockReturnValue(tokenResponsePromise);

    const firstCall = oauthInterceptor.getAccessToken();
    const secondCall = oauthInterceptor.getAccessToken();

    expect(axios.post).toHaveBeenCalledTimes(1);
    resolveRequest({
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
    axios.post.mockRejectedValue({
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

  it('logs debug messages only when debug mode is enabled', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    const oauthInterceptor = new OAuthInterceptor({ ...baseConfig, debug: true });
    oauthInterceptor.logDebug('message', { foo: 'bar' });

    expect(consoleSpy).toHaveBeenCalledWith('[OAuth] message', { foo: 'bar' });

    consoleSpy.mockRestore();
  });

  it('injects Authorization header through attached request interceptor', async () => {
    const baseTime = 1700000400000;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => baseTime);
    const oauthInterceptor = new OAuthInterceptor(baseConfig);
    oauthInterceptor.accessToken = 'cached-token';
    oauthInterceptor.tokenExpiresAt = baseTime + TOKEN_REFRESH_THRESHOLD_MS + 1000;
    let requestHandler;
    const axiosInstance = {
      interceptors: {
        request: {
          use: jest.fn((fulfilled) => {
            requestHandler = fulfilled;
          }),
        },
      },
    };

    oauthInterceptor.attach(axiosInstance);
    const requestConfig = await requestHandler({ headers: {}, url: '/launch' });

    expect(requestConfig.headers.Authorization).toBe('Bearer cached-token');
    expect(axios.post).not.toHaveBeenCalled();

    nowSpy.mockRestore();
  });

  it('keeps request going when Authorization injection fails', async () => {
    const oauthInterceptor = new OAuthInterceptor(baseConfig);
    const error = new Error('refresh failed');
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const tokenSpy = jest.spyOn(oauthInterceptor, 'getAccessToken').mockRejectedValue(error);
    let requestHandler;
    const axiosInstance = {
      interceptors: {
        request: {
          use: jest.fn((fulfilled) => {
            requestHandler = fulfilled;
          }),
        },
      },
    };

    oauthInterceptor.attach(axiosInstance);
    const requestConfig = await requestHandler({ headers: {}, url: '/launch' });

    expect(requestConfig.headers.Authorization).toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      '[OAuth] Failed to obtain access token, request may fail:',
      'refresh failed',
    );
    expect(tokenSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
    tokenSpy.mockRestore();
  });
});
