import process from 'process';
import RPClient from '../src/report-portal-client';
import RestClient from '../src/rest';
import * as helpers from '../src/helpers';
import { OUTPUT_TYPES } from '../src/constants/outputs';
import type { AgentParams, Attachment, ClientResponse } from '../src/models/common';
import type { NormalizedClientConfig } from '../src/models/config';
import type {
  FinishLaunchOptions,
  FinishTestItemOptions,
  FinishTestItemRQ,
  LogOptions,
  MergeLaunchesOptions,
  StartLaunchOptions,
  StartTestItemOptions,
  UpdateLaunchOptions,
} from '../src/models/requests';
import type {
  FinishLaunchResponse,
  PageLaunchResource,
  ServerInfoResponse,
  StartLaunchResponse,
  StartTestItemResponse,
  UpdateLaunchResponse,
} from '../src/models/responses';

// Mirrors the (non-exported) internal item/launch record kept in `RPClient.map`.
interface ItemObj<T = unknown> {
  promiseStart: Promise<T>;
  realId: string;
  children: string[];
  finishSend: boolean;
  promiseFinish: Promise<T>;
  resolveFinish: (value: T) => void;
  rejectFinish: (reason?: Error) => void;
}

type RequestPromiseFunc = (itemUuid: string, launchUuid: string) => Promise<unknown>;

// `eventName` / `eventParams` are private on Statistics, but these tests assert on them directly.
interface StatisticsInternal {
  eventName: string;
  eventParams: Record<string, unknown>;
  setInstanceID(instanceID: string): void;
  trackEvent(): Promise<void>;
}

// Almost every member of RPClient is `private` by design (the public surface is the reporting API
// only). These tests are deliberately whitebox: they seed `map`, stub `restClient`/`statistics` and
// assert on internal state, so they need a typed escape hatch into those members.
// A standalone interface (not an intersection with RPClient) is required - intersecting a type
// literal with a class that has private members collapses to `never`.
interface RPClientInternal {
  config: NormalizedClientConfig;
  debug?: boolean;
  isLaunchMergeRequired: boolean;
  apiKey: string | null;
  token: string | null;
  map: Record<string, ItemObj>;
  baseURL: string;
  headers: Record<string, string>;
  helpers: typeof helpers;
  restClient: RestClient;
  statistics: StatisticsInternal;
  launchUuid: string;
  itemRetriesChainMap: Map<string, Promise<unknown>>;
  itemRetriesChainKeyMapByTempId: Map<string, string>;

  logDebug(msg: unknown, dataMsg?: unknown): void;
  calculateItemRetriesChainMapKey(
    launchId: string,
    parentId: string | undefined,
    name: string,
    itemId?: string,
  ): string;
  cleanItemRetriesChain(tempIds: string[]): void;
  getUniqId(): string;
  getRejectAnswer<T = unknown>(tempId: string, error: Error): ClientResponse<T>;
  cleanMap(ids: string[]): void;
  checkConnect(): Promise<PageLaunchResource>;
  getServerInfoUrl(): string;
  fetchServerInfo(): Promise<ServerInfoResponse>;
  triggerStatisticsEvent(): Promise<void>;
  startLaunch(
    launchDataRQ: StartLaunchOptions,
  ): ClientResponse<StartLaunchResponse | StartLaunchOptions>;
  finishLaunch(
    launchTempId: string,
    finishExecutionRQ?: FinishLaunchOptions,
  ): ClientResponse<FinishLaunchResponse>;
  getMergeLaunchesRequest(
    launchIds: Array<string | number>,
    mergeOptions?: MergeLaunchesOptions,
  ): Record<string, unknown>;
  mergeLaunches(mergeOptions?: MergeLaunchesOptions): Promise<void> | undefined;
  getPromiseFinishAllItems(launchTempId: string): Promise<unknown[]>;
  updateLaunch(
    launchTempId: string,
    launchData: UpdateLaunchOptions,
  ): ClientResponse<UpdateLaunchResponse>;
  startTestItem(
    testItemDataRQ: StartTestItemOptions,
    launchTempId: string,
    parentTempId?: string,
  ): ClientResponse<StartTestItemResponse>;
  finishTestItem(
    itemTempId: string,
    finishTestItemRQ?: FinishTestItemOptions,
  ): ClientResponse<unknown>;
  saveLog(itemObj: ItemObj, requestPromiseFunc: RequestPromiseFunc): ClientResponse;
  sendLog(itemTempId: string, saveLogRQ: LogOptions, fileObj?: Attachment): ClientResponse;
  sendLogWithoutFile(itemTempId: string, saveLogRQ: LogOptions): ClientResponse;
  // `fileObj` is optional here only so the tests can reproduce the original JS calls that omit it.
  sendLogWithFile(itemTempId: string, saveLogRQ: LogOptions, fileObj?: Attachment): ClientResponse;
  getRequestLogWithFile(saveLogRQ: LogOptions, fileObj: Attachment): Promise<unknown>;
  buildMultiPartStream(jsonPart: unknown[], filePart: Attachment, boundary: string): Buffer;
  finishTestItemPromiseStart(
    itemObj: ItemObj,
    itemTempId: string,
    finishTestItemData: FinishTestItemRQ,
  ): void;
}

