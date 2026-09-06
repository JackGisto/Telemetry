import type { VelocityStats } from '@/types';
import type { Tunables } from '../tunables';
import { mean, percentile, smooth } from './signal';

export interface VelocitySummary {
  velocity: VelocityStats;
  compressionEvents: number;
}

/**
 * Shaft-velocity statistics and rebound recovery time.
 *
 * Compression is positive travel change, rebound is negative; both are reported
 * as positive magnitudes in mm/s. The signal is lightly smoothed first, because
 * a raw first difference of a noisy position trace is dominated by noise.
 */
export function computeVelocity(
  positionsMm: number[],
  timestampsMs: number[],
  totalTravelMm: number,
  tunables: Tunables,
): VelocitySummary {
  const empty: VelocitySummary = {
    velocity: {
      meanCompression: 0,
      meanRebound: 0,
      p95Compression: 0,
      p95Rebound: 0,
      maxCompression: 0,
      maxRebound: 0,
      meanRecoveryTimeSec: 0,
    },
    compressionEvents: 0,
  };
  if (positionsMm.length < 3) return empty;

  const smoothed = smooth(positionsMm, 5);
  const compression: number[] = [];
  const rebound: number[] = [];

  for (let i = 1; i < smoothed.length; i++) {
    const dtSec = ((timestampsMs[i] ?? 0) - (timestampsMs[i - 1] ?? 0)) / 1000;
    if (dtSec <= 0) continue;
    const dv = (smoothed[i] - smoothed[i - 1]) / dtSec;
    if (Math.abs(dv * dtSec) < tunables.noiseFloorMm) continue;
    if (dv > 0) compression.push(dv);
    else rebound.push(-dv);
  }

  const events = findCompressionEvents(smoothed, totalTravelMm, tunables);
  const recoveries = events
    .map((e) => recoveryTimeSec(smoothed, timestampsMs, e))
    .filter((v): v is number => v !== null);

  return {
    velocity: {
      meanCompression: mean(compression),
      meanRebound: mean(rebound),
      p95Compression: percentile(compression, 0.95),
      p95Rebound: percentile(rebound, 0.95),
      maxCompression: compression.length ? Math.max(...compression) : 0,
      maxRebound: rebound.length ? Math.max(...rebound) : 0,
      meanRecoveryTimeSec: mean(recoveries),
    },
    compressionEvents: events.length,
  };
}

export interface CompressionEvent {
  /** Index of the local travel peak. */
  peakIndex: number;
  peakMm: number;
  /** Index where the compression started (previous local minimum). */
  startIndex: number;
  startMm: number;
}

/**
 * Detect compression peaks: a rise of at least `compressionEventMinPct` of the
 * stroke from a local minimum to a local maximum.
 */
export function findCompressionEvents(
  positionsMm: number[],
  totalTravelMm: number,
  tunables: Tunables,
): CompressionEvent[] {
  const minRise = (tunables.compressionEventMinPct / 100) * totalTravelMm;
  const events: CompressionEvent[] = [];
  if (positionsMm.length < 3 || minRise <= 0) return events;

  let minIndex = 0;
  let minValue = positionsMm[0];
  let peakIndex = -1;
  let peakValue = -Infinity;
  let rising = false;

  for (let i = 1; i < positionsMm.length; i++) {
    const v = positionsMm[i];
    if (v > peakValue) {
      peakValue = v;
      peakIndex = i;
    }
    if (!rising && v - minValue >= minRise) rising = true;

    // A drop of half the qualifying rise from the peak closes the event.
    if (rising && peakValue - v >= minRise / 2) {
      events.push({ peakIndex, peakMm: peakValue, startIndex: minIndex, startMm: minValue });
      rising = false;
      minIndex = i;
      minValue = v;
      peakValue = v;
      peakIndex = i;
    }

    if (!rising && v < minValue) {
      minValue = v;
      minIndex = i;
    }
  }
  return events;
}

/**
 * Time for the unit to return from a compression peak down to 25% of that
 * event's amplitude. This is the metric the rebound rules read: it is robust to
 * the absolute size of the hit, unlike peak rebound velocity.
 */
export function recoveryTimeSec(
  positionsMm: number[],
  timestampsMs: number[],
  event: CompressionEvent,
): number | null {
  const amplitude = event.peakMm - event.startMm;
  if (amplitude <= 0) return null;
  const target = event.startMm + amplitude * 0.25;
  for (let i = event.peakIndex + 1; i < positionsMm.length; i++) {
    if (positionsMm[i] <= target) {
      const dt = ((timestampsMs[i] ?? 0) - (timestampsMs[event.peakIndex] ?? 0)) / 1000;
      return dt > 0 ? dt : null;
    }
  }
  return null;
}
