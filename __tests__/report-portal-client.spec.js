const process = require('process');
const RPClient = require('../build/lib/report-portal-client').default;
const helpers = require('../build/lib/helpers');
const { OUTPUT_TYPES } = require('../build/lib/constants/outputs');

describe('ReportPortal javascript client', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

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
      jest.spyOn(console, 'log').mockImplementation();

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
      jest.spyOn(console, 'log').mockImplementation();

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
      jest.spyOn(console, 'log').mockImplementation();

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
      return expect(rejectAnswer.promise).rejects.toEqual('error');
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
      jest.spyOn(client.restClient, 'request').mockReturnValue(Promise.resolve('ok'));

      const request = client.checkConnect();

      return expect(request).resolves.toBeDefined();
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

    it('should call statistics.trackEvent if REPORTPORTAL_CLIENT_JS_NO_ANALYTICS is not set', async () => {
      const client = new RPClient({
        apiKey: 'startLaunchTest',
        endpoint: 'https://rp.us/api/v1',
        project: 'tst',
      });
      jest.spyOn(client.statistics, 'trackEvent').mockImplementation();

      await client.triggerStatisticsEvent();

      expect(client.statistics.trackEvent).toHaveBeenCalled();
    });

    it('should not call statistics.trackEvent if REPORTPORTAL_CLIENT_JS_NO_ANALYTICS is true', async () => {
      const client = new RPClient({
        apiKey: 'startLaunchTest',
        endpoint: 'https://rp.us/api/v1',
        project: 'tst',
      });
      process.env.REPORTPORTAL_CLIENT_JS_NO_ANALYTICS = true;
      jest.spyOn(client.statistics, 'trackEvent').mockImplementation();

      await client.triggerStatisticsEvent();

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
        expect.objectContaining({
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
        expect.objectContaining({
          agent_name: expect.anything(),
          agent_version: expect.anything(),
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
      jest.spyOn(client.restClient, 'create').mockReturnValue(myPromise);
      jest.spyOn(helpers, 'getSystemAttribute').mockReturnValue(fakeSystemAttr);

      client.startLaunch({
        startTime: time,
      });

      expect(client.restClient.create).toHaveBeenCalledWith('launch', {
        name: 'Test launch name',
        startTime: time,
        attributes: fakeSystemAttr,
      });
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
      const myPromise = Promise.resolve({ id: 'testidlaunch' });
      const time = 12345734;
      jest.spyOn(client.restClient, 'create').mockReturnValue(myPromise);
      jest.spyOn(helpers, 'getSystemAttribute').mockReturnValue(fakeSystemAttr);

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
      });
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
      jest.spyOn(client.restClient, 'create').mockReturnValue(myPromise);

      client.startLaunch({
        startTime,
        id,
      });

      expect(client.restClient.create).not.toHaveBeenCalled();
      expect(client.launchUuid).toEqual(id);
    });

    it('should log Launch UUID if enabled', () => {
      jest.spyOn(OUTPUT_TYPES, 'STDOUT').mockImplementation();
      const client = new RPClient({
        apiKey: 'startLaunchTest',
        endpoint: 'https://rp.us/api/v1',
        project: 'tst',
        launchUuidPrint: true,
      });
      const myPromise = Promise.resolve({ id: 'testidlaunch' });
      const time = 12345734;
      jest.spyOn(client.restClient, 'create').mockReturnValue(myPromise);
      return client
        .startLaunch({
          startTime: time,
        })
        .promise.then(function () {
          expect(OUTPUT_TYPES.STDOUT).toHaveBeenCalledWith('testidlaunch');
        });
    });

    it('should log Launch UUID into STDERR if enabled', () => {
      jest.spyOn(OUTPUT_TYPES, 'STDERR').mockImplementation();
      const client = new RPClient({
        apiKey: 'startLaunchTest',
        endpoint: 'https://rp.us/api/v1',
        project: 'tst',
        launchUuidPrint: true,
        launchUuidPrintOutput: 'stderr',
      });
      const myPromise = Promise.resolve({ id: 'testidlaunch' });
      const time = 12345734;
      jest.spyOn(client.restClient, 'create').mockReturnValue(myPromise);
      return client
        .startLaunch({
          startTime: time,
        })
        .promise.then(function () {
          expect(OUTPUT_TYPES.STDERR).toHaveBeenCalledWith('testidlaunch');
        });
    });

    it('should log Launch UUID into STDOUT if invalid output is set', () => {
      jest.spyOn(OUTPUT_TYPES, 'STDOUT').mockImplementation();
      const client = new RPClient({
        apiKey: 'startLaunchTest',
        endpoint: 'https://rp.us/api/v1',
        project: 'tst',
        launchUuidPrint: true,
        launchUuidPrintOutput: 'asdfgh',
      });
      const myPromise = Promise.resolve({ id: 'testidlaunch' });
      const time = 12345734;
      jest.spyOn(client.restClient, 'create').mockReturnValue(myPromise);
      return client
        .startLaunch({
          startTime: time,
        })
        .promise.then(function () {
          expect(OUTPUT_TYPES.STDOUT).toHaveBeenCalledWith('testidlaunch');
        });
    });

    it('should log Launch UUID into ENVIRONMENT if enabled', () => {
      jest.spyOn(OUTPUT_TYPES, 'ENVIRONMENT').mockImplementation();
      const client = new RPClient({
        apiKey: 'startLaunchTest',
        endpoint: 'https://rp.us/api/v1',
        project: 'tst',
        launchUuidPrint: true,
        launchUuidPrintOutput: 'environment',
      });
      const myPromise = Promise.resolve({ id: 'testidlaunch' });
      const time = 12345734;
      jest.spyOn(client.restClient, 'create').mockReturnValue(myPromise);
      return client
        .startLaunch({
          startTime: time,
        })
        .promise.then(function () {
          expect(OUTPUT_TYPES.ENVIRONMENT).toHaveBeenCalledWith('testidlaunch');
        });
    });

    it('should log Launch UUID into FILE if enabled', () => {
      jest.spyOn(OUTPUT_TYPES, 'FILE').mockImplementation();
      const client = new RPClient({
        apiKey: 'startLaunchTest',
        endpoint: 'https://rp.us/api/v1',
        project: 'tst',
        launchUuidPrint: true,
        launchUuidPrintOutput: 'file',
      });
      const myPromise = Promise.resolve({ id: 'testidlaunch' });
      const time = 12345734;
      jest.spyOn(client.restClient, 'create').mockReturnValue(myPromise);
      return client
        .startLaunch({
          startTime: time,
        })
        .promise.then(function () {
          expect(OUTPUT_TYPES.FILE).toHaveBeenCalledWith('testidlaunch');
        });
    });

    it('should not log Launch UUID if not enabled', () => {
      jest.spyOn(OUTPUT_TYPES, 'STDOUT').mockImplementation();
      const client = new RPClient({
        apiKey: 'startLaunchTest',
        endpoint: 'https://rp.us/api/v1',
        project: 'tst',
      });
      const myPromise = Promise.resolve({ id: 'testidlaunch' });
      const time = 12345734;
      jest.spyOn(client.restClient, 'create').mockReturnValue(myPromise);
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
      jest.spyOn(client, 'getRejectAnswer').mockImplementation();

      client.finishLaunch('id2', { some: 'data' });

      expect(client.getRejectAnswer).toHaveBeenCalledWith(
        'id2',
        new Error('Launch with tempId "id2" not found'),
      );
    });

    it('should trigger promiseFinish', async () => {
      const client = new RPClient({ apiKey: 'any', endpoint: 'https://rp.api', project: 'prj' });
      client.map = {
        id1: {
          children: ['child1'],
          promiseStart: Promise.resolve(),
          resolveFinish: jest.fn().mockResolvedValue(),
        },
        child1: {
          promiseFinish: jest.fn().mockResolvedValue(),
        },
      };

      jest.spyOn(client.restClient, 'update').mockResolvedValue({ link: 'link' });

      await client.finishLaunch('id1', { some: 'data' }).promise;

      expect(client.map.child1.promiseFinish().then).toBeDefined();
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
      jest.spyOn(client.helpers, 'now').mockReturnValue(12345734);

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
      jest.spyOn(client.helpers, 'now').mockReturnValue(12345734);

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

    it('should call rest client with required parameters', async () => {
      const client = new RPClient({
        apiKey: 'startLaunchTest',
        endpoint: 'https://rp.us/api/v1',
        project: 'tst',
        isLaunchMergeRequired: true,
      });

      const myPromise = Promise.resolve({ id: 'testidlaunch' });
      jest.spyOn(client.restClient, 'create').mockReturnValue(myPromise);
      jest.spyOn(helpers, 'readLaunchesFromFile').mockReturnValue(fakeLaunchIds);
      jest.spyOn(client, 'getMergeLaunchesRequest').mockReturnValue(fakeMergeDataRQ);
      jest.spyOn(client.restClient, 'retrieveSyncAPI').mockReturnValue(
        Promise.resolve({
          content: [{ id: 'id1' }],
        }),
      );

      const promise = client.mergeLaunches();

      expect(promise.then).toBeDefined();
      await promise;
      expect(client.restClient.create).toHaveBeenCalledWith('launch/merge', fakeMergeDataRQ);
    });

    it('should not call rest client if something went wrong', async () => {
      const client = new RPClient({
        apiKey: 'startLaunchTest',
        endpoint: 'https://rp.us/api/v1',
        project: 'tst',
        isLaunchMergeRequired: true,
      });

      jest.spyOn(client.helpers, 'readLaunchesFromFile').mockReturnValue('launchUUid');
      jest.spyOn(client.restClient, 'retrieveSyncAPI').mockResolvedValue();
      jest.spyOn(client.restClient, 'create').mockRejectedValue();
      await client.mergeLaunches();

      expect(client.restClient.create).not.toHaveBeenCalled();
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

      const promise = client.getPromiseFinishAllItems('id1');

      expect(promise).toBeInstanceOf(Promise);
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
      jest.spyOn(client, 'getRejectAnswer').mockImplementation();

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
      jest.spyOn(client.restClient, 'update').mockResolvedValue();

      const result = client.updateLaunch('id1', { some: 'data' });

      expect(result.tempId).toEqual('id1');
      return expect(result.promise).resolves.toBeUndefined();
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
      jest.spyOn(client, 'getRejectAnswer').mockImplementation();

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
      jest.spyOn(client, 'getRejectAnswer').mockImplementation();
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
      jest.spyOn(client, 'getRejectAnswer').mockImplementation();
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
      jest.spyOn(client.itemRetriesChainMap, 'get').mockResolvedValue();
      jest.spyOn(client.restClient, 'create').mockResolvedValue({});
      jest.spyOn(client, 'getUniqId').mockReturnValue('4n5pxq24kpiob12og9');

      const result = client.startTestItem({ retry: false }, 'id1', 'id');

      expect(result.tempId).toEqual('4n5pxq24kpiob12og9');
      return expect(result.promise).resolves.toBeDefined();
    });

    it('should get previous try promise from itemRetriesChainMap if retry is true', async () => {
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
      jest.spyOn(client, 'calculateItemRetriesChainMapKey').mockReturnValue('id1__name__');
      jest.spyOn(client, 'getUniqId').mockReturnValue('4n5pxq24kpiob12og9');
      jest.spyOn(client.itemRetriesChainMap, 'get').mockImplementation();
      jest.spyOn(client.restClient, 'create').mockResolvedValue({});

      await client.startTestItem({ retry: true }, 'id1').promise;

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
      jest.spyOn(client, 'getRejectAnswer').mockImplementation();

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
      jest.spyOn(client, 'cleanMap').mockImplementation();
      jest.spyOn(client, 'finishTestItemPromiseStart').mockImplementation();
      jest.spyOn(client.helpers, 'now').mockReturnValue(1234567);

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
      jest.spyOn(client, 'cleanMap').mockImplementation();
      jest.spyOn(client, 'finishTestItemPromiseStart').mockImplementation();
      jest.spyOn(client.helpers, 'now').mockReturnValue(1234567);

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

    it('should automatically add NOT_ISSUE when status is SKIPPED and skippedIssue is false', function (done) {
      const mockClient = new RPClient({
        apiKey: 'test',
        endpoint: 'https://reportportal-stub-url',
        launch: 'test launch',
        project: 'test project',
        skippedIssue: false,
      }, { name: 'test', version: '1.0.0' });

      const spyFinishTestItemPromiseStart = jest.spyOn(mockClient, 'finishTestItemPromiseStart').mockImplementation(() => {});

      mockClient.map = {
        testItemId: {
          children: [],
          finishSend: false,
          promiseFinish: Promise.resolve(),
          resolveFinish: () => {},
        },
      };

      const finishTestItemRQ = {
        status: 'skipped',
      };

      mockClient.finishTestItem('testItemId', finishTestItemRQ);

      setTimeout(() => {
        expect(spyFinishTestItemPromiseStart).toHaveBeenCalledWith(
          expect.any(Object),
          'testItemId',
          expect.objectContaining({
            status: 'skipped',
            issue: { issueType: 'NOT_ISSUE' },
          })
        );
        done();
      }, 50);
    });

    it('should not add NOT_ISSUE when status is SKIPPED and skippedIssue is true', function (done) {
      const mockClient = new RPClient({
        apiKey: 'test',
        endpoint: 'https://reportportal-stub-url',
        launch: 'test launch',
        project: 'test project',
        skippedIssue: true,
      }, { name: 'test', version: '1.0.0' });

      const spyFinishTestItemPromiseStart = jest.spyOn(mockClient, 'finishTestItemPromiseStart').mockImplementation(() => {});

      mockClient.map = {
        testItemId: {
          children: [],
          finishSend: false,
          promiseFinish: Promise.resolve(),
          resolveFinish: () => {},
        },
      };

      const finishTestItemRQ = {
        status: 'skipped',
      };

      mockClient.finishTestItem('testItemId', finishTestItemRQ);

      setTimeout(() => {
        expect(spyFinishTestItemPromiseStart).toHaveBeenCalledWith(
          expect.any(Object),
          'testItemId',
          expect.objectContaining({
            status: 'skipped',
          })
        );
        expect(spyFinishTestItemPromiseStart).not.toHaveBeenCalledWith(
          expect.any(Object),
          'testItemId',
          expect.objectContaining({
            issue: expect.anything(),
          })
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
      jest.spyOn(client, 'getUniqId').mockReturnValue('4n5pxq24kpiob12og9');
      jest.spyOn(client.restClient, 'create').mockResolvedValue();

      const result = client.saveLog(
        {
          promiseStart: Promise.resolve(),
          realId: 'realId',
          children: [],
        },
        client.restClient.create,
      );

      expect(result.tempId).toEqual('4n5pxq24kpiob12og9');
      return expect(result.promise).resolves.toBeUndefined();
    });
  });

  describe('sendLog', () => {
    it('should return sendLogWithFile if fileObj is not empty', () => {
      const client = new RPClient({ apiKey: 'any', endpoint: 'https://rp.api', project: 'prj' });
      jest.spyOn(client, 'sendLogWithFile').mockReturnValue('sendLogWithFile');

      const result = client.sendLog('itemTempId', { message: 'message' }, { name: 'name' });

      expect(result).toEqual('sendLogWithFile');
    });

    it('should return sendLogWithoutFile if fileObj is empty', () => {
      const client = new RPClient({ apiKey: 'any', endpoint: 'https://rp.api', project: 'prj' });
      jest.spyOn(client, 'sendLogWithoutFile').mockReturnValue('sendLogWithoutFile');

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
      jest.spyOn(client, 'getRejectAnswer').mockImplementation();

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
      jest.spyOn(client, 'saveLog').mockReturnValue('saveLog');

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
      jest.spyOn(client, 'getRejectAnswer').mockImplementation();

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
      jest.spyOn(client, 'saveLog').mockReturnValue('saveLog');

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
      jest.spyOn(client, 'buildMultiPartStream').mockReturnValue();
      jest.spyOn(client.restClient, 'create').mockResolvedValue('value');

      const result = client.getRequestLogWithFile({}, { name: 'name' });

      return expect(result).resolves.toBe('value');
    });

    it('should return restClient.create with error', () => {
      const client = new RPClient({ apiKey: 'any', endpoint: 'https://rp.api', project: 'prj' });
      client.map = {
        id1: {
          children: ['child1'],
        },
      };
      jest.spyOn(client, 'buildMultiPartStream').mockReturnValue();
      jest.spyOn(client.restClient, 'create').mockRejectedValue();

      const result = client.getRequestLogWithFile({}, { name: 'name' });

      expect(result.catch).toBeDefined();
    });
  });
});
