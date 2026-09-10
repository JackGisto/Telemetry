import type { HealthImportResult } from '@/types';
import type { HealthProvider } from './provider';

/**
 * Manual entry: the rider types the values in.
 *
 * The default, and the only one that works in a browser. It is a provider like
 * the others so the profile screen has a single code path whether the data was
 * typed or imported.
 */
export class ManualHealthProvider implements HealthProvider {
  readonly source = 'manual' as const;
  readonly label = 'Inserimento manuale';

  isAvailable(): boolean {
    return true;
  }

  unavailableReason(): string | null {
    return null;
  }

  async requestPermission(): Promise<boolean> {
    return true;
  }

  /** Nothing to read: the form writes the profile directly. */
  async read(): Promise<HealthImportResult> {
    return { source: 'manual', samples: [] };
  }
}
