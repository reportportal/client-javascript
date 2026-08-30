export enum PREDEFINED_LOG_LEVELS {
  TRACE = 'TRACE',
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  FATAL = 'FATAL',
}

export type LOG_LEVELS = PREDEFINED_LOG_LEVELS | string;
