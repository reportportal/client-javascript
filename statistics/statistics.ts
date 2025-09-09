import axios from 'axios';
import { MEASUREMENT_ID, API_KEY, PJSON_NAME, PJSON_VERSION, INTERPRETER } from './constants';
import { getClientId } from './client-id';

interface AgentParams {
  name?: string;
  version?: string;
}

const hasOption = (options: any, optionName: string): boolean => {
  return Object.prototype.hasOwnProperty.call(options, optionName);
};

export class Statistics {
  public eventName: string;

  public eventParams: Record<string, string>;

  constructor(eventName: string, agentParams?: AgentParams) {
    this.eventName = eventName;
    this.eventParams = this.getEventParams(agentParams);
  }

  private getEventParams(agentParams?: AgentParams): Record<string, string> {
    const params: Record<string, string> = {
      interpreter: INTERPRETER || '',
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
    } catch (error) {
      console.error((error as Error).message);
    }
  }
}
