import type { RidingStyle, SuspensionComponent } from './bike';

export interface TravelHistogramBin {
  /** Inclusive lower bound in % of travel. */
  fromPct: number;
  /** Exclusive upper bound in % of travel. */
  toPct: number;
  /** Fraction of the run spent in this bin, 0..1. */
  fraction: number;
}

/**
 * One bin of the shaft-velocity distribution.
 *
 * Negative velocities are rebound, positive are compression, both in mm/s.
 * This is the standard way damping is read in suspension work: the shape of
 * this distribution says far more than any single average.
 */
export interface VelocityHistogramBin {
  /** Inclusive lower bound in mm/s. Negative means rebound. */
  fromMmS: number;
  /** Exclusive upper bound in mm/s. */
  toMmS: number;
  /** Fraction of the moving samples in this bin, 0..1. */
  fraction: number;
}

/**
 * Damping behaviour split by shaft speed.
 *
 * Low-speed motion is rider input and terrain undulation: it governs support
 * and ride height. High-speed motion is sharp impacts: it governs harshness and
 * bottom-out resistance. They are controlled by different adjusters, so the
 * engine has to judge them separately.
 */
export interface SpeedBandStats {
  /** Mean magnitude in the band, mm/s. */
  mean: number;
  /** Fraction of moving samples that fall in this band, 0..1. */
  fraction: number;
}

export interface VelocityStats {
  /** mm/s, positive numbers. */
  meanCompression: number;
  meanRebound: number;
  p95Compression: number;
  p95Rebound: number;
  maxCompression: number;
  maxRebound: number;
  /**
   * Mean time in seconds to recover from a compression peak back to 25% of
   * that peak. The primary rebound-damping indicator.
   */
  meanRecoveryTimeSec: number;
  /** Distribution of shaft velocity, rebound (negative) to compression. */
  histogram: VelocityHistogramBin[];
  lowSpeedCompression: SpeedBandStats;
  highSpeedCompression: SpeedBandStats;
  lowSpeedRebound: SpeedBandStats;
  highSpeedRebound: SpeedBandStats;
}

export interface ComponentMetrics {
  component: SuspensionComponent;
  totalTravelMm: number;
  maxTravelMm: number;
  maxTravelPct: number;
  meanTravelMm: number;
  meanTravelPct: number;
  /**
   * Dynamic ride height: where the suspension actually settles while riding,
   * as % of travel. Taken from the quiet samples only, so a few big hits do not
   * drag it down the way `meanTravelPct` is dragged. This is the metric that
   * corresponds to sag once the bike is moving.
   */
  rideHeightPct: number;
  /** Travel below which the unit spends 95% of the run. */
  p95TravelPct: number;
  histogram: TravelHistogramBin[];
  bottomOutCount: number;
  /** Fraction of the run spent above the bottom-out threshold, 0..1. */
  timeNearBottom: number;
  /** Fraction of the run spent in the first 15% of travel, 0..1. */
  timeNearTop: number;
  topOutCount: number;
  velocity: VelocityStats;
  /** Number of distinct compression events detected. */
  compressionEvents: number;
}

export interface BalanceMetrics {
  /** frontMaxPct / rearMaxPct. 1.0 means both use the same share of travel. */
  travelUseRatio: number;
  /** frontMaxPct - rearMaxPct, in percentage points. */
  travelUseDeltaPct: number;
  bottomOutDelta: number;
  /** frontRecovery - rearRecovery in seconds. */
  reboundDeltaSec: number;
  /** frontRideHeight - rearRideHeight, in percentage points. */
  rideHeightDeltaPct: number;
}

export interface SessionMetrics {
  front: ComponentMetrics;
  rear: ComponentMetrics | null;
  balance: BalanceMetrics | null;
  durationSec: number;
  sampleCount: number;
}

export type DiagnosisId =
  | 'insufficient-travel-use'
  | 'excessive-travel-use'
  | 'frequent-bottom-out'
  | 'excessive-time-near-bottom'
  | 'suspension-riding-high'
  | 'suspension-riding-low'
  | 'rebound-too-fast'
  | 'rebound-too-slow'
  | 'harsh-on-impacts'
  | 'lacks-low-speed-support'
  | 'packing-down'
  | 'front-rear-imbalance'
  | 'inconsistent-with-style';

export type Severity = 'info' | 'minor' | 'moderate' | 'major';

export interface Diagnosis {
  id: DiagnosisId;
  component: SuspensionComponent | 'system';
  severity: Severity;
  /** 0..1. Lowered when the run is short or the signal is weak. */
  confidence: number;
  /** Name of the metric that triggered the rule. */
  metric: string;
  metricValue: number;
  /** The threshold that was crossed. */
  threshold: number;
  /** Plain-language explanation, already localised. */
  description: string;
}

/** Which adjuster a click-based recommendation targets. */
export type DampingCircuit = 'low-speed' | 'high-speed' | 'single';

export type RecommendationAction =
  | { kind: 'pressure'; component: SuspensionComponent; deltaPsi: number }
  | {
      kind: 'rebound';
      component: SuspensionComponent;
      deltaClicks: number;
      circuit: DampingCircuit;
    }
  | {
      kind: 'compression';
      component: SuspensionComponent;
      deltaClicks: number;
      circuit: DampingCircuit;
    }
  | { kind: 'preload'; component: SuspensionComponent; deltaTurns: number }
  | { kind: 'spring-rate'; component: SuspensionComponent; direction: 'softer' | 'stiffer' }
  | { kind: 'explain'; component: SuspensionComponent | 'system' };

/**
 * The concrete before-and-after of a change.
 *
 * "Add 5 PSI" leaves the rider doing arithmetic at the trailhead; "from 180 to
 * 185 PSI" is something they can set and verify. The app already knows the
 * current value, so there is no reason to make them work it out.
 */
export interface SettingChange {
  from: number;
  to: number;
  unit: string;
  /** Name of the adjuster, as the rider sees it on the suspension. */
  label: string;
}

export interface Recommendation {
  id: string;
  /** Higher runs first. Derived from severity x confidence. */
  priority: number;
  action: RecommendationAction;
  /** One-line imperative instruction shown in Standard mode. */
  title: string;
  /** Concrete start and end values, when the app knows the current setting. */
  change: SettingChange | null;
  /** Why, in one or two sentences. Shown on expand / in Expert mode. */
  rationale: string;
  /** How to physically perform the change, for someone who never has. */
  howTo: string[];
  /** What should feel different afterwards, so the rider can judge the result. */
  expect: string;
  /** The diagnoses this recommendation answers. */
  causes: DiagnosisId[];
}

/** Short verdict shown per component in Standard mode. */
export type Verdict =
  | 'too-soft'
  | 'slightly-soft'
  | 'correct'
  | 'slightly-stiff'
  | 'too-stiff'
  | 'unknown';

export type BalanceVerdict = 'front-soft' | 'rear-soft' | 'balanced' | 'unknown';

export interface AnalysisReport {
  sessionId: string;
  generatedAt: string;
  engineVersion: string;
  ridingStyle: RidingStyle;
  metrics: SessionMetrics;
  diagnoses: Diagnosis[];
  recommendations: Recommendation[];
  scores: {
    front: number;
    rear: number | null;
    balance: number | null;
    overall: number;
  };
  verdicts: {
    front: Verdict;
    rear: Verdict | null;
    balance: BalanceVerdict | null;
  };
  /** Set when the run is too short / too flat to trust the analysis. */
  warnings: string[];
}
