import type { BikeConfig } from './bike';

/**
 * One decoded telemetry sample.
 *
 * `frontMm` / `rearMm` are already normalised to millimetres of travel by the
 * decoding adapter (`src/data/normalize.ts`). The analysis engine never sees
 * raw ADC counts.
 */
export interface RawSample {
  /** Milliseconds from the start of the run. */
  t: number;
  frontMm: number;
  rearMm: number | null;
}

export interface SessionMeta {
  id: string;
  bikeId: string;
  startedAt: string;
  durationSec: number;
  sampleRateHz: number;
  /** Free-text trail / location name. */
  trail?: string;
  /** Setup notes the rider attaches after the run. */
  notes?: string;
  /** Snapshot of the bike setup as it was for THIS run. */
  setupSnapshot: BikeConfig;
  source: 'device' | 'imported' | 'demo';
}

export interface Session extends SessionMeta {
  samples: RawSample[];
}
