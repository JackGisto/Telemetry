import type { TravelHistogramBin } from '@/types';
import type { Tunables } from '../tunables';
import { clamp, mean, percentile } from './signal';

export interface TravelSummary {
  maxTravelMm: number;
  maxTravelPct: number;
  meanTravelMm: number;
  meanTravelPct: number;
  p95TravelPct: number;
  histogram: TravelHistogramBin[];
  bottomOutCount: number;
  timeNearBottom: number;
  timeNearTop: number;
  topOutCount: number;
}

/**
 * Travel statistics for one channel.
 *
 * `positionsMm` must already be normalised millimetres of travel; `totalTravelMm`
 * is the user-configured stroke. Percentages are always relative to that stroke,
 * so two bikes with different travel remain directly comparable.
 */
export function computeTravel(
  positionsMm: number[],
  timestampsMs: number[],
  totalTravelMm: number,
  tunables: Tunables,
): TravelSummary {
  if (positionsMm.length === 0 || totalTravelMm <= 0) {
    return {
      maxTravelMm: 0,
      maxTravelPct: 0,
      meanTravelMm: 0,
      meanTravelPct: 0,
      p95TravelPct: 0,
      histogram: emptyHistogram(tunables.histogramBins),
      bottomOutCount: 0,
      timeNearBottom: 0,
      timeNearTop: 0,
      topOutCount: 0,
    };
  }

  const pct = positionsMm.map((mm) => clamp((mm / totalTravelMm) * 100, 0, 100));
  const maxTravelMm = Math.max(...positionsMm);
  const meanTravelMm = mean(positionsMm);

  return {
    maxTravelMm,
    maxTravelPct: clamp((maxTravelMm / totalTravelMm) * 100, 0, 100),
    meanTravelMm,
    meanTravelPct: clamp((meanTravelMm / totalTravelMm) * 100, 0, 100),
    p95TravelPct: percentile(pct, 0.95),
    histogram: buildHistogram(pct, tunables.histogramBins),
    bottomOutCount: countBottomOuts(pct, timestampsMs, tunables),
    timeNearBottom: fractionAbove(pct, tunables.bottomOutPct),
    timeNearTop: fractionBelow(pct, tunables.nearTopPct),
    topOutCount: countTopOuts(positionsMm, timestampsMs, tunables),
  };
}

function emptyHistogram(bins: number): TravelHistogramBin[] {
  const width = 100 / bins;
  return Array.from({ length: bins }, (_, i) => ({
    fromPct: i * width,
    toPct: (i + 1) * width,
    fraction: 0,
  }));
}

export function buildHistogram(pct: number[], bins: number): TravelHistogramBin[] {
  const histogram = emptyHistogram(bins);
  if (pct.length === 0) return histogram;
  const width = 100 / bins;
  for (const p of pct) {
    // The top bin is closed on the right so a full-travel sample lands in it.
    const idx = Math.min(bins - 1, Math.floor(p / width));
    histogram[idx].fraction += 1;
  }
  for (const bin of histogram) bin.fraction /= pct.length;
  return histogram;
}

/**
 * A bottom-out is a crossing of the bottom-out threshold, debounced so a single
 * hit that chatters around the threshold is not counted several times.
 */
function countBottomOuts(pct: number[], timestampsMs: number[], tunables: Tunables): number {
  let count = 0;
  let inside = false;
  let lastEventAt = -Infinity;
  for (let i = 0; i < pct.length; i++) {
    const above = pct[i] >= tunables.bottomOutPct;
    if (above && !inside) {
      const t = timestampsMs[i] ?? 0;
      if (t - lastEventAt >= tunables.bottomOutRefractoryMs) {
        count += 1;
        lastEventAt = t;
      }
      inside = true;
    } else if (!above) {
      inside = false;
    }
  }
  return count;
}

/**
 * Top-out: the unit returns to (near) full extension hard enough to sit at the
 * very top of the stroke. Only meaningful once the noise floor is cleared.
 */
function countTopOuts(positionsMm: number[], timestampsMs: number[], tunables: Tunables): number {
  let count = 0;
  let inside = false;
  let lastEventAt = -Infinity;
  for (let i = 0; i < positionsMm.length; i++) {
    const atTop = positionsMm[i] <= tunables.noiseFloorMm;
    if (atTop && !inside) {
      const t = timestampsMs[i] ?? 0;
      if (t - lastEventAt >= tunables.bottomOutRefractoryMs) {
        count += 1;
        lastEventAt = t;
      }
      inside = true;
    } else if (!atTop) {
      inside = false;
    }
  }
  // The run starts extended; that first "event" is not a top-out.
  return Math.max(0, count - 1);
}

function fractionAbove(pct: number[], threshold: number): number {
  if (pct.length === 0) return 0;
  return pct.filter((p) => p >= threshold).length / pct.length;
}

function fractionBelow(pct: number[], threshold: number): number {
  if (pct.length === 0) return 0;
  return pct.filter((p) => p < threshold).length / pct.length;
}
