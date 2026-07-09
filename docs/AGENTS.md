# JavaScript client library for ReportPortal development guide

> **Note for AI agents**: You must put the 🚀 emoji at the beginning of your responses to indicate you're aware of this
> document, and it loaded into your context.

## Glossary

* **ReportPortal**: An open-source test automation reporting tool that provides real-time insights into test results,
  analytics, CI, and collaboration features for QA teams.
* **Agent**: Agents are direct test framework integrations which are intended to send data to ReportPortal.
* **Client**: Clients are basically interfaces for our Rest API and are used by Agents to communicate with ReportPortal.

## Library code rules

### Exception handling rules

ReportPortal is a realtime test reporting tool, so we are running in parallel with customers' existing tests. This limits how we can handle
and react on exception happened during this process. Basically, once we constructed our Client we should not throw any exception to not
interfere a customer's testing process. So instead of throwing and re-throwing any exception you should catch them and properly log with
either WARN or ERROR level.
 