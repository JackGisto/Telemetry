import type { RidingStyle, SuspensionComponent } from './bike';

export interface TravelHistogramBin {
  /** Inclusive lower bound in % of travel. */
  fromPct: number;
  /** Exclusive upper bound in % of travel. */
  toPct: number;
  /** Fraction of the run spent in this bin, 0..1. */
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
}

export interface ComponentMetrics {
  component: SuspensionComponent;
  totalTravelMm: number;
  maxTravelMm: number;
  maxTravelPct: number;
  meanTravelMm: number;
  meanTravelPct: number;
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

export type RecommendationAction =
  | { kind: 'pressure'; component: SuspensionComponent; deltaPsi: number }
  | { kind: 'rebound'; component: SuspensionComponent; deltaClicks: number }
  | { kind: 'compression'; component: SuspensionComponent; deltaClicks: number }
  | { kind: 'preload'; component: SuspensionComponent; deltaTurns: number }
  | { kind: 'spring-rate'; component: SuspensionComponent; direction: 'softer' | 'stiffer' }
  | { kind: 'explain'; component: SuspensionComponent | 'system' };

export interface Recommendation {
  id: string;
  /** Higher runs first. Derived from severity x confidence. */
  priority: number;
  action: RecommendationAction;
  /** One-line imperative instruction shown in Standard mode. */
  title: string;
  /** Why, in one or two sentences. Shown on expand / in Expert mode. */
  rationale: string;
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
