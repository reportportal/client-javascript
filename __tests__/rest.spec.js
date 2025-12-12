const nock = require('nock');
const isEqual = require('lodash/isEqual');
const http = require('http');
const RestClient = require('../lib/rest');
const logger = require('../lib/logger');

describe('RestClient', () => {
  const options = {
    baseURL: 'http://report-portal-host:8080/api/v1',
    headers: {
      'User-Agent': 'NodeJS',
      Authorization: 'Bearer 00000000-0000-0000-0000-000000000000',
    },
    restClientConfig: {
      agent: {
        rejectUnauthorized: false,
      },
      timeout: 0,
    },
  };
  const noOptions = {};
  const getRetryAttempts = (client) => client.getRetryConfig().retries + 1;
  const restClient = new RestClient(options);
  const restClientNoRetry = new RestClient({
    ...options,
    restClientConfig: {
      ...options.restClientConfig,
      retry: 0,
    },
  });
  const retryAttempts = getRetryAttempts(restClient);

  const unathorizedError = {
    error: 'unauthorized',
    error_description: 'Full authentication is required to access this resource',
  };
  const unauthorizedErrorMessage =
    'Request failed with status code 403: ' +
    '{"error":"unauthorized","error_description":"Full authentication is required to access this resource"}';
  const netErrConnectionResetError = { code: 'ECONNABORTED', message: 'connection reset' };

  describe('constructor', () => {
    it('creates object with correct properties', () => {
      expect(restClient.baseURL).toBe(options.baseURL);
      expect(restClient.headers).toEqual(options.headers);
      expect(restClient.restClientConfig).toEqual(options.restClientConfig);
      expect(restClient.axiosInstance).toBeDefined();
    });

    it('adds Logger to axios instance if enabled', () => {
      const spyLogger = jest.spyOn(logger, 'addLogger').mockReturnValue();
      const optionsWithLoggerEnabled = {
        ...options,
        restClientConfig: {
          ...options.restClientConfig,
          debug: true,
        },
      };
      const client = new RestClient(optionsWithLoggerEnabled);

      expect(spyLogger).toHaveBeenCalledWith(client.axiosInstance);
    });
  });

  describe('retry configuration', () => {
    it('uses a production-ready retry policy by default', () => {
      const retryConfig = restClient.getRetryConfig();
      const mathRandomSpy = jest.spyOn(Math, 'random').mockImplementationOnce(() => 0);

      expect(retryConfig.retries).toBe(6);
      expect(retryAttempts).toBe(retryConfig.retries + 1);
      expect(retryConfig.shouldResetTimeout).toBe(true);
      expect(retryConfig.retryDelay(1)).toBe(200);

      mathRandomSpy.mockImplementationOnce(() => 1);
      expect(retryConfig.retryDelay(4)).toBeCloseTo(1600 * 0.6);

      mathRandomSpy.mockImplementationOnce(() => 0);
      expect(retryConfig.retryDelay(10)).toBe(5000);

      mathRandomSpy.mockRestore();
    });

    it('uses custom retry attempts when a numeric value is provided', (done) => {
      const customRetries = 2;
      const client = new RestClient({
        ...options,
        restClientConfig: {
          ...options.restClientConfig,
          retry: customRetries,
        },
      });
      expect(getRetryAttempts(client)).toBe(customRetries + 1);

      const scope = nock(options.baseURL)
        .get('/users/custom-retry-number')
        .times(getRetryAttempts(client))
        .replyWithError(netErrConnectionResetError);

      client.retrieve('users/custom-retry-number', noOptions).catch((error) => {
        expect(error instanceof Error).toBeTruthy();
        expect(error.message).toMatch(netErrConnectionResetError.message);
        expect(scope.isDone()).toBeTruthy();

        done();
      });
    });

    it('merges retry configuration object from settings', () => {
      const customDelay = () => 250;
      const client = new RestClient({
        ...options,
        restClientConfig: {
          ...options.restClientConfig,
          retry: {
            retries: 4,
            retryDelay: customDelay,
            shouldResetTimeout: true,
          },
        },
      });

      const retryConfig = client.getRetryConfig();

      expect(retryConfig.retries).toBe(4);
      expect(retryConfig.retryDelay).toBe(customDelay);
      expect(retryConfig.shouldResetTimeout).toBe(true);
    });

    it('retries axios timeout errors even without ECONNABORTED code', () => {
      const retryConfig = restClient.getRetryConfig();
      const timeoutError = {
        message: 'timeout of 1ms exceeded',
      };
      expect(retryConfig.retryCondition(timeoutError)).toBe(true);
    });

    it('handles undefined restClientConfig without crashing during retries', () => {
      const client = new RestClient({
        baseURL: options.baseURL,
        headers: options.headers,
        restClientConfig: undefined,
      });

      const retryConfig = client.getRetryConfig();
      expect(retryConfig.retries).toBe(6);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const onRetry = retryConfig.onRetry;
      
      expect(() => {
        onRetry(1, { code: 'ECONNABORTED' }, { method: 'GET', url: 'http://test.com' });
      }).not.toThrow();

      consoleSpy.mockRestore();
    });
  });

  describe('buildPath', () => {
    it('compose path basing on base', () => {
      expect(restClient.buildPath('users')).toBe(`${options.baseURL}/users`);
      expect(restClient.buildPath('users/123')).toBe(`${options.baseURL}/users/123`);
      expect(restClient.buildPath()).toBe(`${options.baseURL}/`);
    });
  });

  describe('getRestConfig', () => {
    it("return {} in case agent property doesn't exist", () => {
      const client = new RestClient({
        ...options,
        restClientConfig: {},
      });

      expect(client.getRestConfig()).toEqual({});
    });

    it('creates object with correct properties with http(s) agent', () => {
      const client = new RestClient({
        ...options,
        restClientConfig: {
          agent: {
            rejectUnauthorized: false,
          },
          timeout: 10000,
        },
      });

      const config = client.getRestConfig();

      expect(config.httpAgent).toBeDefined();
      expect(config.httpAgent).toBeInstanceOf(http.Agent);
      expect(config.timeout).toBe(10000);
      expect(config.agent).toBeUndefined();
    });
  });

  describe('retrieve', () => {
    it('performs GET request for resource', (done) => {
      const listOfUsers = [{ id: 1 }, { id: 2 }, { id: 3 }];

      const scope = nock(options.baseURL).get('/users').reply(200, listOfUsers);

      restClientNoRetry.retrieve('users').then((result) => {
        expect(result).toEqual(listOfUsers);
        expect(scope.isDone()).toBeTruthy();

        done();
      });
    });

    it('catches NETWORK errors', (done) => {
      const scope = nock(options.baseURL).get('/users').replyWithError(netErrConnectionResetError);

      restClientNoRetry.retrieve('users', noOptions).catch((error) => {
        expect(error instanceof Error).toBeTruthy();
        expect(error.message).toMatch(netErrConnectionResetError.message);
        expect(scope.isDone()).toBeTruthy();

        done();
      });
    });

    it('catches API errors', (done) => {
      const scope = nock(options.baseURL).get('/users').reply(403, unathorizedError);

      restClientNoRetry.retrieve('users', noOptions).catch((error) => {
        expect(error instanceof Error).toBeTruthy();
        expect(error.message).toMatch(unauthorizedErrorMessage);
        expect(scope.isDone()).toBeTruthy();

        done();
      });
    });
  });

  describe('create', () => {
    it('performs POST request to resource', (done) => {
      const newUser = { username: 'John' };
      const userCreated = { id: 1 };

      const scope = nock(options.baseURL)
        .post('/users', (body) => isEqual(body, newUser))
        .reply(201, userCreated);

      restClientNoRetry.create('users', newUser).then((result) => {
        expect(result).toEqual(userCreated);
        expect(scope.isDone()).toBeTruthy();

        done();
      });
    });

    it('catches NETWORK errors', (done) => {
      const newUser = { username: 'John' };

      const scope = nock(options.baseURL)
        .post('/users', (body) => isEqual(body, newUser))
        .replyWithError(netErrConnectionResetError);

      restClientNoRetry.create('users', newUser, noOptions).catch((error) => {
        expect(error instanceof Error).toBeTruthy();
        expect(error.message).toMatch(netErrConnectionResetError.message);
        expect(scope.isDone()).toBeTruthy();

        done();
      });
    });

    it('catches API errors', (done) => {
      const newUser = { username: 'John' };

      const scope = nock(options.baseURL)
        .post('/users', (body) => isEqual(body, newUser))
        .reply(403, unathorizedError);

      restClientNoRetry.create('users', newUser, noOptions).catch((error) => {
        expect(error instanceof Error).toBeTruthy();
        expect(error.message).toMatch(unauthorizedErrorMessage);
        expect(scope.isDone()).toBeTruthy();

        done();
      });
    });
  });

  describe('update', () => {
    it('performs PUT request to resource', (done) => {
      const newUserInfo = { username: 'Mike' };
      const userUpdated = { id: 1 };

      const scope = nock(options.baseURL)
        .put('/users/1', (body) => isEqual(body, newUserInfo))
        .reply(200, userUpdated);

      restClientNoRetry.update('users/1', newUserInfo).then((result) => {
        expect(result).toEqual(userUpdated);
        expect(scope.isDone()).toBeTruthy();

        done();
      });
    });

    it('catches NETWORK errors', (done) => {
      const newUserInfo = { username: 'Mike' };

      const scope = nock(options.baseURL)
        .put('/users/1', (body) => isEqual(body, newUserInfo))
        .replyWithError(netErrConnectionResetError);

      restClientNoRetry.update('users/1', newUserInfo, noOptions).catch((error) => {
        expect(error instanceof Error).toBeTruthy();
        expect(error.message).toMatch(netErrConnectionResetError.message);
        expect(scope.isDone()).toBeTruthy();

        done();
      });
    });

    it('catches API errors', (done) => {
      const newUserInfo = { username: 'Mike' };

      const scope = nock(options.baseURL)
        .put('/users/1', (body) => isEqual(body, newUserInfo))
        .reply(403, unathorizedError);

      restClientNoRetry.update('users/1', newUserInfo, noOptions).catch((error) => {
        expect(error instanceof Error).toBeTruthy();
        expect(error.message).toMatch(unauthorizedErrorMessage);
        expect(scope.isDone()).toBeTruthy();

        done();
      });
    });
  });

  describe('delete', () => {
    it('performs DELETE request to resource', (done) => {
      const emptyBody = {};
      const userDeleted = {};

      const scope = nock(options.baseURL).delete('/users/1').reply(200, userDeleted);

      restClientNoRetry.delete('users/1', emptyBody).then((result) => {
        expect(result).toEqual(userDeleted);
        expect(scope.isDone()).toBeTruthy();

        done();
      });
    });

    it('catches NETWORK errors', (done) => {
      const emptyBody = {};

      const scope = nock(options.baseURL)
        .delete('/users/1')
        .replyWithError(netErrConnectionResetError);

      restClientNoRetry.delete('users/1', emptyBody, noOptions).catch((error) => {
        expect(error instanceof Error).toBeTruthy();
        expect(error.message).toMatch(netErrConnectionResetError.message);
        expect(scope.isDone()).toBeTruthy();

        done();
      });
    });

    it('catches API errors', (done) => {
      const emptyBody = {};

      const scope = nock(options.baseURL).delete('/users/1').reply(403, unathorizedError);

      restClientNoRetry.delete('users/1', emptyBody, noOptions).catch((error) => {
        expect(error instanceof Error).toBeTruthy();
        expect(error.message).toMatch(unauthorizedErrorMessage);
        expect(scope.isDone()).toBeTruthy();

        done();
      });
    });
  });

  describe('retrieveSyncAPI', () => {
    it('should retrieve SyncAPI', (done) => {
      const listOfUsers = [{ id: 1 }, { id: 2 }, { id: 3 }];

      const scope = nock(options.baseURL).get('/users').reply(200, listOfUsers);

      restClientNoRetry.retrieveSyncAPI('users').then((result) => {
        expect(result).toEqual(listOfUsers);
        expect(scope.isDone()).toBeTruthy();

        done();
      });
    });

    it('catches NETWORK errors', (done) => {
      const scope = nock(options.baseURL).get('/users').replyWithError(netErrConnectionResetError);

      restClientNoRetry.retrieveSyncAPI('users', noOptions).catch((error) => {
        expect(error instanceof Error).toBeTruthy();
        expect(error.message).toMatch(netErrConnectionResetError.message);
        expect(scope.isDone()).toBeTruthy();

        done();
      });
    });

    it('catches API errors', (done) => {
      const scope = nock(options.baseURL).get('/users').reply(403, unathorizedError);

      restClientNoRetry.retrieveSyncAPI('users', noOptions).catch((error) => {
        expect(error instanceof Error).toBeTruthy();
        expect(error.message).toMatch(unauthorizedErrorMessage);
        expect(scope.isDone()).toBeTruthy();

        done();
      });
    });
  });
});
