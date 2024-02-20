const process = require('process');
const RPClient = require('../lib/report-portal-client');
const RestClient = require('../lib/rest');
const helpers = require('../lib/helpers');
const { OUTPUT_TYPES } = require('../lib/constants/outputs');

describe('ReportPortal javascript client', () => {
  describe('constructor', () => {
    it('creates the client instance without error', () => {
      const client = new RPClient({
        apiKey: 'test',
        project: 'test',
        endpoint: 'https://abc.com',
      });

      expect(client.config.apiKey).toBe('test');
      expect(client.config.project).toBe('test');
      expect(client.config.endpoint).toBe('https://abc.com');
    });
  });

  describe('logDebug', () => {
    it('should call console.log with provided message if debug is true', () => {
      const client = new RPClient({
        apiKey: 'test',
        project: 'test',
        endpoint: 'https://abc.com',
        debug: true,
      });
      spyOn(console, 'log');

      client.logDebug('message');

      expect(console.log).toHaveBeenCalledWith('message', '');
    });

    it('should call console.log with messages if debug is true and dataMsg provided', () => {
      const client = new RPClient({
        apiKey: 'test',
        project: 'test',
        endpoint: 'https://abc.com',
        debug: true,
      });
      spyOn(console, 'log');

      client.logDebug('message', { key: 1, value: 2 });

      expect(console.log).toHaveBeenCalledWith('message', { key: 1, value: 2 });
    });

    it('should not call console.log if debug is false', () => {
      const client = new RPClient({
        apiKey: 'test',
        project: 'test',
        endpoint: 'https://abc.com',
        debug: false,
      });
      spyOn(console, 'log');

      client.logDebug('message');

      expect(console.log).not.toHaveBeenCalled();
    });
  });

  describe('calculateItemRetriesChainMapKey', () => {
    it("should return correct parameter's string", () => {
      const client = new RPClient({
        apiKey: 'test',
        project: 'test',
        endpoint: 'https://abc.com',
      });

      const str = client.calculateItemRetriesChainMapKey('lId', 'pId', 'name', 'itemId');

      expect(str).toEqual('lId__pId__name__itemId');
    });

    it("should return correct parameter's string with default value if itemId doesn't pass", () => {
      const client = new RPClient({
        apiKey: 'test',
        project: 'test',
        endpoint: 'https://abc.com',
      });

      const str = client.calculateItemRetriesChainMapKey('lId', 'pId', 'name');

      expect(str).toEqual('lId__pId__name__');
    });
  });

  describe('getRejectAnswer', () => {
    it('should return object with tempId and promise.reject with error', () => {
      const client = new RPClient({
        apiKey: 'test',
        project: 'test',
        endpoint: 'https://abc.com',
      });

      const rejectAnswer = client.getRejectAnswer('tempId', 'error');

      expect(rejectAnswer.tempId).toEqual('tempId');
      return expectAsync(rejectAnswer.promise).toBeRejected();
    });
  });

  describe('cleanMap', () => {
    it('should delete element with id', () => {
      const client = new RPClient({
        apiKey: 'test',
        project: 'test',
        endpoint: 'https://abc.com',
      });
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
      const client = new RPClient({
        apiKey: 'test',
        project: 'test',
        endpoint: 'https://abc.com',
      });
      spyOn(RestClient, 'request').and.returnValue(Promise.resolve('ok'));

      const request = client.checkConnect();

      return expectAsync(request).toBeResolved();
    });
  });

  describe('triggerAnalyticsEvent', () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
      process.env = { ...OLD_ENV };
    });

    afterEach(() => {
      process.env = OLD_ENV;
    });

    it('should call statistics.trackEvent if REPORTPORTAL_CLIENT_JS_NO_ANALYTICS is not set', () => {
      const client = new RPClient({
        apiKey: 'startLaunchTest',
        endpoint: 'https://rp.us/api/v1',
        project: 'tst',
      });
      spyOn(client.statistics, 'trackEvent');

      client.triggerStatisticsEvent();

      expect(client.statistics.trackEvent).toHaveBeenCalled();
    });

    it('should not call statistics.trackEvent if REPORTPORTAL_CLIENT_JS_NO_ANALYTICS is true', () => {
      const client = new RPClient({
        apiKey: 'startLaunchTest',
        endpoint: 'https://rp.us/api/v1',
        project: 'tst',
      });
      process.env.REPORTPORTAL_CLIENT_JS_NO_ANALYTICS = true;
      spyOn(client.statistics, 'trackEvent');

      client.triggerStatisticsEvent();

      expect(client.statistics.trackEvent).not.toHaveBeenCalled();
    });

    it('should create statistics object with agentParams is not empty', () => {
      const agentParams = {
        name: 'name',
        version: 'version',
      };
      const client = new RPClient(
        {
          apiKey: 'startLaunchTest',
          endpoint: 'https://rp.us/api/v1',
          project: 'tst',
        },
        agentParams,
      );
      process.env.REPORTPORTAL_CLIENT_JS_NO_ANALYTICS = false;

      expect(client.statistics.eventName).toEqual('start_launch');
      expect(client.statistics.eventParams).toEqual(
        jasmine.objectContaining({
          agent_name: agentParams.name,
          agent_version: agentParams.version,
        }),
      );
    });

    it('should create statistics object without agentParams if they are empty', () => {
      const client = new RPClient({
        apiKey: 'startLaunchTest',
        endpoint: 'https://rp.us/api/v1',
        project: 'tst',
      });

      expect(client.statistics.eventName).toEqual('start_launch');
      expect(client.statistics.eventParams).not.toEqual(
        jasmine.objectContaining({
          agent_name: jasmine.anything(),
          agent_version: jasmine.anything(),
        }),
      );
    });
  });

  describe('startLaunch', () => {
    it('should call restClient with suitable parameters', () => {
      const fakeSystemAttr = [
        {
          key: 'client',
          value: 'client-name|1.0',
          system: true,
        },
        {
          key: 'os',
          value: 'osType|osArchitecture',
          system: true,
        },
      ];
      const client = new RPClient({
        apiKey: 'startLaunchTest',
        endpoint: 'https://rp.us/api/v1',
        project: 'tst',
      });
      const myPromise = Promise.resolve({ id: 'testidlaunch' });
      const time = 12345734;
      spyOn(client.restClient, 'create').and.returnValue(myPromise);
      spyOn(helpers, 'getSystemAttribute').and.returnValue(fakeSystemAttr);

      client.startLaunch({
        startTime: time,
      });

      expect(client.restClient.create).toHaveBeenCalledWith(
        'launch',
        {
          name: 'Test launch name',
          startTime: time,
          attributes: fakeSystemAttr,
        },
        { headers: client.headers },
      );
    });

    it('should call restClient with suitable parameters, attributes is concatenated', () => {
      const fakeSystemAttr = [
        {
          key: 'client',
          value: 'client-name|1.0',
          system: true,
        },
      ];
      const client = new RPClient({
        apiKey: 'startLaunchTest',
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

      expect(client.restClient.create).toHaveBeenCalledWith(
        'launch',
        {
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
        },
        { headers: client.headers },
      );
    });

    it('dont start new launch if launchDataRQ.id is not empty', () => {
      const client = new RPClient({
        apiKey: 'startLaunchTest',
        endpoint: 'https://rp.us/api/v1',
        project: 'tst',
      });
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

    it('should log Launch UUID if enabled', () => {
      spyOn(OUTPUT_TYPES, 'STDOUT');
      const client = new RPClient({
        apiKey: 'startLaunchTest',
        endpoint: 'https://rp.us/api/v1',
        project: 'tst',
        launchUuidPrint: true,
      });
      const myPromise = Promise.resolve({ id: 'testidlaunch' });
      const time = 12345734;
      spyOn(client.restClient, 'create').and.returnValue(myPromise);
      return client
        .startLaunch({
          startTime: time,
        })
        .promise.then(function () {
          expect(OUTPUT_TYPES.STDOUT).toHaveBeenCalledWith(
            'Report Portal Launch UUID: testidlaunch',
          );
        });
    });

    it('should log Launch UUID into STDERR if enabled', () => {
      spyOn(OUTPUT_TYPES, 'STDERR');
      const client = new RPClient({
        apiKey: 'startLaunchTest',
        endpoint: 'https://rp.us/api/v1',
        project: 'tst',
        launchUuidPrint: true,
        launchUuidPrintOutput: 'stderr',
      });
      const myPromise = Promise.resolve({ id: 'testidlaunch' });
      const time = 12345734;
      spyOn(client.restClient, 'create').and.returnValue(myPromise);
      return client
        .startLaunch({
          startTime: time,
        })
        .promise.then(function () {
          expect(OUTPUT_TYPES.STDERR).toHaveBeenCalledWith(
            'Report Portal Launch UUID: testidlaunch',
          );
        });
    });

    it('should log Launch UUID into STDOUT if invalid output is set', () => {
      spyOn(OUTPUT_TYPES, 'STDOUT');
      const client = new RPClient({
        apiKey: 'startLaunchTest',
        endpoint: 'https://rp.us/api/v1',
        project: 'tst',
        launchUuidPrint: true,
        launchUuidPrintOutput: 'asdfgh',
      });
      const myPromise = Promise.resolve({ id: 'testidlaunch' });
      const time = 12345734;
      spyOn(client.restClient, 'create').and.returnValue(myPromise);
      return client
        .startLaunch({
          startTime: time,
        })
        .promise.then(function () {
          expect(OUTPUT_TYPES.STDOUT).toHaveBeenCalledWith(
            'Report Portal Launch UUID: testidlaunch',
          );
        });
    });

    it('should not log Launch UUID if not enabled', () => {
      spyOn(OUTPUT_TYPES, 'STDOUT');
      const client = new RPClient({
        apiKey: 'startLaunchTest',
        endpoint: 'https://rp.us/api/v1',
        project: 'tst',
      });
      const myPromise = Promise.resolve({ id: 'testidlaunch' });
      const time = 12345734;
      spyOn(client.restClient, 'create').and.returnValue(myPromise);
      return client
        .startLaunch({
          startTime: time,
        })
        .promise.then(function () {
          expect(OUTPUT_TYPES.STDOUT).not.toHaveBeenCalled();
        });
    });
  });

  describe('finishLaunch', () => {
    it('should call getRejectAnswer if there is no launchTempId with suitable launchTempId', () => {
      const client = new RPClient({ apiKey: 'any', endpoint: 'https://rp.api', project: 'prj' });
      client.map = {
        id1: {
          children: ['child1'],
        },
      };
      spyOn(client, 'getRejectAnswer');

      client.finishLaunch('id2', { some: 'data' });

      expect(client.getRejectAnswer).toHaveBeenCalledWith(
        'id2',
        new Error('Launch with tempId "id2" not found'),
      );
    });

    it('should trigger promiseFinish', (done) => {
      const client = new RPClient({ apiKey: 'any', endpoint: 'https://rp.api', project: 'prj' });
      client.map = {
        id1: {
          children: ['child1'],
          promiseStart: Promise.resolve(),
        },
        child1: {
          promiseFinish: Promise.resolve(),
        },
      };
      spyOn(client.map.child1, 'promiseFinish').and.resolveTo();

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
      const client = new RPClient({
        apiKey: 'test',
        project: 'test',
        endpoint: 'https://abc.com',
        attributes: [{ value: 'value' }],
      });
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
      const client = new RPClient({
        apiKey: 'test',
        project: 'test',
        endpoint: 'https://abc.com',
        launch: 'launch',
        attributes: [{ value: 'value' }],
      });
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

    it('should calls client', (done) => {
      const client = new RPClient({
        apiKey: 'startLaunchTest',
        endpoint: 'https://rp.us/api/v1',
        project: 'tst',
        isLaunchMergeRequired: true,
      });

      const myPromise = Promise.resolve({ id: 'testidlaunch' });
      spyOn(client.restClient, 'create').and.returnValue(myPromise);
      spyOn(helpers, 'readLaunchesFromFile').and.returnValue(fakeLaunchIds);
      spyOn(client, 'getMergeLaunchesRequest').and.returnValue(fakeMergeDataRQ);
      spyOn(client.restClient, 'retrieveSyncAPI').and.returnValue(
        Promise.resolve({
          content: [{ id: 'id1' }],
        }),
      );

      const promise = client.mergeLaunches();

      expect(promise.then).toBeDefined();
      promise.then(() => {
        expect(client.restClient.create).toHaveBeenCalledWith('launch/merge', fakeMergeDataRQ, {
          headers: client.headers,
        });

        done();
      });
    });

    it('should not call client if something went wrong', (done) => {
      const client = new RPClient({
        apiKey: 'startLaunchTest',
        endpoint: 'https://rp.us/api/v1',
        project: 'tst',
        isLaunchMergeRequired: true,
      });

      spyOn(client.helpers, 'readLaunchesFromFile').and.returnValue('launchUUid');
      spyOn(client.restClient, 'retrieveSyncAPI').and.resolveTo();
      spyOn(client.restClient, 'create').and.rejectWith();

      const promise = client.mergeLaunches();

      promise.then(() => {
        expect(client.restClient.create).not.toHaveBeenCalled();

        done();
      });
    });

    it('should return undefined if isLaunchMergeRequired is false', () => {
      const client = new RPClient({
        apiKey: 'startLaunchTest',
        endpoint: 'https://rp.us/api/v1',
        project: 'tst',
        isLaunchMergeRequired: false,
      });

      const result = client.mergeLaunches();

      expect(result).toEqual(undefined);
    });
  });

  describe('getPromiseFinishAllItems', () => {
    it('should return promise', (done) => {
      const client = new RPClient({
        apiKey: 'startLaunchTest',
        endpoint: 'https://rp.us/api/v1',
        project: 'tst',
      });
      client.map = {
        id1: {
          children: ['child1'],
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
    it('should call getRejectAnswer if there is no launchTempId with suitable launchTempId', () => {
      const client = new RPClient({
        apiKey: 'startLaunchTest',
        endpoint: 'https://rp.us/api/v1',
        project: 'tst',
      });
      client.map = {
        id1: {
          children: ['child1'],
        },
      };
      spyOn(client, 'getRejectAnswer');

      client.updateLaunch('id2', { some: 'data' });

      expect(client.getRejectAnswer).toHaveBeenCalledWith(
        'id2',
        new Error('Launch with tempId "id2" not found'),
      );
    });

    it('should return object with tempId and promise', () => {
      const client = new RPClient({
        apiKey: 'startLaunchTest',
        endpoint: 'https://rp.us/api/v1',
        project: 'tst',
      });
      client.map = {
        id1: {
          children: ['child1'],
          promiseFinish: Promise.resolve(),
        },
      };
      spyOn(client.restClient, 'update').and.resolveTo();

      const result = client.updateLaunch('id1', { some: 'data' });

      expect(result.tempId).toEqual('id1');
      return expectAsync(result.promise).toBeResolved();
    });
  });

  describe('startTestItem', () => {
    it('should call getRejectAnswer if there is no launchTempId with suitable launchTempId', () => {
      const client = new RPClient({
        apiKey: 'startLaunchTest',
        endpoint: 'https://rp.us/api/v1',
        project: 'tst',
      });
      client.map = {
        id1: {
          children: ['child1'],
        },
      };
      spyOn(client, 'getRejectAnswer');

      client.startTestItem({}, 'id2');

      expect(client.getRejectAnswer).toHaveBeenCalledWith(
        'id2',
        new Error('Launch with tempId "id2" not found'),
      );
    });

    it('should call getRejectAnswer if launchObj.finishSend is true', () => {
      const client = new RPClient({
        apiKey: 'startLaunchTest',
        endpoint: 'https://rp.us/api/v1',
        project: 'tst',
      });
      client.map = {
        id1: {
          children: ['child1'],
          finishSend: true,
        },
      };
      spyOn(client, 'getRejectAnswer');
      const error = new Error(
        'Launch with tempId "id1" is already finished, you can not add an item to it',
      );

      client.startTestItem({}, 'id1');

      expect(client.getRejectAnswer).toHaveBeenCalledWith('id1', error);
    });

    it('should call getRejectAnswer if there is no parentObj with suitable parentTempId', () => {
      const client = new RPClient({
        apiKey: 'startLaunchTest',
        endpoint: 'https://rp.us/api/v1',
        project: 'tst',
      });
      client.map = {
        id: {
          children: ['id1'],
        },
        id1: {
          children: ['child1'],
        },
      };
      spyOn(client, 'getRejectAnswer');
      const error = new Error('Item with tempId "id3" not found');

      client.startTestItem({ testCaseId: 'testCaseId' }, 'id1', 'id3');

      expect(client.getRejectAnswer).toHaveBeenCalledWith('id1', error);
    });

    it('should return object with tempId and promise', () => {
      const client = new RPClient({
        apiKey: 'startLaunchTest',
        endpoint: 'https://rp.us/api/v1',
        project: 'tst',
      });
      client.map = {
        id: {
          children: ['id1', '4n5pxq24kpiob12og9'],
          promiseStart: Promise.resolve(),
        },
        id1: {
          children: ['child1'],
          promiseStart: Promise.resolve(),
        },
        '4n5pxq24kpiob12og9': {
          promiseStart: Promise.resolve(),
        },
      };
      spyOn(client.itemRetriesChainMap, 'get').and.resolveTo();
      spyOn(client.restClient, 'create').and.resolveTo({});
      spyOn(client, 'getUniqId').and.returnValue('4n5pxq24kpiob12og9');

      const result = client.startTestItem({ retry: false }, 'id1', 'id');

      expect(result.tempId).toEqual('4n5pxq24kpiob12og9');
      return expectAsync(result.promise).toBeResolved();
    });

    it('should get previous try promise from itemRetriesChainMap if retry is true', () => {
      const client = new RPClient({
        apiKey: 'startLaunchTest',
        endpoint: 'https://rp.us/api/v1',
        project: 'tst',
      });
      client.map = {
        id: {
          children: ['id1', '4n5pxq24kpiob12og9'],
          promiseStart: Promise.resolve(),
        },
        id1: {
          children: ['child1'],
          promiseStart: Promise.resolve(),
        },
        '4n5pxq24kpiob12og9': {
          promiseStart: Promise.resolve(),
        },
      };
      spyOn(client, 'calculateItemRetriesChainMapKey').and.returnValue('id1__name__');
      spyOn(client, 'getUniqId').and.returnValue('4n5pxq24kpiob12og9');
      spyOn(client.map['4n5pxq24kpiob12og9'], 'promiseStart').and.resolveTo();
      spyOn(client.itemRetriesChainMap, 'get');

      client.startTestItem({ retry: true }, 'id1');

      expect(client.itemRetriesChainMap.get).toHaveBeenCalledWith('id1__name__');
    });
  });

  describe('finishTestItem', () => {
    it('should call getRejectAnswer if there is no itemObj with suitable itemTempId', () => {
      const client = new RPClient({
        apiKey: 'startLaunchTest',
        endpoint: 'https://rp.us/api/v1',
        project: 'tst',
      });
      client.map = {
        id1: {
          children: ['child1'],
        },
      };
      spyOn(client, 'getRejectAnswer');

      client.finishTestItem('id2', {});

      expect(client.getRejectAnswer).toHaveBeenCalledWith(
        'id2',
        new Error('Item with tempId "id2" not found'),
      );
    });

    it('should call finishTestItemPromiseStart with correct parameters', (done) => {
      const client = new RPClient({
        apiKey: 'startLaunchTest',
        endpoint: 'https://rp.us/api/v1',
        project: 'tst',
      });
      client.map = {
        id: {
          children: ['id1'],
          promiseFinish: Promise.resolve(),
        },
        id1: {
          children: ['child1'],
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

    it('should call finishTestItemPromiseStart with correct parameters if smt went wrong', (done) => {
      const client = new RPClient({
        apiKey: 'startLaunchTest',
        endpoint: 'https://rp.us/api/v1',
        project: 'tst',
      });
      client.map = {
        id: {
          children: ['id1'],
          promiseFinish: Promise.resolve(),
        },
        id1: {
          children: ['child1'],
          promiseFinish: Promise.reject(),
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
  });

  describe('saveLog', () => {
    it('should return object with tempId and promise', () => {
      const client = new RPClient({ apiKey: 'any', endpoint: 'https://rp.api', project: 'prj' });
      client.map = {
        id1: {
          children: ['child1'],
        },
      };
      spyOn(client, 'getUniqId').and.returnValue('4n5pxq24kpiob12og9');
      spyOn(client.restClient, 'create').and.resolveTo();

      const result = client.saveLog(
        {
          promiseStart: Promise.resolve(),
          realId: 'realId',
          children: [],
        },
        client.restClient.create,
      );

      expect(result.tempId).toEqual('4n5pxq24kpiob12og9');
      return expectAsync(result.promise).toBeResolved();
    });
  });

  describe('sendLog', () => {
    it('should return sendLogWithFile if fileObj is not empty', () => {
      const client = new RPClient({ apiKey: 'any', endpoint: 'https://rp.api', project: 'prj' });
      spyOn(client, 'sendLogWithFile').and.returnValue('sendLogWithFile');

      const result = client.sendLog('itemTempId', { message: 'message' }, { name: 'name' });

      expect(result).toEqual('sendLogWithFile');
    });

    it('should return sendLogWithoutFile if fileObj is empty', () => {
      const client = new RPClient({ apiKey: 'any', endpoint: 'https://rp.api', project: 'prj' });
      spyOn(client, 'sendLogWithoutFile').and.returnValue('sendLogWithoutFile');

      const result = client.sendLog('itemTempId', { message: 'message' });

      expect(result).toEqual('sendLogWithoutFile');
    });
  });

  describe('sendLogWithoutFile', () => {
    it('should call getRejectAnswer if there is no itemObj with suitable itemTempId', () => {
      const client = new RPClient({ apiKey: 'any', endpoint: 'https://rp.api', project: 'prj' });
      client.map = {
        id1: {
          children: ['child1'],
        },
      };
      spyOn(client, 'getRejectAnswer');

      client.sendLogWithoutFile('itemTempId', {});

      expect(client.getRejectAnswer).toHaveBeenCalledWith(
        'itemTempId',
        new Error('Item with tempId "itemTempId" not found'),
      );
    });

    it('should return saveLog function', () => {
      const client = new RPClient({ apiKey: 'any', endpoint: 'https://rp.api', project: 'prj' });
      client.map = {
        itemTempId: {
          children: ['child1'],
        },
      };
      spyOn(client, 'saveLog').and.returnValue('saveLog');

      const result = client.sendLogWithoutFile('itemTempId', {});

      expect(result).toEqual('saveLog');
    });
  });

  describe('sendLogWithFile', () => {
    it('should call getRejectAnswer if there is no itemObj with suitable itemTempId', () => {
      const client = new RPClient({ apiKey: 'any', endpoint: 'https://rp.api', project: 'prj' });
      client.map = {
        id1: {
          children: ['child1'],
        },
      };
      spyOn(client, 'getRejectAnswer');

      client.sendLogWithFile('itemTempId', {});

      expect(client.getRejectAnswer).toHaveBeenCalledWith(
        'itemTempId',
        new Error('Item with tempId "itemTempId" not found'),
      );
    });

    it('should return saveLog function', () => {
      const client = new RPClient({ apiKey: 'any', endpoint: 'https://rp.api', project: 'prj' });
      client.map = {
        itemTempId: {
          children: ['child1'],
        },
      };
      spyOn(client, 'saveLog').and.returnValue('saveLog');

      const result = client.sendLogWithFile('itemTempId', {});

      expect(result).toEqual('saveLog');
    });
  });

  describe('getRequestLogWithFile', () => {
    it('should return restClient.create', () => {
      const client = new RPClient({ apiKey: 'any', endpoint: 'https://rp.api', project: 'prj' });
      client.map = {
        id1: {
          children: ['child1'],
        },
      };
      spyOn(client, 'buildMultiPartStream').and.returnValue();
      spyOn(client.restClient, 'create').and.resolveTo();

      const result = client.getRequestLogWithFile({}, { name: 'name' });

      return expectAsync(result).toBeResolved();
    });

    it('should return restClient.create with error', () => {
      const client = new RPClient({ apiKey: 'any', endpoint: 'https://rp.api', project: 'prj' });
      client.map = {
        id1: {
          children: ['child1'],
        },
      };
      spyOn(client, 'buildMultiPartStream').and.returnValue();
      spyOn(client.restClient, 'create').and.rejectWith();

      const result = client.getRequestLogWithFile({}, { name: 'name' });

      expect(result.catch).toBeDefined();
    });
  });
});
