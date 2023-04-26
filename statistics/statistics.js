const axios = require('axios');
const { MEASUREMENT_ID, API_KEY, PJSON_NAME, PJSON_VERSION, INTERPRETER } = require('./constants');
const { getClientId } = require('./client-id');

class Statistics {
  constructor(eventName, agentParams) {
    this.eventName = eventName;
    this.eventParams = this.getEventParams(agentParams);
  }

  getEventParams(agentParams) {
    const params = {
      interpreter: INTERPRETER,
      client_name: PJSON_NAME,
      client_version: PJSON_VERSION,
    };
    if (
      agentParams &&
      Object.prototype.hasOwnProperty.call(agentParams, 'name') &&
      agentParams.name
    ) {
      params.agent_name = agentParams.name;
    }
    if (agentParams && Object.hasOwn(agentParams, 'version') && agentParams.version) {
      params.agent_version = agentParams.version;
    }
    return params;
  }

  async trackEvent() {
    const requestBody = {
      client_id: await getClientId(),
      events: [
        {
          name: this.eventName,
          params: this.eventParams,
        },
      ],
    };

    await axios.post(
      `https://www.google-analytics.com/mp/collect?measurement_id=${MEASUREMENT_ID}&api_secret=${API_KEY}`,
      requestBody,
    );
  }
}

module.exports = Statistics;
