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
  interpreter: jasmine.stringMatching(/Node\.js \d{2}\.\d+\.\d+/),
  client_name: '@reportportal/client-javascript',
  client_version: jasmine.stringMatching(/\d+\.\d+\.\d+/),
};
const agentParamsValidationObject = {
  ...baseParamsValidationObject,
  agent_name: agentParams.name,
  agent_version: agentParams.version,
};
const baseParamsValidation = jasmine.objectContaining(baseParamsValidationObject);
const agentParamsValidation = jasmine.objectContaining(agentParamsValidationObject);
const baseEventValidationObject = {
  name: eventName,
  params: baseParamsValidation,
};
const agentEventValidationObject = {
  name: eventName,
  params: agentParamsValidation,
};
const baseRequestValidationObject = {
  client_id: jasmine.stringMatching(uuidv4Validation),
  events: jasmine.arrayContaining([jasmine.objectContaining(baseEventValidationObject)]),
};
const baseRequestValidation = jasmine.objectContaining(baseRequestValidationObject);
const agentRequestValidation = jasmine.objectContaining({
  ...baseRequestValidationObject,
  events: jasmine.arrayContaining([jasmine.objectContaining(agentEventValidationObject)]),
});

describe('Statistics', () => {
  it('should send proper event to axios', async () => {
    spyOn(axios, 'post').and.returnValue({
      send: () => {}, // eslint-disable-line
    });

    const statistics = new Statistics(eventName, agentParams);
    await statistics.trackEvent();

    expect(axios.post).toHaveBeenCalledOnceWith(url, agentRequestValidation);
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
      spyOn(axios, 'post').and.returnValue({
        send: () => {}, // eslint-disable-line
      });

      const statistics = new Statistics(eventName, params);
      await statistics.trackEvent();

      expect(axios.post).toHaveBeenCalledOnceWith(url, baseRequestValidation);
    });
  });
});
