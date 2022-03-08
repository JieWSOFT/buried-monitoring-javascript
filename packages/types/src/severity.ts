/**
 * TODO(v7): Remove this enum and replace with SeverityLevel
 */
export enum Severity {
  /** JSDoc */
  Fatal = 'fatal',
  /** JSDoc */
  Error = 'error',
  /** JSDoc */
  Warning = 'warning',
  /** JSDoc */
  Log = 'log',
  /** JSDoc */
  Info = 'info',
  /** JSDoc */
  Debug = 'debug',
  /** JSDoc */
  Critical = 'critical',
}

export const SeverityLevels = ['fatal', 'error', 'warning', 'log', 'info', 'debug', 'critical'] as const;
export type SeverityLevel = typeof SeverityLevels[number];
