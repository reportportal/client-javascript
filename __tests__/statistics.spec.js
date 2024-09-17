const axios = require('axios');
const Statistics = require('../statistics/statistics');
const { MEASUREMENT_ID, API_KEY } = require('../statistics/constants');

const uuidv4Validation = /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i;

const agentParams = {
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

describe('Statistics', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should send proper event to axios', async () => {
    jest.spyOn(axios, 'post').mockReturnValue({
      send: () => {}, // eslint-disable-line
    });

    const statistics = new Statistics(eventName, agentParams);
    await statistics.trackEvent();

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledWith(url, agentRequestValidation);
  });

  [
    undefined,
    {},
    {
      name: null,
      version: null,
    },
  ].forEach((params) => {
    it(`should not fail if agent params: ${JSON.stringify(params)}`, async () => {
      jest.spyOn(axios, 'post').mockReturnValue({
        send: () => {}, // eslint-disable-line
      });

      const statistics = new Statistics(eventName, params);
      await statistics.trackEvent();

      expect(axios.post).toHaveBeenCalledTimes(1);
      expect(axios.post).toHaveBeenCalledWith(url, baseRequestValidation);
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
});
