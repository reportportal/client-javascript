import axios, { AxiosResponse } from 'axios';
import Statistics from '../src/statistics/statistics';
import { MEASUREMENT_ID, API_KEY } from '../src/statistics/constants';
import type { AgentParams } from '../src/models/common';

const uuidv4Validation = /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i;

const agentParams: AgentParams = {
  name: 'AgentName',
  version: 'AgentVersion',
};

const eventName = 'start_launch';

const url = `https://www.google-analytics.com/mp/collect?measurement_id=${MEASUREMENT_ID}&api_secret=${API_KEY}`;
const baseParamsValidationObject = {
  interpreter: expect.stringMatching(/Node\.js \d{2}\.\d+\.\d+/),
  client_name: '@reportportal/client-javascript',
  client_version: expect.stringMatching(/\d+\.\d+\.\d+/),
};
const agentParamsValidationObject = {
  ...baseParamsValidationObject,
  agent_name: agentParams.name,
  agent_version: agentParams.version,
};
const baseParamsValidation = expect.objectContaining(baseParamsValidationObject);
const agentParamsValidation = expect.objectContaining(agentParamsValidationObject);
const baseEventValidationObject = {
  name: eventName,
  params: baseParamsValidation,
};
const agentEventValidationObject = {
  name: eventName,
  params: agentParamsValidation,
};
const baseRequestValidationObject = {
  client_id: expect.stringMatching(uuidv4Validation),
  events: expect.arrayContaining([expect.objectContaining(baseEventValidationObject)]),
};
const baseRequestValidation = expect.objectContaining(baseRequestValidationObject);
const agentRequestValidation = expect.objectContaining({
  ...baseRequestValidationObject,
  events: expect.arrayContaining([expect.objectContaining(agentEventValidationObject)]),
});

// The client doesn't do anything with the resolved response, it just awaits it not throwing -
// so a minimal stand-in cast to AxiosResponse is enough to satisfy the mock's return type.
const fakeAxiosResponse = { send: () => {} } as unknown as AxiosResponse;

describe('Statistics', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should send proper event to axios', async () => {
    const postSpy = jest.spyOn(axios, 'post').mockResolvedValue(fakeAxiosResponse);

    const statistics = new Statistics(eventName, agentParams);
    await statistics.trackEvent();

    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(postSpy).toHaveBeenCalledWith(url, agentRequestValidation);
  });

  (
    [undefined, {}, { name: null, version: null }] as unknown as (AgentParams | undefined)[]
  ).forEach((params) => {
    it(`should not fail if agent params: ${JSON.stringify(params)}`, async () => {
      const postSpy = jest.spyOn(axios, 'post').mockResolvedValue(fakeAxiosResponse);

      const statistics = new Statistics(eventName, params);
      await statistics.trackEvent();

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(url, baseRequestValidation);
    });

    it('Should properly handle errors if any', async () => {
      const statistics = new Statistics(eventName, agentParams);
      const errorMessage = 'Error message';

      jest.spyOn(axios, 'post').mockRejectedValue(new Error(errorMessage));
      jest.spyOn(console, 'error').mockImplementation();

      await statistics.trackEvent();

      expect(console.error).toHaveBeenCalledWith(errorMessage);
    });
  });

  describe('setInstanceID', () => {
    it('should set instanceID in event params', async () => {
      const postSpy = jest.spyOn(axios, 'post').mockResolvedValue(fakeAxiosResponse);

      const statistics = new Statistics(eventName, agentParams);
      statistics.setInstanceID('test-instance-id');
      await statistics.trackEvent();

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        url,
        expect.objectContaining({
          events: expect.arrayContaining([
            expect.objectContaining({
              params: expect.objectContaining({
                instanceID: 'test-instance-id',
              }),
            }),
          ]),
        }),
      );
    });

    it('should not include instanceID if setInstanceID was not called', async () => {
      const postSpy = jest.spyOn(axios, 'post').mockResolvedValue(fakeAxiosResponse);

      const statistics = new Statistics(eventName, agentParams);
      await statistics.trackEvent();

      expect(postSpy).toHaveBeenCalledTimes(1);
      const callArgs = postSpy.mock.calls[0][1] as { events: { params: Record<string, unknown> }[] };
      expect(callArgs.events[0].params).not.toHaveProperty('instanceID');
    });
  });
});
