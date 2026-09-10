/**
 * Rider profile.
 *
 * These are health data: under GDPR, body metrics collected in a health context
 * are personal data and, framed as health information, fall in a special
 * category. The app therefore keeps them local by default, asks for explicit
 * consent before storing them, and never sends them anywhere without one.
 */

export type RiderSex = 'male' | 'female' | 'other' | 'undisclosed';

/** Where a field came from, so the UI can show what was imported. */
export type HealthSource = 'manual' | 'apple-health' | 'health-connect';

export interface RiderHealthProfile {
  /** Display name, from the account when there is one. */
  displayName?: string;
  sex?: RiderSex;
  heightCm?: number;
  weightKg?: number;
  birthYear?: number;
  source: HealthSource;
  updatedAt: string;
  /**
   * Explicit consent to store these values on the device. Without it nothing
   * is written: the profile screen stays empty and the app keeps working.
   */
  consentGiven: boolean;
  consentAt?: string;
}

/** One field a health provider can supply. */
export interface HealthSample {
  field: 'sex' | 'heightCm' | 'weightKg' | 'birthYear';
  value: string | number;
  /** When the source app recorded it. */
  recordedAt?: string;
}

export interface HealthImportResult {
  source: HealthSource;
  samples: HealthSample[];
}
