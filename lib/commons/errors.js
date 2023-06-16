class ReportPortalError extends Error {
  constructor(message) {
    const basicMessage = `\nReportPortal client error: ${message}`;
    super(basicMessage);
    this.name = 'ReportPortalError';
  }
}

class ReportPortalValidationError extends ReportPortalError {
  constructor(message) {
    const basicMessage = `\nValidation failed. Please, check the specified parameters: ${message}`;
    super(basicMessage);
    this.name = 'ReportPortalValidationError';
  }
}

class ReportPortalRequiredOptionError extends ReportPortalValidationError {
  constructor(propertyName) {
    const basicMessage = `\nProperty '${propertyName}' must not be empty.`;
    super(basicMessage);
    this.name = 'ReportPortalRequiredOptionError';
  }
}

module.exports = {
  ReportPortalError,
  ReportPortalValidationError,
  ReportPortalRequiredOptionError,
};
