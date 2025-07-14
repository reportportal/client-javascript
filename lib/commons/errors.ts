export class ReportPortalError extends Error {
  constructor(message: string) {
    const basicMessage = `\nReportPortal client error: ${message}`;
    super(basicMessage);
    this.name = 'ReportPortalError';
  }
}

export class ReportPortalValidationError extends ReportPortalError {
  constructor(message: string) {
    const basicMessage = `\nValidation failed. Please, check the specified parameters: ${message}`;
    super(basicMessage);
    this.name = 'ReportPortalValidationError';
  }
}

export class ReportPortalRequiredOptionError extends ReportPortalValidationError {
  constructor(propertyName: string) {
    const basicMessage = `\nProperty '${propertyName}' must not be empty.`;
    super(basicMessage);
    this.name = 'ReportPortalRequiredOptionError';
  }
}
