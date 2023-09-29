const axios = require('axios');
const { MEASUREMENT_ID, API_KEY, PJSON_NAME, PJSON_VERSION, INTERPRETER } = require('./constants');
const { getClientId } = require('./client-id');

const hasOption = (options, optionName) => {
  return Object.prototype.hasOwnProperty.call(options, optionName);
};

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
    if (agentParams && hasOption(agentParams, 'name') && agentParams.name) {
      params.agent_name = agentParams.name;
    }
    if (agentParams && hasOption(agentParams, 'version') && agentParams.version) {
      params.agent_version = agentParams.version;
    }
    return params;
  }

  async trackEvent() {
    try {
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
    } catch (error) {
      console.error(error.message);
    }
  }
}

module.exports = Statistics;
