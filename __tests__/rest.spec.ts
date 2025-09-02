import nock from 'nock';
import isEqual from 'lodash/isEqual';
import http from 'http';
import RestClient from '../lib/rest';
import * as logger from '../lib/logger';

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
  const restClient = new RestClient(options);

  const unathorizedError = {
    error: 'unauthorized',
    error_description: 'Full authentication is required to access this resource',
  };
  const unauthorizedErrorMessage =
    'Request failed with status code 403: ' +
    '{"error":"unauthorized","error_description":"Full authentication is required to access this resource"}';
  const netErrConnectionResetError = { code: 'ECONNABORTED', message: 'connection reset' };

  describe('constructor', () => {
    it('creates RestClient instance', () => {
      expect(restClient).toBeInstanceOf(RestClient);
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

      expect(spyLogger).toHaveBeenCalled();
    });
  });

  describe('retrieve', () => {
    it('performs GET request for resource', (done) => {
      const listOfUsers = [{ id: 1 }, { id: 2 }, { id: 3 }];

      const scope = nock(options.baseURL).get('/users').reply(200, listOfUsers);

      restClient.retrieve('users').then((result) => {
        expect(result).toEqual(listOfUsers);
        expect(scope.isDone()).toBeTruthy();

        done();
      });
    });

    it('catches NETWORK errors', (done) => {
      const scope = nock(options.baseURL).get('/users').replyWithError(netErrConnectionResetError);

      restClient.retrieve('users').catch((error) => {
        expect(error.message).toContain('connection reset');
        expect(scope.isDone()).toBeTruthy();

        done();
      });
    });

    it('catches HTTP errors', (done) => {
      const scope = nock(options.baseURL).get('/users').reply(403, unathorizedError);

      restClient.retrieve('users').catch((error) => {
        expect(error.message).toContain('unauthorized');
        expect(error.message).toContain('Full authentication is required to access this resource');
        expect(scope.isDone()).toBeTruthy();

        done();
      });
    });
  });

  describe('create', () => {
    it('performs POST request for resource', (done) => {
      const newUser = { name: 'John Doe', email: 'john@example.com' };
      const createdUser = { id: 1, ...newUser };

      const scope = nock(options.baseURL).post('/users', newUser).reply(201, createdUser);

      restClient.create('users', newUser).then((result) => {
        expect(result).toEqual(createdUser);
        expect(scope.isDone()).toBeTruthy();

        done();
      });
    });
  });

  describe('update', () => {
    it('performs PUT request for resource', (done) => {
      const updatedUser = { name: 'Jane Doe', email: 'jane@example.com' };

      const scope = nock(options.baseURL).put('/users/1', updatedUser).reply(200, updatedUser);

      restClient.update('users/1', updatedUser).then((result) => {
        expect(result).toEqual(updatedUser);
        expect(scope.isDone()).toBeTruthy();

        done();
      });
    });
  });

  describe('delete', () => {
    it('performs DELETE request for resource', (done) => {
      const scope = nock(options.baseURL).delete('/users/1').reply(204);

      restClient.delete('users/1').then((result) => {
        expect(result).toBe('');
        expect(scope.isDone()).toBeTruthy();

        done();
      });
    });
  });

  describe('request', () => {
    it('performs custom request with specified method', (done) => {
      const userData = { name: 'John Doe' };
      const fullUrl = `${options.baseURL}/users/1`;
      const scope = nock(options.baseURL).post('/users/1', userData).reply(200, userData);

      restClient.request('POST', fullUrl, userData).then((result) => {
        expect(result).toEqual(userData);
        expect(scope.isDone()).toBeTruthy();

        done();
      });
    });
  });
});
