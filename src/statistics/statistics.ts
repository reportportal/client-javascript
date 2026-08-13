import axios from 'axios';
import { MEASUREMENT_ID, API_KEY, PJSON_NAME, PJSON_VERSION, INTERPRETER } from './constants';
import { getClientId } from './client-id';
import type { AgentParams } from '../lib/models/common';

interface EventParams {
  interpreter: string | null;
  client_name: string;
  client_version: string;
  agent_name?: string;
  agent_version?: string;
  framework_version?: string;
  instanceID?: string;
}

const hasOption = (options: AgentParams, optionName: keyof AgentParams): boolean => {
  return Object.prototype.hasOwnProperty.call(options, optionName);
};

class Statistics {
  private eventName: string;

  private eventParams: EventParams;

  constructor(eventName: string, agentParams?: AgentParams) {
    this.eventName = eventName;
    this.eventParams = this.getEventParams(agentParams);
  }

  getEventParams(agentParams?: AgentParams): EventParams {
    const params: EventParams = {
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
    if (
      agentParams &&
      hasOption(agentParams, 'framework_version') &&
      agentParams.framework_version
    ) {
      params.framework_version = agentParams.framework_version;
    }
    return params;
  }

  setInstanceID(instanceID: string): void {
    this.eventParams.instanceID = instanceID;
  }

  async trackEvent(): Promise<void> {
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
    } catch (error: unknown) {
      console.error(error instanceof Error ? error.message : String(error));
    }
  }
}

export = Statistics;
