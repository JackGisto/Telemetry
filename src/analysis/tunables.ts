/**
 * Every threshold, weight and style profile the rule-based engine uses.
 *
 * Nothing in this file is hardcoded inside components or rules: tuning the
 * engine means editing this file (or passing an override object to
 * `analyseSession`), never touching UI code.
 */
import type { RidingStyle, Severity } from '@/types';

export interface TravelWindow {
  /** Target band for max travel used, in % of stroke. */
  maxTravelPct: [number, number];
  /** Target band for mean travel used, in % of stroke. */
  meanTravelPct: [number, number];
  /** Acceptable bottom-outs per minute of riding. */
  bottomOutPerMin: [number, number];
}

export interface StyleProfile {
  label: string;
  front: TravelWindow;
  rear: TravelWindow;
  /** Target mean recovery time after a compression peak, in seconds. */
  recoveryTimeSec: [number, number];
  /** Target dynamic ride height, in % of travel. */
  rideHeightPct: [number, number];
  /**
   * Target static sag, in % of travel: fork first, then shock.
   *
   * These follow the ranges suspension manufacturers publish for each kind of
   * riding, which is what a rider will have been told elsewhere. Like every
   * other threshold here they are meant to be adjusted once real runs exist.
   */
  sagPct: { front: [number, number]; rear: [number, number] };
}

export interface Tunables {
  /** A sample counts as bottom-out at or above this share of stroke. */
  bottomOutPct: number;
  /** Minimum gap between two bottom-out events, in ms (debounce). */
  bottomOutRefractoryMs: number;
  /** Travel below this share of stroke counts as "near top". */
  nearTopPct: number;
  /** Max share of the run allowed above `bottomOutPct` before we flag it. */
  timeNearBottomMax: number;
  /** Min share of the run in the top zone before "riding high" is flagged. */
  timeNearTopMax: number;
  /** A compression event must exceed this much travel, in % of stroke. */
  compressionEventMinPct: number;
  /** Movement below this, in mm, is treated as sensor noise. */
  noiseFloorMm: number;
  /** Runs shorter than this (seconds) get a low-confidence warning. */
  minRunSec: number;
  /** Runs shorter than this (seconds) are not analysed at all. */
  hardMinRunSec: number;
  /** Front/rear max-travel gap, in points, before imbalance is flagged. */
  imbalanceDeltaPct: number;
  /** Front/rear recovery-time gap, in seconds, before imbalance is flagged. */
  imbalanceReboundSec: number;
  /** Number of histogram bins across the stroke. */
  histogramBins: number;

  /**
   * Shaft speed, in mm/s, that separates low-speed from high-speed motion.
   *
   * Low speed is rider input and terrain undulation, high speed is sharp
   * impacts; different adjusters control each. The exact split is a convention,
   * not a physical constant, which is why it lives here and not in a rule.
   */
  velocitySplitMmS: number;
  /** Width of one shaft-velocity histogram bin, in mm/s. */
  velocityBinWidthMmS: number;
  /** Velocity range covered by the histogram, in mm/s, either side of zero. */
  velocityHistogramRangeMmS: number;
  /** Below this shaft speed, in mm/s, the suspension counts as "settled". */
  quietVelocityMmS: number;
  /**
   * Share of compression motion above the speed split beyond which the unit is
   * being asked to swallow more sharp impacts than its damping can absorb.
   */
  highSpeedCompressionMax: number;
  /**
   * Share of rebound motion below the speed split under which the unit is not
   * recovering between hits: the classic packing-down signature.
   */
  lowSpeedReboundMin: number;
  styles: Record<RidingStyle, StyleProfile>;
  /** Contribution of each severity to the deduction from a 100-point score. */
  severityWeight: Record<Severity, number>;
  /** How much each component contributes to the overall score. */
  scoreWeights: { front: number; rear: number; balance: number };
  /** PSI change per point of travel-use error, per component. */
  psiPerTravelPoint: { front: number; rear: number };
  /** Clamp on any single suggested pressure change, in PSI. */
  maxPsiStep: { front: number; rear: number };
  /** Recovery-time error, in seconds, that maps to one rebound click. */
  secPerReboundClick: number;
  /**
   * Error, as a fraction of motion in a speed band, that maps to one click of
   * the corresponding compression or rebound adjuster.
   */
  bandFractionPerClick: number;
  /** Max recommendations surfaced in Standard mode. */
  maxStandardRecommendations: number;
  /**
   * Sample spread, in mm, above which the rider was not holding still enough
   * for the sag reading to be trusted.
   */
  sagStabilityMaxMm: number;
  /** Number of position samples averaged for one sag measurement. */
  sagSampleCount: number;
}

const style = (
  label: string,
  frontMax: [number, number],
  frontMean: [number, number],
  rearMax: [number, number],
  rearMean: [number, number],
  bottomOut: [number, number],
  recovery: [number, number],
  rideHeight: [number, number],
  sagFront: [number, number],
  sagRear: [number, number],
): StyleProfile => ({
  label,
  front: { maxTravelPct: frontMax, meanTravelPct: frontMean, bottomOutPerMin: bottomOut },
  rear: { maxTravelPct: rearMax, meanTravelPct: rearMean, bottomOutPerMin: bottomOut },
  recoveryTimeSec: recovery,
  rideHeightPct: rideHeight,
  sagPct: { front: sagFront, rear: sagRear },
});

export const DEFAULT_TUNABLES: Tunables = {
  bottomOutPct: 95,
  bottomOutRefractoryMs: 400,
  nearTopPct: 15,
  timeNearBottomMax: 0.04,
  timeNearTopMax: 0.72,
  compressionEventMinPct: 8,
  noiseFloorMm: 0.4,
  minRunSec: 60,
  hardMinRunSec: 10,
  imbalanceDeltaPct: 12,
  imbalanceReboundSec: 0.12,
  histogramBins: 10,

  velocitySplitMmS: 200,
  velocityBinWidthMmS: 50,
  velocityHistogramRangeMmS: 1000,
  quietVelocityMmS: 25,
  highSpeedCompressionMax: 0.34,
  lowSpeedReboundMin: 0.55,

  styles: {
    // Comfort riders should use the stroke fully but rarely reach the end.
    comfort: style(
      'Comfort', [82, 93], [22, 34], [80, 92], [24, 36], [0, 0.4], [0.28, 0.48], [20, 34],
      [18, 25], [28, 35],
    ),
    balanced: style(
      'Bilanciato', [88, 97], [20, 32], [86, 96], [22, 34], [0, 0.8], [0.22, 0.4], [17, 30],
      [15, 20], [25, 30],
    ),
    // Aggressive riders expect to touch the end of the stroke on big hits.
    aggressive: style(
      'Aggressivo', [92, 100], [18, 30], [90, 100], [20, 32], [0.2, 1.6], [0.16, 0.32], [14, 26],
      [12, 18], [22, 28],
    ),
  },

  severityWeight: { info: 0, minor: 6, moderate: 14, major: 26 },
  scoreWeights: { front: 0.4, rear: 0.4, balance: 0.2 },
  psiPerTravelPoint: { front: 0.7, rear: 1.1 },
  maxPsiStep: { front: 12, rear: 20 },
  secPerReboundClick: 0.06,
  bandFractionPerClick: 0.07,
  maxStandardRecommendations: 3,
  sagStabilityMaxMm: 2.5,
  sagSampleCount: 12,
};

export function withOverrides(overrides?: Partial<Tunables>): Tunables {
  if (!overrides) return DEFAULT_TUNABLES;
  return { ...DEFAULT_TUNABLES, ...overrides };
}
