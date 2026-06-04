const RPClient = require('../lib/report-portal-client');

/**
 * Tests for EPMRPP-113709 — Introduce the `retryOf` property for JS agents.
 *
 * These tests cover the new behaviour added to `RPClient.startTestItem`:
 *   1. `itemRetriesChainMap` now stores `{ promiseStart, tempId }` (not the
 *      bare promise).
 *   2. When `retry: true` and a previous attempt with a known `realId`
 *      exists, the outgoing `restClient.create` payload contains
 *      `retryOf: <previousRealId>`.
 *   3. When `retry` is `false` / omitted, `retryOf` is NOT set.
 *   4. When the previous attempt's `realId` is empty, `retryOf` is NOT set.
 *
 * All test data is deterministic (fixed strings, fixed UUIDs, resolved
 * promises). No `Math.random`, no `Date.now`, no timers.
 */
describe('RPClient.startTestItem — retryOf (EPMRPP-113709)', () => {
  const makeClient = () =>
    new RPClient({
      apiKey: 'test-key',
      endpoint: 'https://rp.us/api/v1',
      project: 'tst',
    });

  /** Wire a client with the given map and stub restClient.create. */
  const seedClient = (client, { mapOverrides = {}, createResponse = { id: 'new-uuid' } } = {}) => {
    client.map = {
      launchTemp: {
        children: ['parentTemp'],
        promiseStart: Promise.resolve(),
        realId: 'launch-real-id',
      },
      parentTemp: {
        children: [],
        promiseStart: Promise.resolve(),
        realId: 'parent-real-id',
      },
      ...mapOverrides,
    };
    client.launchUuid = 'launch-real-id';
    jest.spyOn(client.restClient, 'create').mockResolvedValue(createResponse);
    return client;
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('itemRetriesChainMap value shape', () => {
    it('stores an object with promiseStart and tempId for the new attempt', () => {
      const client = makeClient();
      seedClient(client);
      jest.spyOn(client, 'getUniqId').mockReturnValue('new-temp-id');
      jest
        .spyOn(client, 'calculateItemRetriesChainMapKey')
        .mockReturnValue('launchTemp__parentTemp__case-1__');

      client.startTestItem(
        { name: 'case-1', type: 'STEP', startTime: 1700000000000 },
        'launchTemp',
        'parentTemp',
      );

      const entry = client.itemRetriesChainMap.get('launchTemp__parentTemp__case-1__');
      expect(entry).toBeDefined();
      expect(entry.tempId).toBe('new-temp-id');
      // promiseStart should be a thenable (Promise) — not the bare value.
      expect(entry.promiseStart).toBeDefined();
      expect(typeof entry.promiseStart.then).toBe('function');
      // And it should reference the same promise we stored on the item map.
      expect(entry.promiseStart).toBe(client.map['new-temp-id'].promiseStart);
    });

    it('keeps the itemRetriesChainKeyMapByTempId mapping intact', () => {
      const client = makeClient();
      seedClient(client);
      jest.spyOn(client, 'getUniqId').mockReturnValue('new-temp-id');
      jest
        .spyOn(client, 'calculateItemRetriesChainMapKey')
        .mockReturnValue('launchTemp__parentTemp__case-1__');

      client.startTestItem(
        { name: 'case-1', type: 'STEP', startTime: 1700000000000 },
        'launchTemp',
        'parentTemp',
      );

      expect(client.itemRetriesChainKeyMapByTempId.get('new-temp-id')).toBe(
        'launchTemp__parentTemp__case-1__',
      );
    });
  });

  describe('retry: true', () => {
    it('passes the previous item realId as retryOf in restClient.create payload', async () => {
      const client = makeClient();
      seedClient(client, {
        mapOverrides: {
          prevTemp: {
            children: [],
            promiseStart: Promise.resolve(),
            realId: 'prev-real-uuid',
          },
        },
      });
      jest.spyOn(client, 'getUniqId').mockReturnValue('retry-temp-id');
      jest
        .spyOn(client, 'calculateItemRetriesChainMapKey')
        .mockReturnValue('launchTemp__parentTemp__case-1__');
      // Pre-seed the chain map as if the previous attempt has run.
      client.itemRetriesChainMap.set('launchTemp__parentTemp__case-1__', {
        promiseStart: Promise.resolve(),
        tempId: 'prevTemp',
      });

      await client.startTestItem(
        { name: 'case-1', type: 'STEP', retry: true, startTime: 1700000000000 },
        'launchTemp',
        'parentTemp',
      ).promise;

      expect(client.restClient.create).toHaveBeenCalledTimes(1);
      const [url, payload] = client.restClient.create.mock.calls[0];
      expect(url).toBe('item/parent-real-id');
      expect(payload).toMatchObject({
        name: 'case-1',
        type: 'STEP',
        retry: true,
        retryOf: 'prev-real-uuid',
        launchUuid: 'launch-real-id',
      });
    });

    it('omits retryOf when the previous attempts realId is empty', async () => {
      const client = makeClient();
      seedClient(client, {
        mapOverrides: {
          prevTemp: {
            children: [],
            promiseStart: Promise.resolve(),
            realId: '',
          },
        },
      });
      jest.spyOn(client, 'getUniqId').mockReturnValue('retry-temp-id');
      jest
        .spyOn(client, 'calculateItemRetriesChainMapKey')
        .mockReturnValue('launchTemp__parentTemp__case-1__');
      client.itemRetriesChainMap.set('launchTemp__parentTemp__case-1__', {
        promiseStart: Promise.resolve(),
        tempId: 'prevTemp',
      });

      await client.startTestItem(
        { name: 'case-1', type: 'STEP', retry: true, startTime: 1700000000000 },
        'launchTemp',
        'parentTemp',
      ).promise;

      expect(client.restClient.create).toHaveBeenCalledTimes(1);
      const payload = client.restClient.create.mock.calls[0][1];
      expect(payload.retry).toBe(true);
      expect(payload).not.toHaveProperty('retryOf');
    });

    it('omits retryOf when the previous attempts map entry is missing', async () => {
      const client = makeClient();
      seedClient(client);
      jest.spyOn(client, 'getUniqId').mockReturnValue('retry-temp-id');
      jest
        .spyOn(client, 'calculateItemRetriesChainMapKey')
        .mockReturnValue('launchTemp__parentTemp__case-1__');
      // Chain map points at a tempId that no longer exists in client.map.
      client.itemRetriesChainMap.set('launchTemp__parentTemp__case-1__', {
        promiseStart: Promise.resolve(),
        tempId: 'no-such-prev',
      });

      await client.startTestItem(
        { name: 'case-1', type: 'STEP', retry: true, startTime: 1700000000000 },
        'launchTemp',
        'parentTemp',
      ).promise;

      const payload = client.restClient.create.mock.calls[0][1];
      expect(payload).not.toHaveProperty('retryOf');
    });

    it('awaits the previous attempts promiseStart before firing the retry create', async () => {
      const client = makeClient();
      let resolvePrev;
      const prevPromise = new Promise((resolve) => {
        resolvePrev = resolve;
      });
      seedClient(client, {
        mapOverrides: {
          prevTemp: {
            children: [],
            promiseStart: prevPromise,
            realId: 'prev-real-uuid',
          },
        },
      });
      jest.spyOn(client, 'getUniqId').mockReturnValue('retry-temp-id');
      jest
        .spyOn(client, 'calculateItemRetriesChainMapKey')
        .mockReturnValue('launchTemp__parentTemp__case-1__');
      client.itemRetriesChainMap.set('launchTemp__parentTemp__case-1__', {
        promiseStart: prevPromise,
        tempId: 'prevTemp',
      });

      const { promise } = client.startTestItem(
        { name: 'case-1', type: 'STEP', retry: true, startTime: 1700000000000 },
        'launchTemp',
        'parentTemp',
      );

      // Give the microtask queue a chance to run; create must NOT fire yet
      // because the previous attempts promiseStart is still pending.
      await Promise.resolve();
      await Promise.resolve();
      expect(client.restClient.create).not.toHaveBeenCalled();

      resolvePrev();
      await promise;

      expect(client.restClient.create).toHaveBeenCalledTimes(1);
      const payload = client.restClient.create.mock.calls[0][1];
      expect(payload.retryOf).toBe('prev-real-uuid');
    });
  });

  describe('retry: false / omitted', () => {
    it('does not add retryOf when retry is false', async () => {
      const client = makeClient();
      seedClient(client);
      jest.spyOn(client, 'getUniqId').mockReturnValue('new-temp-id');
      jest
        .spyOn(client, 'calculateItemRetriesChainMapKey')
        .mockReturnValue('launchTemp__parentTemp__case-1__');

      await client.startTestItem(
        { name: 'case-1', type: 'STEP', retry: false, startTime: 1700000000000 },
        'launchTemp',
        'parentTemp',
      ).promise;

      const payload = client.restClient.create.mock.calls[0][1];
      expect(payload).not.toHaveProperty('retryOf');
    });

    it('does not add retryOf when retry is omitted', async () => {
      const client = makeClient();
      seedClient(client);
      jest.spyOn(client, 'getUniqId').mockReturnValue('new-temp-id');
      jest
        .spyOn(client, 'calculateItemRetriesChainMapKey')
        .mockReturnValue('launchTemp__parentTemp__case-1__');

      await client.startTestItem(
        { name: 'case-1', type: 'STEP', startTime: 1700000000000 },
        'launchTemp',
        'parentTemp',
      ).promise;

      const payload = client.restClient.create.mock.calls[0][1];
      expect(payload).not.toHaveProperty('retryOf');
    });

    it('does not call itemRetriesChainMap.get when retry is false', () => {
      const client = makeClient();
      seedClient(client);
      jest.spyOn(client, 'getUniqId').mockReturnValue('new-temp-id');
      jest
        .spyOn(client, 'calculateItemRetriesChainMapKey')
        .mockReturnValue('launchTemp__parentTemp__case-1__');
      const getSpy = jest.spyOn(client.itemRetriesChainMap, 'get');

      client.startTestItem(
        { name: 'case-1', type: 'STEP', retry: false, startTime: 1700000000000 },
        'launchTemp',
        'parentTemp',
      );

      // Short-circuit: `retry && map.get(...)` should never invoke get().
      expect(getSpy).not.toHaveBeenCalled();
    });
  });

  describe('cleanItemRetriesChain interplay', () => {
    it('removes the new-shape entry from the chain map on cleanup', () => {
      const client = makeClient();
      seedClient(client);
      jest.spyOn(client, 'getUniqId').mockReturnValue('new-temp-id');
      jest
        .spyOn(client, 'calculateItemRetriesChainMapKey')
        .mockReturnValue('launchTemp__parentTemp__case-1__');

      client.startTestItem(
        { name: 'case-1', type: 'STEP', startTime: 1700000000000 },
        'launchTemp',
        'parentTemp',
      );

      expect(client.itemRetriesChainMap.has('launchTemp__parentTemp__case-1__')).toBe(true);
      expect(client.itemRetriesChainKeyMapByTempId.has('new-temp-id')).toBe(true);

      client.cleanItemRetriesChain(['new-temp-id']);

      expect(client.itemRetriesChainMap.has('launchTemp__parentTemp__case-1__')).toBe(false);
      expect(client.itemRetriesChainKeyMapByTempId.has('new-temp-id')).toBe(false);
    });
  });
});
