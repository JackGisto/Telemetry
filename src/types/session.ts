import type { BikeConfig } from './bike';

/**
 * One decoded telemetry sample.
 *
 * `frontMm` / `rearMm` are already normalised to millimetres of travel by the
 * decoding adapter (`src/data/normalize.ts`). The analysis engine never sees
 * raw ADC counts.
 *
 * `extra` is the extension point for sensors beyond the two position channels.
 * It is deliberately an open map rather than named fields: when an inertial or
 * speed sensor is added, samples carry it and the codec, storage, export and
 * comparison keep working untouched. The analysis engine ignores keys it does
 * not know, so an unrecognised channel is inert rather than breaking a run.
 */
export interface RawSample {
  /** Milliseconds from the start of the run. */
  t: number;
  frontMm: number;
  rearMm: number | null;
  /**
   * Additional channels, keyed by name. Units belong to the channel and are
   * declared in the session's `channels` list.
   */
  extra?: Record<string, number>;
}

/**
 * Description of one recorded channel.
 *
 * Stored with the session so a run recorded by a newer device stays readable:
 * the app can show and export a channel it has no analysis for.
 */
export interface ChannelDescriptor {
  /** Key used in `RawSample.extra`, or 'front' / 'rear' for position. */
  key: string;
  label: string;
  unit: string;
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
  /**
   * Channels present beyond fork and shock position. Empty or absent on every
   * run recorded by the current hardware.
   */
  extraChannels?: ChannelDescriptor[];
  source: 'device' | 'imported' | 'demo';
}

export interface Session extends SessionMeta {
  samples: RawSample[];
}
