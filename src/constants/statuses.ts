export enum STATUSES {
  PASSED = 'passed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  STOPPED = 'stopped',
  INTERRUPTED = 'interrupted',
  CANCELLED = 'cancelled',
  INFO = 'info',
  WARN = 'warn',
}

/**
 * @deprecated Use the `STATUSES` enum instead.
 */
export const RP_STATUSES = STATUSES;
