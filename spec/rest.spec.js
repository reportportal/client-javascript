const nock = require('nock');
const isEqual = require('lodash/isEqual');
const RestClient = require('../lib/rest');

describe('RestClient', () => {
    const options = {
        baseURL: 'http://report-portal-host:8080/api/v1',
        headers: {
            Authorization: 'bearer 00000000-0000-0000-0000-000000000000',
            'User-Agent': 'NodeJS',
        },
    };
    const noOptions = {};
    const restClient = new RestClient(options);

    const unathorizedError = {
        error: 'unauthorized',
        error_description: 'Full authentication is required to access this resource',
    };
    const unauthorizedErrorMessage = 'Request failed with status code 403: '
        + '{"error":"unauthorized","error_description":"Full authentication is required to access this resource"}';
    const netErrConnectionResetError = { code: 'ECONNABORTED', message: 'connection reset' };

    describe('constructor', () => {
        it('creates object with correct properties', () => {
            expect(restClient.baseURL).toBe(options.baseURL);
            expect(restClient.headers).toEqual(options.headers);
        });
    });

    describe('#buildPath', () => {
        it('compose path basing on base', () => {
            expect(restClient.buildPath('users')).toBe(`${options.baseURL}/users`);
            expect(restClient.buildPath('users/123')).toBe(`${options.baseURL}/users/123`);
            expect(restClient.buildPath()).toBe(`${options.baseURL}/`);
        });
    });

    describe('#retrieve', () => {
        it('performs GET request for resource', (done) => {
            const listOfUsers = [
                { id: 1 },
                { id: 2 },
                { id: 3 },
            ];

            const scope = nock(options.baseURL)
                .get('/users')
                .reply(200, listOfUsers);

            restClient.retrieve('users', noOptions).then((result) => {
                expect(result).toEqual(listOfUsers);
                expect(scope.isDone()).toBeTruthy();

                done();
            });
        });

        it('catches NETWORK errors', (done) => {
            const scope = nock(options.baseURL)
                .get('/users')
                .replyWithError(netErrConnectionResetError);

            restClient.retrieve('users', noOptions).catch((error) => {
                expect(error instanceof Error).toBeTruthy();
                expect(error.message).toMatch(netErrConnectionResetError.message);
                expect(scope.isDone()).toBeTruthy();

                done();
            });
        });

        it('catches API errors', (done) => {
            const scope = nock(options.baseURL)
                .get('/users')
                .reply(403, unathorizedError);

            restClient.retrieve('users', noOptions).catch((error) => {
                expect(error instanceof Error).toBeTruthy();
                expect(error.message).toMatch(unauthorizedErrorMessage);
                expect(scope.isDone()).toBeTruthy();

                done();
            });
        });
    });

    describe('#create', () => {
        it('performs POST request to resource', (done) => {
            const newUser = { username: 'John' };
            const userCreated = { id: 1 };

            const scope = nock(options.baseURL)
                .post('/users', body => isEqual(body, newUser))
                .reply(201, userCreated);

            restClient.create('users', newUser, noOptions).then((result) => {
                expect(result).toEqual(userCreated);
                expect(scope.isDone()).toBeTruthy();

                done();
            });
        });

        it('catches NETWORK errors', (done) => {
            const newUser = { username: 'John' };

            const scope = nock(options.baseURL)
                .post('/users', body => isEqual(body, newUser))
                .replyWithError(netErrConnectionResetError);

            restClient.create('users', newUser, noOptions).catch((error) => {
                expect(error instanceof Error).toBeTruthy();
                expect(error.message).toMatch(netErrConnectionResetError.message);
                expect(scope.isDone()).toBeTruthy();

                done();
            });
        });

        it('catches API errors', (done) => {
            const newUser = { username: 'John' };

            const scope = nock(options.baseURL)
                .post('/users', body => isEqual(body, newUser))
                .reply(403, unathorizedError);

            restClient.create('users', newUser, noOptions).catch((error) => {
                expect(error instanceof Error).toBeTruthy();
                expect(error.message).toMatch(unauthorizedErrorMessage);
                expect(scope.isDone()).toBeTruthy();

                done();
            });
        });
    });

    describe('#update', () => {
        it('performs PUT request to resource', (done) => {
            const newUserInfo = { username: 'Mike' };
            const userUpdated = { id: 1 };

            const scope = nock(options.baseURL)
                .put('/users/1', body => isEqual(body, newUserInfo))
                .reply(200, userUpdated);

            restClient.update('users/1', newUserInfo, noOptions).then((result) => {
                expect(result).toEqual(userUpdated);
                expect(scope.isDone()).toBeTruthy();

                done();
            });
        });

        it('catches NETWORK errors', (done) => {
            const newUserInfo = { username: 'Mike' };

            const scope = nock(options.baseURL)
                .put('/users/1', body => isEqual(body, newUserInfo))
                .replyWithError(netErrConnectionResetError);


            restClient.update('users/1', newUserInfo, noOptions).catch((error) => {
                expect(error instanceof Error).toBeTruthy();
                expect(error.message).toMatch(netErrConnectionResetError.message);
                expect(scope.isDone()).toBeTruthy();

                done();
            });
        });

        it('catches API errors', (done) => {
            const newUserInfo = { username: 'Mike' };

            const scope = nock(options.baseURL)
                .put('/users/1', body => isEqual(body, newUserInfo))
                .reply(403, unathorizedError);

            restClient.update('users/1', newUserInfo, noOptions).catch((error) => {
                expect(error instanceof Error).toBeTruthy();
                expect(error.message).toMatch(unauthorizedErrorMessage);
                expect(scope.isDone()).toBeTruthy();

                done();
            });
        });
    });

    describe('#delete', () => {
        it('performs DELETE request to resource', (done) => {
            const emptyBody = {};
            const userDeleted = {};

            const scope = nock(options.baseURL)
                .delete('/users/1')
                .reply(200, userDeleted);

            restClient.delete('users/1', emptyBody, noOptions).then((result) => {
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

            restClient.delete('users/1', emptyBody, noOptions).catch((error) => {
                expect(error instanceof Error).toBeTruthy();
                expect(error.message).toMatch(netErrConnectionResetError.message);
                expect(scope.isDone()).toBeTruthy();

                done();
            });
        });

        it('catches API errors', (done) => {
            const emptyBody = {};

            const scope = nock(options.baseURL)
                .delete('/users/1')
                .reply(403, unathorizedError);

            restClient.delete('users/1', emptyBody, noOptions).catch((error) => {
                expect(error instanceof Error).toBeTruthy();
                expect(error.message).toMatch(unauthorizedErrorMessage);
                expect(scope.isDone()).toBeTruthy();

                done();
            });
        });
    });
});
