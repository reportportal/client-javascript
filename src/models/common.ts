export interface Attribute {
  value: string;
  key?: string;
  system?: boolean;
}

export interface ExternalSystemIssue {
  submitDate?: number;
  submitter?: string;
  systemId?: string;
  ticketId?: string;
  url?: string;
}

export interface Issue {
  issueType: string;
  comment?: string;
  externalSystemIssues?: ExternalSystemIssue[];
}

export interface Attachment {
  name: string;
  type: string;
  content: string | Buffer;
}

/**
 * The wrapper returned by every start/finish/send method: a temporary id used to
 * reference the item in subsequent calls, and a promise resolved with the server response.
 */
export interface ClientResponse<T = unknown> {
  tempId: string;
  promise: Promise<T>;
}

export interface AgentParams {
  name?: string;
  version?: string;
  framework_version?: string;
}
