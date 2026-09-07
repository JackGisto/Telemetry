import type { SpeedBandStats, VelocityHistogramBin, VelocityStats } from '@/types';
import type { Tunables } from '../tunables';
import { mean, percentile, smooth } from './signal';

export interface VelocitySummary {
  velocity: VelocityStats;
  compressionEvents: number;
}

const EMPTY_BAND: SpeedBandStats = { mean: 0, fraction: 0 };

/**
 * Distribution of shaft velocity, rebound (negative) through compression.
 *
 * Reading damping from the shape of this distribution, rather than from a
 * single average, is standard practice in suspension work: two setups with the
 * same mean velocity can behave completely differently.
 */
export function buildVelocityHistogram(
  velocities: number[],
  binWidth: number,
  range: number,
): VelocityHistogramBin[] {
  const binCount = Math.max(2, Math.ceil((range * 2) / binWidth));
  const bins: VelocityHistogramBin[] = Array.from({ length: binCount }, (_, i) => ({
    fromMmS: -range + i * binWidth,
    toMmS: -range + (i + 1) * binWidth,
    fraction: 0,
  }));
  if (velocities.length === 0) return bins;

  for (const v of velocities) {
    // Values past either end are clamped into the edge bins rather than dropped,
    // so the fractions still sum to 1 and nothing is silently lost.
    const index = Math.min(binCount - 1, Math.max(0, Math.floor((v + range) / binWidth)));
    bins[index].fraction += 1;
  }
  for (const bin of bins) bin.fraction /= velocities.length;
  return bins;
}

/** Mean magnitude and share of motion within one speed band. */
function band(magnitudes: number[], totalMoving: number): SpeedBandStats {
  if (magnitudes.length === 0 || totalMoving === 0) return EMPTY_BAND;
  return { mean: mean(magnitudes), fraction: magnitudes.length / totalMoving };
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
      histogram: buildVelocityHistogram(
        [],
        tunables.velocityBinWidthMmS,
        tunables.velocityHistogramRangeMmS,
      ),
      lowSpeedCompression: EMPTY_BAND,
      highSpeedCompression: EMPTY_BAND,
      lowSpeedRebound: EMPTY_BAND,
      highSpeedRebound: EMPTY_BAND,
    },
    compressionEvents: 0,
  };
  if (positionsMm.length < 3) return empty;

  const smoothed = smooth(positionsMm, 5);
  const compression: number[] = [];
  const rebound: number[] = [];
  /** Signed velocities of every moving sample, for the distribution. */
  const signed: number[] = [];

  for (let i = 1; i < smoothed.length; i++) {
    const dtSec = ((timestampsMs[i] ?? 0) - (timestampsMs[i - 1] ?? 0)) / 1000;
    if (dtSec <= 0) continue;
    const dv = (smoothed[i] - smoothed[i - 1]) / dtSec;
    if (Math.abs(dv * dtSec) < tunables.noiseFloorMm) continue;
    signed.push(dv);
    if (dv > 0) compression.push(dv);
    else rebound.push(-dv);
  }

  // Split each direction at the configured speed threshold. The two halves are
  // controlled by different adjusters, so they are judged separately.
  const split = tunables.velocitySplitMmS;
  const moving = compression.length + rebound.length;

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
      histogram: buildVelocityHistogram(
        signed,
        tunables.velocityBinWidthMmS,
        tunables.velocityHistogramRangeMmS,
      ),
      lowSpeedCompression: band(compression.filter((v) => v < split), moving),
      highSpeedCompression: band(compression.filter((v) => v >= split), moving),
      lowSpeedRebound: band(rebound.filter((v) => v < split), moving),
      highSpeedRebound: band(rebound.filter((v) => v >= split), moving),
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
