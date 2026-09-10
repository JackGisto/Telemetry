import type { HealthImportResult, HealthSource } from '@/types';

/**
 * Contract for anything that can supply the rider's body metrics.
 *
 * Same shape as `TelemetryTransport`: one interface, several implementations,
 * and the app never imports a concrete one directly. That matters here because
 * the only implementations that can read a phone's health app are native, and
 * this keeps the web build honest about it rather than faking the capability.
 */
export interface HealthProvider {
  readonly source: HealthSource;
  readonly label: string;
  /** Whether this provider can run in the current environment. */
  isAvailable(): boolean;
  /** Why it cannot run, for the UI to show instead of a dead button. */
  unavailableReason(): string | null;
  /** Ask the platform for permission. Manual entry needs none. */
  requestPermission(): Promise<boolean>;
  read(): Promise<HealthImportResult>;
}

export class HealthProviderError extends Error {
  constructor(
    readonly code: 'not-available' | 'permission-denied' | 'no-data',
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'HealthProviderError';
  }
}