const asInternal = (client: RPClient): RPClientInternal => client as unknown as RPClientInternal;

// The tests seed `map` with deliberately partial item records (only the fields the code path under
// test reads), so the literals need to be widened to the real map shape.
const asMap = (map: Record<string, unknown>): Record<string, ItemObj> =>
  map as unknown as Record<string, ItemObj>;

describe('ReportPortal javascript client', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('creates the client instance without error', () => {
      const client = asInternal(
        new RPClient({
          apiKey: 'test',
          project: 'test',
          endpoint: 'https://abc.com',
        }),
      );

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

      // The original test intentionally rejects with a plain string, not an Error.
      const rejectAnswer = client.getRejectAnswer('tempId', 'error' as unknown as Error);

      expect(rejectAnswer.tempId).toEqual('tempId');
      return expect(rejectAnswer.promise).rejects.toEqual('error');
    });
  });

  describe('cleanMap', () => {
    it('should delete element with id', () => {
      const client = asInternal(
        new RPClient({
          apiKey: 'test',
          project: 'test',
          endpoint: 'https://abc.com',
        }),
      );
      client.map = asMap({
        id1: 'firstElement',
        id2: 'secondElement',
        id3: 'thirdElement',
      });

      client.cleanMap(['id1', 'id2']);

      expect(client.map).toEqual({ id3: 'thirdElement' });
    });
  });

  describe('checkConnect', () => {
    it('should return promise', () => {
      const client = asInternal(
        new RPClient({
          apiKey: 'test',
          project: 'test',
          endpoint: 'https://abc.com',
        }),
      );
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
      const client = asInternal(
        new RPClient({
          apiKey: 'startLaunchTest',
          endpoint: 'https://rp.us/api/v1',
          project: 'tst',
        }),
      );
      jest.spyOn(client, 'fetchServerInfo').mockResolvedValue({});
      jest.spyOn(client.statistics, 'trackEvent').mockImplementation();

      await client.triggerStatisticsEvent();

      expect(client.statistics.trackEvent).toHaveBeenCalled();
    });

    it('should not call statistics.trackEvent if REPORTPORTAL_CLIENT_JS_NO_ANALYTICS is true', async () => {
      const client = asInternal(
        new RPClient({
          apiKey: 'startLaunchTest',
          endpoint: 'https://rp.us/api/v1',
          project: 'tst',
        }),
      );
      // The original test assigns the boolean `true`, not the string 'true'.
      process.env.REPORTPORTAL_CLIENT_JS_NO_ANALYTICS = true as unknown as string;
      jest.spyOn(client.statistics, 'trackEvent').mockImplementation();

      await client.triggerStatisticsEvent();

      expect(client.statistics.trackEvent).not.toHaveBeenCalled();
    });

    it('should create statistics object with agentParams is not empty', () => {
      const agentParams: AgentParams = {
        name: 'name',
        version: 'version',
      };
      const client = asInternal(
        new RPClient(
          {
            apiKey: 'startLaunchTest',
            endpoint: 'https://rp.us/api/v1',
            project: 'tst',
          },
          agentParams,
        ),
      );
      // The original test assigns the boolean `false`, not the string 'false'.
      process.env.REPORTPORTAL_CLIENT_JS_NO_ANALYTICS = false as unknown as string;

      expect(client.statistics.eventName).toEqual('start_launch');
      expect(client.statistics.eventParams).toEqual(
        expect.objectContaining({
          agent_name: agentParams.name,
          agent_version: agentParams.version,
        }),
      );
    });

    it('should create statistics object without agentParams if they are empty', () => {
      const client = asInternal(
        new RPClient({
          apiKey: 'startLaunchTest',
          endpoint: 'https://rp.us/api/v1',
          project: 'tst',
        }),
      );

      expect(client.statistics.eventName).toEqual('start_launch');
      expect(client.statistics.eventParams).not.toEqual(
        expect.objectContaining({
          agent_name: expect.anything(),
          agent_version: expect.anything(),
        }),
      );
    });

    it('should fetch server info and set instanceID before tracking event', async () => {
      const client = asInternal(
        new RPClient({
          apiKey: 'startLaunchTest',
          endpoint: 'https://rp.us/api/v1',
          project: 'tst',
        }),
      );
      const serverInfoResponse: ServerInfoResponse = {
        extensions: {
          result: {
            'server.details.instance': 'test-instance-123',
          },
        },
      };
      jest.spyOn(client, 'fetchServerInfo').mockResolvedValue(serverInfoResponse);
      jest.spyOn(client.statistics, 'trackEvent').mockImplementation();
      jest.spyOn(client.statistics, 'setInstanceID');

      await client.triggerStatisticsEvent();

      expect(client.fetchServerInfo).toHaveBeenCalled();
      expect(client.statistics.setInstanceID).toHaveBeenCalledWith('test-instance-123');
      expect(client.statistics.trackEvent).toHaveBeenCalled();
    });

    it('should still track event with not_set instanceID if fetchServerInfo fails', async () => {
      const client = asInternal(
        new RPClient({
          apiKey: 'startLaunchTest',
          endpoint: 'https://rp.us/api/v1',
          project: 'tst',
        }),
      );
      jest.spyOn(client, 'fetchServerInfo').mockRejectedValue(new Error('Network error'));
      jest.spyOn(client.statistics, 'trackEvent').mockImplementation();
      jest.spyOn(client.statistics, 'setInstanceID');

      await client.triggerStatisticsEvent();

      expect(client.statistics.setInstanceID).toHaveBeenCalledWith('not_set');
      expect(client.statistics.trackEvent).toHaveBeenCalled();
    });

    it('should not set instanceID if server info does not contain it', async () => {
      const client = asInternal(
        new RPClient({
          apiKey: 'startLaunchTest',
          endpoint: 'https://rp.us/api/v1',
          project: 'tst',
        }),
      );
      jest.spyOn(client, 'fetchServerInfo').mockResolvedValue({});
      jest.spyOn(client.statistics, 'trackEvent').mockImplementation();
      jest.spyOn(client.statistics, 'setInstanceID');

      await client.triggerStatisticsEvent();

      expect(client.statistics.setInstanceID).not.toHaveBeenCalled();
      expect(client.statistics.trackEvent).toHaveBeenCalled();
    });
  });

  describe('getServerInfoUrl', () => {
    it('should return correct info URL for v1 endpoint', () => {
      const client = new RPClient({
        apiKey: 'test',
        project: 'test',
        endpoint: 'https://rp.us/api/v1',
      });

      expect(client.getServerInfoUrl()).toBe('https://rp.us/api/info');
    });

    it('should return correct info URL for v2 endpoint', () => {
      const client = new RPClient({
        apiKey: 'test',
        project: 'test',
        endpoint: 'https://rp.us/api/v2',
      });

      expect(client.getServerInfoUrl()).toBe('https://rp.us/api/info');
    });
  });

  describe('fetchServerInfo', () => {
    it('should call restClient.request with correct URL', async () => {
      const client = asInternal(
        new RPClient({
          apiKey: 'test',
          project: 'test',
          endpoint: 'https://rp.us/api/v1',
        }),
      );
      const serverInfo = { extensions: { result: {} } };
      jest.spyOn(client.restClient, 'request').mockResolvedValue(serverInfo);

      const result = await client.fetchServerInfo();

      expect(client.restClient.request).toHaveBeenCalledWith('GET', 'https://rp.us/api/info', {});
      expect(result).toEqual(serverInfo);
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
      const client = asInternal(
        new RPClient({
          apiKey: 'startLaunchTest',
          endpoint: 'https://rp.us/api/v1',
          project: 'tst',
        }),
      );
      const myPromise = Promise.resolve({ id: 'testidlaunch' });
      const time = 12345734;
      jest.spyOn(client.restClient, 'create').mockReturnValue(myPromise);
      jest.spyOn(helpers, 'getSystemAttributes').mockReturnValue(fakeSystemAttr);

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
      const client = asInternal(
        new RPClient({
          apiKey: 'startLaunchTest',
          endpoint: 'https://rp.us/api/v1',
          project: 'tst',
        }),
      );
      const myPromise = Promise.resolve({ id: 'testidlaunch' });
      const time = 12345734;
      jest.spyOn(client.restClient, 'create').mockReturnValue(myPromise);
      jest.spyOn(helpers, 'getSystemAttributes').mockReturnValue(fakeSystemAttr);

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
      const client = asInternal(
        new RPClient({
          apiKey: 'startLaunchTest',
          endpoint: 'https://rp.us/api/v1',
          project: 'tst',
        }),
      );
      const myPromise = Promise.resolve({ id: 'testidlaunch' });
      const startTime = 12345734;
      const id = 12345734;
      jest.spyOn(client.restClient, 'create').mockReturnValue(myPromise);

      // The original test passes a numeric `id`, while the API type declares it as a string.
      client.startLaunch({
        startTime,
        id,
      } as unknown as StartLaunchOptions);

      expect(client.restClient.create).not.toHaveBeenCalled();
      expect(client.launchUuid).toEqual(id);
    });

    it('should log Launch UUID if enabled', () => {
      jest.spyOn(OUTPUT_TYPES, 'STDOUT').mockImplementation();
      const client = asInternal(
        new RPClient({
          apiKey: 'startLaunchTest',
          endpoint: 'https://rp.us/api/v1',
          project: 'tst',
          launchUuidPrint: true,
        }),
      );
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
      const client = asInternal(
        new RPClient({
          apiKey: 'startLaunchTest',
          endpoint: 'https://rp.us/api/v1',
          project: 'tst',
          launchUuidPrint: true,
          // The original test uses a lowercase value; the config normalizes it to upper case.
          launchUuidPrintOutput: 'stderr',
        } as unknown as ConstructorParameters<typeof RPClient>[0]),
      );
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
      const client = asInternal(
        new RPClient({
          apiKey: 'startLaunchTest',
          endpoint: 'https://rp.us/api/v1',
          project: 'tst',
          launchUuidPrint: true,
          // Intentionally invalid output type - the client must fall back to STDOUT.
          launchUuidPrintOutput: 'asdfgh',
        } as unknown as ConstructorParameters<typeof RPClient>[0]),
      );
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
      const client = asInternal(
        new RPClient({
          apiKey: 'startLaunchTest',
          endpoint: 'https://rp.us/api/v1',
          project: 'tst',
          launchUuidPrint: true,
          launchUuidPrintOutput: 'environment',
        } as unknown as ConstructorParameters<typeof RPClient>[0]),
      );
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
      const client = asInternal(
        new RPClient({
          apiKey: 'startLaunchTest',
          endpoint: 'https://rp.us/api/v1',
          project: 'tst',
          launchUuidPrint: true,
          launchUuidPrintOutput: 'file',
        } as unknown as ConstructorParameters<typeof RPClient>[0]),
      );
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
      const client = asInternal(
        new RPClient({
          apiKey: 'startLaunchTest',
          endpoint: 'https://rp.us/api/v1',
          project: 'tst',
        }),
      );
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
      const client = asInternal(
        new RPClient({ apiKey: 'any', endpoint: 'https://rp.api', project: 'prj' }),
      );
      client.map = asMap({
        id1: {
          children: ['child1'],
        },
      });
      jest.spyOn(client, 'getRejectAnswer').mockImplementation();

      client.finishLaunch('id2', { some: 'data' } as unknown as FinishLaunchOptions);

      expect(client.getRejectAnswer).toHaveBeenCalledWith(
        'id2',
        new Error('Launch with tempId "id2" not found'),
      );
    });

    it('should trigger promiseFinish', async () => {
      const client = asInternal(
        new RPClient({ apiKey: 'any', endpoint: 'https://rp.api', project: 'prj' }),
      );
      client.map = asMap({
        id1: {
          children: ['child1'],
          promiseStart: Promise.resolve(),
          resolveFinish: jest.fn().mockResolvedValue(undefined),
        },
        child1: {
          promiseFinish: jest.fn().mockResolvedValue(undefined),
        },
      });

      jest.spyOn(client.restClient, 'update').mockResolvedValue({ link: 'link' });

      await client.finishLaunch('id1', { some: 'data' } as unknown as FinishLaunchOptions).promise;

      // `promiseFinish` is a jest mock here, not a promise - the original test calls it.
      const child1PromiseFinish = client.map.child1.promiseFinish as unknown as jest.Mock;
      expect(child1PromiseFinish().then).toBeDefined();
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
      const client = asInternal(
        new RPClient({
          apiKey: 'test',
          project: 'test',
          endpoint: 'https://abc.com',
          attributes: [{ value: 'value' }],
        }),
      );
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
      const client = asInternal(
        new RPClient({
          apiKey: 'test',
          project: 'test',
          endpoint: 'https://abc.com',
          launch: 'launch',
          attributes: [{ value: 'value' }],
        }),
      );
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
      const client = asInternal(
        new RPClient({
          apiKey: 'startLaunchTest',
          endpoint: 'https://rp.us/api/v1',
          project: 'tst',
          isLaunchMergeRequired: true,
        }),
      );

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

      expect(promise!.then).toBeDefined();
      await promise;
      expect(client.restClient.create).toHaveBeenCalledWith('launch/merge', fakeMergeDataRQ);
    });

    it('should not call rest client if something went wrong', async () => {
      const client = asInternal(
        new RPClient({
          apiKey: 'startLaunchTest',
          endpoint: 'https://rp.us/api/v1',
          project: 'tst',
          isLaunchMergeRequired: true,
        }),
      );

      // The original test returns a bare string instead of the declared string[].
      jest
        .spyOn(client.helpers, 'readLaunchesFromFile')
        .mockReturnValue('launchUUid' as unknown as string[]);
      jest.spyOn(client.restClient, 'retrieveSyncAPI').mockResolvedValue(undefined);
      jest.spyOn(client.restClient, 'create').mockRejectedValue(undefined);
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
      const client = asInternal(
        new RPClient({
          apiKey: 'startLaunchTest',
          endpoint: 'https://rp.us/api/v1',
          project: 'tst',
        }),
      );
      client.map = asMap({
        id1: {
          children: ['child1'],
        },
        child1: {
          promiseFinish: Promise.resolve(),
        },
      });

      const promise = client.getPromiseFinishAllItems('id1');

      expect(promise).toBeInstanceOf(Promise);
      done();
    });
  });

  describe('updateLaunch', () => {
    it('should call getRejectAnswer if there is no launchTempId with suitable launchTempId', () => {
      const client = asInternal(
        new RPClient({
          apiKey: 'startLaunchTest',
          endpoint: 'https://rp.us/api/v1',
          project: 'tst',
        }),
      );
      client.map = asMap({
        id1: {
          children: ['child1'],
        },
      });
      jest.spyOn(client, 'getRejectAnswer').mockImplementation();

      client.updateLaunch('id2', { some: 'data' } as unknown as UpdateLaunchOptions);

      expect(client.getRejectAnswer).toHaveBeenCalledWith(
        'id2',
        new Error('Launch with tempId "id2" not found'),
      );
    });

    it('should return object with tempId and promise', () => {
      const client = asInternal(
        new RPClient({
          apiKey: 'startLaunchTest',
          endpoint: 'https://rp.us/api/v1',
          project: 'tst',
        }),
      );
      client.map = asMap({
        id1: {
          children: ['child1'],
          promiseFinish: Promise.resolve(),
        },
      });
      jest.spyOn(client.restClient, 'update').mockResolvedValue(undefined);

      const result = client.updateLaunch('id1', { some: 'data' } as unknown as UpdateLaunchOptions);

      expect(result.tempId).toEqual('id1');
      return expect(result.promise).resolves.toBeUndefined();
    });
  });

  describe('startTestItem', () => {
    it('should call getRejectAnswer if there is no launchTempId with suitable launchTempId', () => {
      const client = asInternal(
        new RPClient({
          apiKey: 'startLaunchTest',
          endpoint: 'https://rp.us/api/v1',
          project: 'tst',
        }),
      );
      client.map = asMap({
        id1: {
          children: ['child1'],
        },
      });
      jest.spyOn(client, 'getRejectAnswer').mockImplementation();

      client.startTestItem({} as unknown as StartTestItemOptions, 'id2');

      expect(client.getRejectAnswer).toHaveBeenCalledWith(
        'id2',
        new Error('Launch with tempId "id2" not found'),
      );
    });

    it('should call getRejectAnswer if launchObj.finishSend is true', () => {
      const client = asInternal(
        new RPClient({
          apiKey: 'startLaunchTest',
          endpoint: 'https://rp.us/api/v1',
          project: 'tst',
        }),
      );
      client.map = asMap({
        id1: {
          children: ['child1'],
          finishSend: true,
        },
      });
      jest.spyOn(client, 'getRejectAnswer').mockImplementation();
      const error = new Error(
        'Launch with tempId "id1" is already finished, you can not add an item to it',
      );

      client.startTestItem({} as unknown as StartTestItemOptions, 'id1');

      expect(client.getRejectAnswer).toHaveBeenCalledWith('id1', error);
    });

    it('should call getRejectAnswer if there is no parentObj with suitable parentTempId', () => {
      const client = asInternal(
        new RPClient({
          apiKey: 'startLaunchTest',
          endpoint: 'https://rp.us/api/v1',
          project: 'tst',
        }),
      );
      client.map = asMap({
        id: {
          children: ['id1'],
        },
        id1: {
          children: ['child1'],
        },
      });
      jest.spyOn(client, 'getRejectAnswer').mockImplementation();
      const error = new Error('Item with tempId "id3" not found');

      client.startTestItem(
        { testCaseId: 'testCaseId' } as unknown as StartTestItemOptions,
        'id1',
        'id3',
      );

      expect(client.getRejectAnswer).toHaveBeenCalledWith('id1', error);
    });

    it('should return object with tempId and promise', () => {
      const client = asInternal(
        new RPClient({
          apiKey: 'startLaunchTest',
          endpoint: 'https://rp.us/api/v1',
          project: 'tst',
        }),
      );
      client.map = asMap({
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
      });
      jest.spyOn(client.itemRetriesChainMap, 'get').mockResolvedValue(undefined);
      jest.spyOn(client.restClient, 'create').mockResolvedValue({});
      jest.spyOn(client, 'getUniqId').mockReturnValue('4n5pxq24kpiob12og9');

      const result = client.startTestItem(
        { retry: false } as unknown as StartTestItemOptions,
        'id1',
        'id',
      );

      expect(result.tempId).toEqual('4n5pxq24kpiob12og9');
      return expect(result.promise).resolves.toBeDefined();
    });

    it('should get previous try promise from itemRetriesChainMap if retry is true', async () => {
      const client = asInternal(
        new RPClient({
          apiKey: 'startLaunchTest',
          endpoint: 'https://rp.us/api/v1',
          project: 'tst',
        }),
      );
      client.map = asMap({
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
      });
      jest.spyOn(client, 'calculateItemRetriesChainMapKey').mockReturnValue('id1__name__');
      jest.spyOn(client, 'getUniqId').mockReturnValue('4n5pxq24kpiob12og9');
      jest.spyOn(client.itemRetriesChainMap, 'get').mockImplementation();
      jest.spyOn(client.restClient, 'create').mockResolvedValue({});

      await client.startTestItem({ retry: true } as unknown as StartTestItemOptions, 'id1').promise;

      expect(client.itemRetriesChainMap.get).toHaveBeenCalledWith('id1__name__');
    });

    it('should include retry_of with the previous item UUID when retry is true', async () => {
      const client = asInternal(
        new RPClient({
          apiKey: 'test',
          endpoint: 'https://rp.us/api/v1',
          project: 'tst',
        }),
      );
      const prevRealId = 'prev-item-uuid-1234';
      const prevPromise = Promise.resolve({ id: prevRealId });

      client.map = asMap({
        launchId: {
          children: [],
          finishSend: false,
          promiseStart: Promise.resolve(),
        },
      });

      const itemKey = client.calculateItemRetriesChainMapKey(
        'launchId', undefined, 'My test', undefined,
      );
      client.itemRetriesChainMap.set(itemKey, prevPromise);

      jest.spyOn(client.restClient, 'create').mockResolvedValue({ id: 'new-item-uuid' });
      jest.spyOn(client, 'getUniqId').mockReturnValue('newTempId');

      await client.startTestItem(
        { name: 'My test', type: 'STEP', retry: true } as unknown as StartTestItemOptions,
        'launchId',
      ).promise;

      expect(client.restClient.create).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ retry_of: prevRealId }),
      );
    });

    it('should not include retry_of when retry is true but no previous entry exists', async () => {
      const client = asInternal(
        new RPClient({
          apiKey: 'test',
          endpoint: 'https://rp.us/api/v1',
          project: 'tst',
        }),
      );
      client.map = asMap({
        launchId: {
          children: [],
          finishSend: false,
          promiseStart: Promise.resolve(),
        },
      });
      jest.spyOn(client.restClient, 'create').mockResolvedValue({ id: 'new-item-uuid' });
      jest.spyOn(client, 'getUniqId').mockReturnValue('newTempId');

      await client.startTestItem(
        { name: 'My test', type: 'STEP', retry: true } as unknown as StartTestItemOptions,
        'launchId',
      ).promise;

      expect(client.restClient.create).toHaveBeenCalledWith(
        expect.any(String),
        expect.not.objectContaining({ retry_of: expect.anything() }),
      );
    });

    it('should not include retry_of when retry is false', async () => {
      const client = asInternal(
        new RPClient({
          apiKey: 'test',
          endpoint: 'https://rp.us/api/v1',
          project: 'tst',
        }),
      );
      const prevPromise = Promise.resolve({ id: 'prev-item-uuid-1234' });
      client.map = asMap({
        launchId: {
          children: [],
          finishSend: false,
          promiseStart: Promise.resolve(),
        },
      });
      const itemKey = client.calculateItemRetriesChainMapKey(
        'launchId', undefined, 'My test', undefined,
      );
      client.itemRetriesChainMap.set(itemKey, prevPromise);

      jest.spyOn(client.restClient, 'create').mockResolvedValue({ id: 'new-item-uuid' });
      jest.spyOn(client, 'getUniqId').mockReturnValue('newTempId');

      await client.startTestItem(
        { name: 'My test', type: 'STEP', retry: false } as unknown as StartTestItemOptions,
        'launchId',
      ).promise;

      expect(client.restClient.create).toHaveBeenCalledWith(
        expect.any(String),
        expect.not.objectContaining({ retry_of: expect.anything() }),
      );
    });
  });

  describe('finishTestItem', () => {
    it('should call getRejectAnswer if there is no itemObj with suitable itemTempId', () => {
      const client = asInternal(
        new RPClient({
          apiKey: 'startLaunchTest',
          endpoint: 'https://rp.us/api/v1',
          project: 'tst',
        }),
      );
      client.map = asMap({
        id1: {
          children: ['child1'],
        },
      });
      jest.spyOn(client, 'getRejectAnswer').mockImplementation();

      client.finishTestItem('id2', {});

      expect(client.getRejectAnswer).toHaveBeenCalledWith(
        'id2',
        new Error('Item with tempId "id2" not found'),
      );
    });

    it('should call finishTestItemPromiseStart with correct parameters', (done) => {
      const client = asInternal(
        new RPClient({
          apiKey: 'startLaunchTest',
          endpoint: 'https://rp.us/api/v1',
          project: 'tst',
        }),
      );
      client.map = asMap({
        id: {
          children: ['id1'],
          promiseFinish: Promise.resolve(),
        },
        id1: {
          children: ['child1'],
          promiseFinish: Promise.resolve(),
        },
      });
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
      const client = asInternal(
        new RPClient({
          apiKey: 'startLaunchTest',
          endpoint: 'https://rp.us/api/v1',
          project: 'tst',
        }),
      );
      client.map = asMap({
        id: {
          children: ['id1'],
          promiseFinish: Promise.resolve(),
        },
        id1: {
          children: ['child1'],
          promiseFinish: Promise.reject(),
        },
      });
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
  });

  it('should automatically add NOT_ISSUE when status is SKIPPED and skippedIsNotIssue is true', function (done) {
    const mockClient = asInternal(
      new RPClient(
        {
          apiKey: 'test',
          endpoint: 'https://reportportal-stub-url',
          launch: 'test launch',
          project: 'test project',
          skippedIsNotIssue: true,
        },
        { name: 'test', version: '1.0.0' },
      ),
    );

    const spyFinishTestItemPromiseStart = jest
      .spyOn(mockClient, 'finishTestItemPromiseStart')
      .mockImplementation(() => {});

    mockClient.map = asMap({
      testItemId: {
        children: [],
        finishSend: false,
        promiseFinish: Promise.resolve(),
        resolveFinish: () => {},
      },
    });

    // The original test uses the raw 'skipped' string rather than the STATUSES enum member.
    const finishTestItemRQ = {
      status: 'skipped',
    } as unknown as FinishTestItemOptions;

    mockClient.finishTestItem('testItemId', finishTestItemRQ);

    setTimeout(() => {
      try {
        expect(spyFinishTestItemPromiseStart).toHaveBeenCalledWith(
          expect.any(Object),
          'testItemId',
          expect.objectContaining({
            status: 'skipped',
            issue: { issueType: 'NOT_ISSUE' },
          }),
        );
        done();
      } catch (error) {
        done(error);
      }
    }, 50);
  });

  it('should not add NOT_ISSUE when status is SKIPPED and skippedIsNotIssue is false', function (done) {
    const mockClient = asInternal(
      new RPClient(
        {
          apiKey: 'test',
          endpoint: 'https://reportportal-stub-url',
          launch: 'test launch',
          project: 'test project',
          skippedIsNotIssue: false,
        },
        { name: 'test', version: '1.0.0' },
      ),
    );

    const spyFinishTestItemPromiseStart = jest
      .spyOn(mockClient, 'finishTestItemPromiseStart')
      .mockImplementation(() => {});

    mockClient.map = asMap({
      testItemId: {
        children: [],
        finishSend: false,
        promiseFinish: Promise.resolve(),
        resolveFinish: () => {},
      },
    });

    // The original test uses the raw 'skipped' string rather than the STATUSES enum member.
    const finishTestItemRQ = {
      status: 'skipped',
    } as unknown as FinishTestItemOptions;

    mockClient.finishTestItem('testItemId', finishTestItemRQ);

    setTimeout(() => {
      try {
        expect(spyFinishTestItemPromiseStart).toHaveBeenCalledWith(
          expect.any(Object),
          'testItemId',
          expect.objectContaining({
            status: 'skipped',
          }),
        );
        expect(spyFinishTestItemPromiseStart).not.toHaveBeenCalledWith(
          expect.any(Object),
          'testItemId',
          expect.objectContaining({
            issue: expect.anything(),
          }),
        );
        done();
      } catch (error) {
        done(error);
      }
    }, 100);
  });

  describe('saveLog', () => {
    it('should return object with tempId and promise', () => {
      const client = asInternal(
        new RPClient({ apiKey: 'any', endpoint: 'https://rp.api', project: 'prj' }),
      );
      client.map = asMap({
        id1: {
          children: ['child1'],
        },
      });
      jest.spyOn(client, 'getUniqId').mockReturnValue('4n5pxq24kpiob12og9');
      jest.spyOn(client.restClient, 'create').mockResolvedValue(undefined);

      const result = client.saveLog(
        {
          promiseStart: Promise.resolve(),
          realId: 'realId',
          children: [],
        } as unknown as ItemObj,
        // The original test passes `restClient.create` directly; its signature differs from the
        // (itemUuid, launchUuid) request function saveLog expects, but it's mocked out anyway.
        client.restClient.create as unknown as RequestPromiseFunc,
      );

      expect(result.tempId).toEqual('4n5pxq24kpiob12og9');
      return expect(result.promise).resolves.toBeUndefined();
    });
  });

  describe('sendLog', () => {
    it('should return sendLogWithFile if fileObj is not empty', () => {
      const client = asInternal(
        new RPClient({ apiKey: 'any', endpoint: 'https://rp.api', project: 'prj' }),
      );
      jest
        .spyOn(client, 'sendLogWithFile')
        .mockReturnValue('sendLogWithFile' as unknown as ClientResponse);

      const result = client.sendLog(
        'itemTempId',
        { message: 'message' },
        { name: 'name' } as unknown as Attachment,
      );

      expect(result).toEqual('sendLogWithFile');
    });

    it('should return sendLogWithoutFile if fileObj is empty', () => {
      const client = asInternal(
        new RPClient({ apiKey: 'any', endpoint: 'https://rp.api', project: 'prj' }),
      );
      jest
        .spyOn(client, 'sendLogWithoutFile')
        .mockReturnValue('sendLogWithoutFile' as unknown as ClientResponse);

      const result = client.sendLog('itemTempId', { message: 'message' });

      expect(result).toEqual('sendLogWithoutFile');
    });
  });

  describe('sendLogWithoutFile', () => {
    it('should call getRejectAnswer if there is no itemObj with suitable itemTempId', () => {
      const client = asInternal(
        new RPClient({ apiKey: 'any', endpoint: 'https://rp.api', project: 'prj' }),
      );
      client.map = asMap({
        id1: {
          children: ['child1'],
        },
      });
      jest.spyOn(client, 'getRejectAnswer').mockImplementation();

      client.sendLogWithoutFile('itemTempId', {});

      expect(client.getRejectAnswer).toHaveBeenCalledWith(
        'itemTempId',
        new Error('Item with tempId "itemTempId" not found'),
      );
    });

    it('should return saveLog function', () => {
      const client = asInternal(
        new RPClient({ apiKey: 'any', endpoint: 'https://rp.api', project: 'prj' }),
      );
      client.map = asMap({
        itemTempId: {
          children: ['child1'],
        },
      });
      jest.spyOn(client, 'saveLog').mockReturnValue('saveLog' as unknown as ClientResponse);

      const result = client.sendLogWithoutFile('itemTempId', {});

      expect(result).toEqual('saveLog');
    });
  });

  describe('sendLogWithFile', () => {
    it('should call getRejectAnswer if there is no itemObj with suitable itemTempId', () => {
      const client = asInternal(
        new RPClient({ apiKey: 'any', endpoint: 'https://rp.api', project: 'prj' }),
      );
      client.map = asMap({
        id1: {
          children: ['child1'],
        },
      });
      jest.spyOn(client, 'getRejectAnswer').mockImplementation();

      // The original test calls this without the (required) fileObj argument.
      client.sendLogWithFile('itemTempId', {});

      expect(client.getRejectAnswer).toHaveBeenCalledWith(
        'itemTempId',
        new Error('Item with tempId "itemTempId" not found'),
      );
    });

    it('should return saveLog function', () => {
      const client = asInternal(
        new RPClient({ apiKey: 'any', endpoint: 'https://rp.api', project: 'prj' }),
      );
      client.map = asMap({
        itemTempId: {
          children: ['child1'],
        },
      });
      jest.spyOn(client, 'saveLog').mockReturnValue('saveLog' as unknown as ClientResponse);

      const result = client.sendLogWithFile('itemTempId', {});

      expect(result).toEqual('saveLog');
    });
  });

  describe('getRequestLogWithFile', () => {
    it('should return restClient.create', () => {
      const client = asInternal(
        new RPClient({ apiKey: 'any', endpoint: 'https://rp.api', project: 'prj' }),
      );
      client.map = asMap({
        id1: {
          children: ['child1'],
        },
      });
      jest
        .spyOn(client, 'buildMultiPartStream')
        .mockReturnValue(undefined as unknown as Buffer);
      jest.spyOn(client.restClient, 'create').mockResolvedValue('value');

      const result = client.getRequestLogWithFile({}, { name: 'name' } as unknown as Attachment);

      return expect(result).resolves.toBe('value');
    });

    it('should return restClient.create with error', () => {
      const client = asInternal(
        new RPClient({ apiKey: 'any', endpoint: 'https://rp.api', project: 'prj' }),
      );
      client.map = asMap({
        id1: {
          children: ['child1'],
        },
      });
      jest
        .spyOn(client, 'buildMultiPartStream')
        .mockReturnValue(undefined as unknown as Buffer);
      jest.spyOn(client.restClient, 'create').mockRejectedValue(undefined);

      const result = client.getRequestLogWithFile({}, { name: 'name' } as unknown as Attachment);

      expect(result.catch).toBeDefined();
    });
  });
});
