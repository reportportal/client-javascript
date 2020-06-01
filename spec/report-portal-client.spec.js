const RPClient = require('../lib/report-portal-client.js');
const RestClient = require('../lib/rest');
const helpers = require('../lib/helpers');
const events = require('../analytics/events');

describe('ReportPortal javascript client', () => {
    describe('constructor', () => {
        it('executes without error', () => {
            const client = new RPClient({ token: 'test' });

            expect(client.config.token).toBe('test');
        });
    });

    describe('logDebug', () => {
        it('should call console.log with message if debug is true', () => {
            const client = new RPClient({ debug: true });
            spyOn(console, 'log');

            client.logDebug('message');

            expect(console.log).toHaveBeenCalledWith('message');
        });


        it('should not call console.log if debug is false', () => {
            const client = new RPClient({ debug: false });
            spyOn(console, 'log');

            client.logDebug('message');

            expect(console.log).not.toHaveBeenCalled();
        });
    });

    describe('calculateNonRetriedItemMapKey', () => {
        it('should return correct parameter\'s string', () => {
            const client = new RPClient({});

            const str = client.calculateNonRetriedItemMapKey('lId', 'pId', 'name', 'itemId');

            expect(str).toEqual('lId__pId__name__itemId');
        });

        it('should return correct parameter\'s string with default value if itemId doesn\'t pass', () => {
            const client = new RPClient({});

            const str = client.calculateNonRetriedItemMapKey('lId', 'pId', 'name');

            expect(str).toEqual('lId__pId__name__');
        });
    });

    describe('getRejectAnswer', () => {
        it('should return object with tempId and promise.reject with error', () => {
            const client = new RPClient({});

            const rejectAnswer = client.getRejectAnswer('tempId', 'error');

            expect(rejectAnswer).toEqual({
                tempId: 'tempId',
                promise: Promise.reject(new Error('error')),
            });
        });
    });

    describe('cleanMap', () => {
        it('should delete element with id', () => {
            const client = new RPClient({});
            client.map = {
                id1: 'firstElement',
                id2: 'secondElement',
                id3: 'thirdElement',
            };

            client.cleanMap(['id1', 'id2']);

            expect(client.map).toEqual({ id3: 'thirdElement' });
        });
    });

    describe('checkConnect', () => {
        it('should return promise', () => {
            const client = new RPClient({ endpoint: 'endpoint' });
            spyOn(RestClient, 'request').and.returnValue(Promise.resolve('ok'));

            const request = client.checkConnect();

            expect(request.then).toBeDefined();
        });
    });

    describe('now', () => {
        let client;

        it('returns milliseconds from unix time', () => {
            client = new RPClient({ token: 'nowTest' });
            expect(new Date() - client.helpers.now()).toBeLessThan(100); // less than 100 miliseconds difference
        });
    });

    describe('startLaunch', () => {
        let client;

        it('should call restClient with suitable parameters', () => {
            const fakeSystemAttr = [{
                key: 'client',
                value: 'client-name|1.0',
                system: true,
            }, {
                key: 'os',
                value: 'osType|osArchitecture',
                system: true,
            }];
            client = new RPClient({ token: 'startLaunchTest', endpoint: 'https://rp.us/api/v1', project: 'tst' });
            const myPromise = Promise.resolve({ id: 'testidlaunch' });
            const time = 12345734;
            spyOn(client.restClient, 'create').and.returnValue(myPromise);
            spyOn(helpers, 'getSystemAttribute').and.returnValue(fakeSystemAttr);

            client.startLaunch({
                startTime: time,
            });

            expect(client.restClient.create).toHaveBeenCalledWith('launch', {
                name: 'Test launch name',
                startTime: time,
                attributes: fakeSystemAttr,
            }, { headers: client.headers });
        });

        it('should call restClient with suitable parameters, attributes is concatenated', () => {
            const fakeSystemAttr = [{
                key: 'client',
                value: 'client-name|1.0',
                system: true,
            }];
            client = new RPClient({
                token: 'startLaunchTest',
                endpoint: 'https://rp.us/api/v1',
                project: 'tst',
            });
            client.isLaunchMergeRequired = true;
            const myPromise = Promise.resolve({ id: 'testidlaunch' });
            const time = 12345734;
            spyOn(client.restClient, 'create').and.returnValue(myPromise);
            spyOn(helpers, 'getSystemAttribute').and.returnValue(fakeSystemAttr);

            client.startLaunch({
                startTime: time,
                attributes: [{ value: 'value' }],
            });

            expect(client.restClient.create).toHaveBeenCalledWith('launch', {
                name: 'Test launch name',
                startTime: time,
                attributes: [
                    { value: 'value' },
                    {
                        key: 'client',
                        value: 'client-name|1.0',
                        system: true,
                    },
                ],
            }, { headers: client.headers });
        });

        it('should call analytics.trackEvent with label if agentParams is not empty', () => {
            client = new RPClient({
                token: 'startLaunchTest',
                endpoint: 'https://rp.us/api/v1',
                project: 'tst',
            });
            client.analytics.agentParams = { name: 'name', version: 'version' };
            const time = 12345734;
            spyOn(events, 'getAgentEventLabel').and.returnValue('name|version');
            spyOn(client.analytics, 'trackEvent');

            client.startLaunch({
                startTime: time,
            });

            expect(client.analytics.trackEvent).toHaveBeenCalledWith(
                Object.assign(events.CLIENT_JAVASCRIPT_EVENTS.START_LAUNCH, { label: 'name|version' }),
            );
        });

        it('should call analytics.trackEvent without label if agentParams is empty', () => {
            client = new RPClient({
                token: 'startLaunchTest',
                endpoint: 'https://rp.us/api/v1',
                project: 'tst',
            });
            const time = 12345734;
            spyOn(client.analytics, 'trackEvent');

            client.startLaunch({
                startTime: time,
            });

            expect(client.analytics.trackEvent).toHaveBeenCalledWith(events.CLIENT_JAVASCRIPT_EVENTS.START_LAUNCH);
        });

        it('dont start new launch if launchDataRQ.id is not empty', () => {
            client = new RPClient({ token: 'startLaunchTest', endpoint: 'https://rp.us/api/v1', project: 'tst' });
            const myPromise = Promise.resolve({ id: 'testidlaunch' });
            const startTime = 12345734;
            const id = 12345734;
            spyOn(client.restClient, 'create').and.returnValue(myPromise);

            client.startLaunch({
                startTime,
                id,
            });

            expect(client.restClient.create).not.toHaveBeenCalled();
            expect(client.launchUuid).toEqual(id);
        });
    });

    describe('finishLaunch', () => {
        let client;

        it('should call getRejectAnswer if there is no launchTempId with suitable launchTempId', () => {
            client = new RPClient({ token: 'any', endpoint: 'https://rp.api', project: 'prj' });
            client.map = {
                id1: {
                    childrens: ['child1'],
                },
            };
            spyOn(client, 'getRejectAnswer');

            client.finishLaunch('id2', { some: 'data' });

            expect(client.getRejectAnswer).toHaveBeenCalledWith('id2', new Error('Launch "id2" not found'));
        });

        it('should trigger promiseFinish', (done) => {
            client = new RPClient({ token: 'any', endpoint: 'https://rp.api', project: 'prj' });
            client.map = {
                id1: {
                    childrens: ['child1'],
                    promiseStart: Promise.resolve(),
                },
                child1: {
                    promiseFinish: Promise.resolve(),
                },
            };
            spyOn(client.map.child1, 'promiseFinish').and.returnValue(Promise.resolve());

            client.finishLaunch('id1', { some: 'data' });

            expect(client.map.child1.promiseFinish().then).toBeDefined();
            done();
        });
    });

    describe('getMergeLaunchesRequest', () => {
        it('should return object which contains a data for merge launches with default launch name', () => {
            const expectedMergeLaunches = {
                description: 'Merged launch',
                endTime: 12345734,
                extendSuitesDescription: true,
                launches: ['12345', '12346'],
                mergeType: 'BASIC',
                mode: 'DEFAULT',
                name: 'Test launch name',
                attributes: [{ value: 'value' }],
            };
            const client = new RPClient({ attributes: [{ value: 'value' }] });
            spyOn(client.helpers, 'now').and.returnValue(12345734);

            const mergeLaunches = client.getMergeLaunchesRequest(['12345', '12346']);

            expect(mergeLaunches).toEqual(expectedMergeLaunches);
        });

        it('should return object which contains a data for merge launches', () => {
            const expectedMergeLaunches = {
                description: 'Merged launch',
                endTime: 12345734,
                extendSuitesDescription: true,
                launches: ['12345', '12346'],
                mergeType: 'BASIC',
                mode: 'DEFAULT',
                name: 'launch',
                attributes: [{ value: 'value' }],
            };
            const client = new RPClient({ launch: 'launch', attributes: [{ value: 'value' }] });
            spyOn(client.helpers, 'now').and.returnValue(12345734);

            const mergeLaunches = client.getMergeLaunchesRequest(['12345', '12346']);

            expect(mergeLaunches).toEqual(expectedMergeLaunches);
        });
    });

    describe('mergeLaunches', () => {
        const fakeLaunchIds = ['12345-gfdgfdg-gfdgdf-fdfd45', '12345-gfdgfdg-gfdgdf-fdfd45', ''];
        const fakeEndTime = 12345734;
        const fakeMergeDataRQ = {
            description: 'Merged launch',
            endTime: fakeEndTime,
            extendSuitesDescription: true,
            launches: fakeLaunchIds,
            mergeType: 'BASIC',
            mode: 'DEFAULT',
            name: 'Test launch name',
        };
        let client;

        it('should calls client', (done) => {
            client = new RPClient({
                token: 'startLaunchTest',
                endpoint: 'https://rp.us/api/v1',
                project: 'tst',
                isLaunchMergeRequired: true,
            });

            const myPromise = Promise.resolve({ id: 'testidlaunch' });
            spyOn(client.restClient, 'create').and.returnValue(myPromise);
            spyOn(client, 'logDebug');
            spyOn(helpers, 'readLaunchesFromFile').and.returnValue(fakeLaunchIds);
            spyOn(client, 'getMergeLaunchesRequest').and.returnValue(fakeMergeDataRQ);
            spyOn(client.restClient, 'retrieveSyncAPI').and.returnValue(Promise.resolve({
                content: [{ id: 'id1' }],
            }));

            const promise = client.mergeLaunches();

            expect(promise.then).toBeDefined();
            promise.then(() => {
                expect(client.logDebug).toHaveBeenCalledWith('Found launches: id1');
                expect(client.restClient.create)
                    .toHaveBeenCalledWith('launch/merge', fakeMergeDataRQ, { headers: client.headers });
                expect(client.logDebug).toHaveBeenCalledWith('Launches successfully merged!');

                done();
            });
        });

        it('should calls logDebug with an error if something went wrong', () => {
            client = new RPClient({
                token: 'startLaunchTest',
                endpoint: 'https://rp.us/api/v1',
                project: 'tst',
                isLaunchMergeRequired: true,
            });

            spyOn(client, 'logDebug');
            spyOn(client.restClient, 'retrieveSyncAPI').and.returnValue(Promise.reject(new Error('error')));

            const promise = client.mergeLaunches();

            expect(promise.catch).toBeDefined();
            promise.catch(() => {
                expect(client.logDebug).toHaveBeenCalledWith('ERROR');
                expect(client.logDebug).toHaveBeenCalledWith('error');
            });
        });

        it('should not calls client if isLaunchMergeRequired is false', () => {
            client = new RPClient({
                token: 'startLaunchTest',
                endpoint: 'https://rp.us/api/v1',
                project: 'tst',
                isLaunchMergeRequired: false,
            });
            spyOn(client, 'logDebug');

            client.mergeLaunches();

            expect(client.logDebug).toHaveBeenCalledWith('Option isLaunchMergeRequired is false');
        });
    });

    describe('getPromiseFinishAllItems', () => {
        it('should return promise', (done) => {
            const client = new RPClient({});
            client.map = {
                id1: {
                    childrens: ['child1'],
                },
                child1: {
                    promiseFinish: Promise.resolve(),
                },
            };
            spyOn(client.map.child1, 'promiseFinish');

            const promise = client.getPromiseFinishAllItems('id1');

            expect(promise.then).toBeDefined();
            done();
        });
    });

    describe('updateLaunch', () => {
        let client;

        it('should call getRejectAnswer if there is no launchTempId with suitable launchTempId', () => {
            client = new RPClient({ token: 'any', endpoint: 'https://rp.api', project: 'prj' });
            client.map = {
                id1: {
                    childrens: ['child1'],
                },
            };
            spyOn(client, 'getRejectAnswer');

            client.updateLaunch('id2', { some: 'data' });

            expect(client.getRejectAnswer).toHaveBeenCalledWith('id2', new Error('Launch "id2" not found'));
        });

        it('should return object with tempId and promise', () => {
            client = new RPClient({ token: 'any', endpoint: 'https://rp.api', project: 'prj' });
            client.map = {
                id1: {
                    childrens: ['child1'],
                    promiseFinish: Promise.resolve(),
                },
            };
            const promise = Promise.resolve();

            const result = client.updateLaunch('id1', { some: 'data' });

            expect(result).toEqual({
                tempId: 'id1',
                promise,
            });
        });
    });

    describe('startTestItem', () => {
        let client;

        it('should call getRejectAnswer if there is no launchTempId with suitable launchTempId', () => {
            client = new RPClient({ token: 'any', endpoint: 'https://rp.api', project: 'prj' });
            client.map = {
                id1: {
                    childrens: ['child1'],
                },
            };
            spyOn(client, 'getRejectAnswer');

            client.startTestItem({}, 'id2');

            expect(client.getRejectAnswer).toHaveBeenCalledWith('id2', new Error('Launch "id2" not found'));
        });

        it('should call getRejectAnswer if launchObj.finishSend is true', () => {
            client = new RPClient({ token: 'any', endpoint: 'https://rp.api', project: 'prj' });
            client.map = {
                id1: {
                    childrens: ['child1'],
                    finishSend: true,
                },
            };
            spyOn(client, 'getRejectAnswer');
            const error = new Error('Launch "id1" is already finished, you can not add an item to it');

            client.startTestItem({}, 'id1');

            expect(client.getRejectAnswer).toHaveBeenCalledWith('id1', error);
        });

        it('should call getRejectAnswer if there is no parentObj with suitable parentTempId', () => {
            client = new RPClient({ token: 'any', endpoint: 'https://rp.api', project: 'prj' });
            client.map = {
                id: {
                    childrens: ['id1'],
                },
                id1: {
                    childrens: ['child1'],
                },
            };
            spyOn(client, 'getRejectAnswer');
            const error = new Error('Item "id3" not found');

            client.startTestItem({ testCaseId: 'testCaseId' }, 'id1', 'id3');

            expect(client.getRejectAnswer).toHaveBeenCalledWith('id1', error);
        });

        it('should return object with tempId and promise', () => {
            client = new RPClient({ token: 'any', endpoint: 'https://rp.api', project: 'prj' });
            client.map = {
                id: {
                    childrens: ['id1', '4n5pxq24kpiob12og9'],
                    promiseStart: Promise.resolve(),
                },
                id1: {
                    childrens: ['child1'],
                    promiseStart: Promise.resolve(),
                },
                '4n5pxq24kpiob12og9': {
                    promiseStart: Promise.resolve(),
                },
            };
            spyOn(client.nonRetriedItemMap, 'get').and.returnValue(Promise.resolve());
            spyOn(client, 'getUniqId').and.returnValue('4n5pxq24kpiob12og9');

            const result = client.startTestItem({ retry: true }, 'id1', 'id');

            expect(result).toEqual({
                tempId: '4n5pxq24kpiob12og9',
                promise: Promise.resolve(),
            });
        });

        it('should call nonRetriedItemMap if retry is false', () => {
            client = new RPClient({ token: 'any', endpoint: 'https://rp.api', project: 'prj' });
            client.map = {
                id: {
                    childrens: ['id1', '4n5pxq24kpiob12og9'],
                    promiseStart: Promise.resolve(),
                },
                id1: {
                    childrens: ['child1'],
                    promiseStart: Promise.resolve(),
                },
                '4n5pxq24kpiob12og9': {
                    promiseStart: Promise.resolve(),
                },
            };
            spyOn(client, 'calculateNonRetriedItemMapKey').and.returnValue('id1__name__');
            spyOn(client, 'getUniqId').and.returnValue('4n5pxq24kpiob12og9');
            spyOn(client.nonRetriedItemMap, 'set');

            client.startTestItem({ retry: false }, 'id1');

            expect(client.nonRetriedItemMap.set).toHaveBeenCalledWith('id1__name__', Promise.resolve());
        });
    });

    describe('finishTestItem', () => {
        let client;

        it('should call getRejectAnswer if there is no itemObj with suitable itemTempId', () => {
            client = new RPClient({ token: 'any', endpoint: 'https://rp.api', project: 'prj' });
            client.map = {
                id1: {
                    childrens: ['child1'],
                },
            };
            spyOn(client, 'getRejectAnswer');

            client.finishTestItem('id2', {});

            expect(client.getRejectAnswer).toHaveBeenCalledWith('id2', new Error('Item "id2" not found'));
        });

        it('should call finishTestItemPromiseStart with correct parameters', (done) => {
            client = new RPClient({ token: 'any', endpoint: 'https://rp.api', project: 'prj' });
            client.map = {
                id: {
                    childrens: ['id1'],
                    promiseFinish: Promise.resolve(),
                },
                id1: {
                    childrens: ['child1'],
                    promiseFinish: Promise.resolve(),
                },
            };
            client.launchUuid = 'launchUuid';
            spyOn(client, 'cleanMap');
            spyOn(client, 'finishTestItemPromiseStart');
            spyOn(client.helpers, 'now').and.returnValue(1234567);

            client.finishTestItem('id', {});

            setTimeout(() => {
                expect(client.cleanMap).toHaveBeenCalledWith(['id1']);
                expect(client.finishTestItemPromiseStart).toHaveBeenCalledWith(
                    Object.assign(client.map.id, { finishSend: true }),
                    'id',
                    { endTime: 1234567, launchUuid: 'launchUuid' },
                );
                done();
            }, 100);
        });

        it('should call logDebug and finishTestItemPromiseStart with correct parameters if smt went wrong', (done) => {
            client = new RPClient({ token: 'any', endpoint: 'https://rp.api', project: 'prj' });
            client.map = {
                id: {
                    childrens: ['id1'],
                    promiseFinish: Promise.resolve(),
                },
                id1: {
                    childrens: ['child1'],
                    promiseFinish: Promise.reject(),
                },
            };
            client.launchUuid = 'launchUuid';
            spyOn(client, 'cleanMap');
            spyOn(client, 'logDebug');
            spyOn(client, 'finishTestItemPromiseStart');
            spyOn(client.helpers, 'now').and.returnValue(1234567);

            client.finishTestItem('id', {});

            setTimeout(() => {
                expect(client.cleanMap).toHaveBeenCalledWith(['id1']);
                expect(client.logDebug).toHaveBeenCalledWith('Error finish children of test item id');
                expect(client.logDebug).toHaveBeenCalledWith('Finish test item id');
                expect(client.finishTestItemPromiseStart).toHaveBeenCalledWith(
                    Object.assign(client.map.id, { finishSend: true }),
                    'id',
                    { endTime: 1234567, launchUuid: 'launchUuid' },
                );
                done();
            }, 100);
        });
    });

    describe('saveLog', () => {
        let client;

        it('should return object with tempId and promise', () => {
            client = new RPClient({ token: 'any', endpoint: 'https://rp.api', project: 'prj' });
            client.map = {
                id1: {
                    childrens: ['child1'],
                },
            };
            spyOn(client, 'getUniqId').and.returnValue('4n5pxq24kpiob12og9');
            spyOn(client.restClient, 'create').and.returnValue(Promise.resolve());

            const result = client.saveLog({
                promiseStart: Promise.resolve(),
                realId: 'realId',
                childrens: [],
            }, client.restClient.create);

            expect(result).toEqual({
                tempId: '4n5pxq24kpiob12og9',
                promise: Promise.resolve(),
            });
        });
    });

    describe('sendLog', () => {
        let client;

        it('should return sendLogWithFile if fileObj is not empty', () => {
            client = new RPClient({ token: 'any', endpoint: 'https://rp.api', project: 'prj' });
            spyOn(client, 'sendLogWithFile').and.returnValue('sendLogWithFile');

            const result = client.sendLog('itemTempId', { message: 'message' }, { name: 'name' });

            expect(result).toEqual('sendLogWithFile');
        });

        it('should return sendLogWithoutFile if fileObj is empty', () => {
            client = new RPClient({ token: 'any', endpoint: 'https://rp.api', project: 'prj' });
            spyOn(client, 'sendLogWithoutFile').and.returnValue('sendLogWithoutFile');

            const result = client.sendLog('itemTempId', { message: 'message' });

            expect(result).toEqual('sendLogWithoutFile');
        });
    });

    describe('sendLogWithoutFile', () => {
        let client;

        it('should call getRejectAnswer if there is no itemObj with suitable itemTempId', () => {
            client = new RPClient({ token: 'any', endpoint: 'https://rp.api', project: 'prj' });
            client.map = {
                id1: {
                    childrens: ['child1'],
                },
            };
            spyOn(client, 'getRejectAnswer');

            client.sendLogWithoutFile('itemTempId', {});

            expect(client.getRejectAnswer).toHaveBeenCalledWith('itemTempId', new Error('Item "itemTempId" not found'));
        });

        it('should return saveLog function', () => {
            client = new RPClient({ token: 'any', endpoint: 'https://rp.api', project: 'prj' });
            client.map = {
                itemTempId: {
                    childrens: ['child1'],
                },
            };
            spyOn(client, 'saveLog').and.returnValue('saveLog');

            const result = client.sendLogWithoutFile('itemTempId', {});

            expect(result).toEqual('saveLog');
        });
    });

    describe('sendLogWithFile', () => {
        let client;

        it('should call getRejectAnswer if there is no itemObj with suitable itemTempId', () => {
            client = new RPClient({ token: 'any', endpoint: 'https://rp.api', project: 'prj' });
            client.map = {
                id1: {
                    childrens: ['child1'],
                },
            };
            spyOn(client, 'getRejectAnswer');

            client.sendLogWithFile('itemTempId', {});

            expect(client.getRejectAnswer).toHaveBeenCalledWith('itemTempId', new Error('Item "itemTempId" not found'));
        });

        it('should return saveLog function', () => {
            client = new RPClient({ token: 'any', endpoint: 'https://rp.api', project: 'prj' });
            client.map = {
                itemTempId: {
                    childrens: ['child1'],
                },
            };
            spyOn(client, 'saveLog').and.returnValue('saveLog');

            const result = client.sendLogWithFile('itemTempId', {});

            expect(result).toEqual('saveLog');
        });
    });

    describe('getRequestLogWithFile', () => {
        let client;

        it('should return restClient.create', () => {
            client = new RPClient({ token: 'any', endpoint: 'https://rp.api', project: 'prj' });
            client.map = {
                id1: {
                    childrens: ['child1'],
                },
            };
            spyOn(client, 'buildMultiPartStream').and.returnValue();
            spyOn(client.restClient, 'create').and.returnValue(Promise.resolve());

            const result = client.getRequestLogWithFile({}, { name: 'name' });

            expect(result.then).toBeDefined();
        });

        it('should return restClient.create with error', () => {
            client = new RPClient({ token: 'any', endpoint: 'https://rp.api', project: 'prj' });
            client.map = {
                id1: {
                    childrens: ['child1'],
                },
            };
            spyOn(client, 'buildMultiPartStream').and.returnValue();
            spyOn(client.restClient, 'create').and.returnValue(Promise.reject(new Error('error')));

            const result = client.getRequestLogWithFile({}, { name: 'name' });

            expect(result.catch).toBeDefined();
        });
    });

    describe('finishTestItemPromiseStart', () => {
        let client;

        it('should finish test item and call restClient.update', (done) => {
            client = new RPClient({ token: 'any', endpoint: 'https://rp.api', project: 'prj' });
            client.launchUuid = 'launchUuid';
            client.headers = 'headers';
            spyOn(client, 'logDebug');
            spyOn(client.restClient, 'update');

            client.finishTestItemPromiseStart({
                realId: 'realId',
                promiseStart: Promise.resolve(),
                resolveFinish: Promise.resolve(),
                rejectFinish: Promise.reject(),
            }, 'itemTempId', {});

            setTimeout(() => {
                expect(client.logDebug).toHaveBeenCalledWith('Finish test item itemTempId');
                expect(client.restClient.update).toHaveBeenCalledWith(
                    'item/realId',
                    { launchUuid: 'launchUuid' },
                    { headers: 'headers' },
                );
                done();
            }, 100);
        });

        it('should call logDebug with error if smt went wrong', (done) => {
            client = new RPClient({ token: 'any', endpoint: 'https://rp.api', project: 'prj' });
            client.launchUuid = 'launchUuid';
            client.headers = 'headers';
            spyOn(client, 'logDebug');
            spyOn(client.restClient, 'update').and.returnValue(Promise.reject(new Error('error')));

            client.finishTestItemPromiseStart({
                realId: 'realId',
                promiseStart: Promise.resolve(),
                resolveFinish: Promise.resolve(),
                rejectFinish: Promise.reject(),
            }, 'itemTempId', {});

            setTimeout(() => {
                expect(client.logDebug).toHaveBeenCalledWith('Error finish test item itemTempId');

                done();
            }, 100);
        });
    });
});
