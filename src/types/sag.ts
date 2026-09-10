import type { RecommendationAction, Verdict } from './analysis';
import type { SuspensionComponent } from './bike';

/**
 * Static sag: how far the suspension settles under the rider's weight, with the
 * bike stationary, as a percentage of travel.
 *
 * It is the setting every setup starts from, and it is measured, not derived
 * from a run: the rider sits on the bike and the device reports where the
 * suspension came to rest. It is deliberately kept apart from the run analysis,
 * which measures dynamic ride height while riding — a related but different
 * thing.
 */
export interface SagChannelResult {
  component: SuspensionComponent;
  /** Position the suspension settled at, in mm of travel used. */
  sagMm: number;
  /** The same, as a percentage of the unit's configured travel. */
  sagPct: number;
  /** Target band for the rider's chosen style, in percent. */
  targetPct: [number, number];
  verdict: Verdict;
}

export interface SagMeasurement {
  bikeId: string;
  at: string;
  channels: SagChannelResult[];
  /** Highest sample spread seen while holding, in mm. Low means a clean hold. */
  stabilityMm: number;
}

/** What to change, when the measured sag is outside the target band. */
export interface SagAdvice {
  component: SuspensionComponent;
  action: RecommendationAction;
  title: string;
  rationale: string;
}

/** An instantaneous position reading, the primitive the sag procedure needs. */
export interface PositionReading {
  frontMm: number;
  rearMm: number | null;
}
