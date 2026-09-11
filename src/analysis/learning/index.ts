import type {
  AnalysisReport,
  Session,
  SessionMeta,
  SuspensionComponent,
  SuspensionConfig,
} from '@/types';
import { round } from '../metrics/signal';

/**
 * Learning the bike's response from the rider's own history.
 *
 * The engine's default step sizes are generic: so many PSI per point of travel,
 * the same for everyone. But the rider's own runs contain the real answer. If
 * adding 7 PSI to the shock moved travel used by 4 points and cut bottom-outs
 * from 5 to 2, then this bike, with this rider's weight, responds at a rate we
 * have measured rather than assumed.
 *
 * Entirely deterministic: this is arithmetic over stored runs, not a model. No
 * training, no cloud, and it produces nothing at all until there are two runs
 * that differ by a single setting.
 */

/** The settings whose effect we can attribute, and the metric each moves. */
export type LearnableSetting = 'pressure' | 'rebound' | 'compression';

export interface RunPoint {
  sessionId: string;
  startedAt: string;
  bikeId: string;
  component: SuspensionComponent;
  /** Value of each learnable setting at the time of the run. */
  settings: Partial<Record<LearnableSetting, number>>;
  metrics: {
    maxTravelPct: number;
    rideHeightPct: number;
    bottomOutCount: number;
    recoveryTimeSec: number;
  };
  durationSec: number;
}

export interface Observation {
  setting: LearnableSetting;
  component: SuspensionComponent;
  /** How much the setting moved, in its own unit. */
  settingDelta: number;
  /** How much the metric moved as a result. */
  metricDelta: number;
  metric: keyof RunPoint['metrics'];
  fromSessionId: string;
  toSessionId: string;
}

export interface Sensitivity {
  setting: LearnableSetting;
  component: SuspensionComponent;
  metric: keyof RunPoint['metrics'];
  /** Metric units per one unit of the setting. Signed. */
  perUnit: number;
  /** How many run pairs support it. More pairs, more trust. */
  samples: number;
}

/** The metric each setting is expected to move, and which the rules read. */
export const SETTING_METRIC: Record<LearnableSetting, keyof RunPoint['metrics']> = {
  pressure: 'maxTravelPct',
  rebound: 'recoveryTimeSec',
  compression: 'rideHeightPct',
};

function unitFor(
  setupSnapshot: SessionMeta['setupSnapshot'],
  component: SuspensionComponent,
): SuspensionConfig | null {
  if (component === 'front') return setupSnapshot.frontSuspension;
  return setupSnapshot.rearSuspension.present ? setupSnapshot.rearSuspension : null;
}

/** Flatten one analysed run into the points the learner works on. */
export function runPoints(
  session: Session | SessionMeta,
  report: AnalysisReport,
): RunPoint[] {
  const points: RunPoint[] = [];

  const add = (component: SuspensionComponent) => {
    const unit = unitFor(session.setupSnapshot, component);
    const metrics = component === 'front' ? report.metrics.front : report.metrics.rear;
    if (!unit || !metrics) return;

    points.push({
      sessionId: session.id,
      startedAt: session.startedAt,
      bikeId: session.bikeId,
      component,
      settings: {
        pressure: unit.pressurePsi,
        rebound: unit.rebound.clicks,
        compression: unit.compression.clicks,
      },
      metrics: {
        maxTravelPct: metrics.maxTravelPct,
        rideHeightPct: metrics.rideHeightPct,
        bottomOutCount: metrics.bottomOutCount,
        recoveryTimeSec: metrics.velocity.meanRecoveryTimeSec,
      },
      durationSec: report.metrics.durationSec,
    });
  };

  add('front');
  add('rear');
  return points;
}

export interface LearningOptions {
  /** Runs shorter than this are ignored: their metrics are not trustworthy. */
  minRunSec?: number;
  /** Smallest setting change worth attributing anything to. */
  minDelta?: Partial<Record<LearnableSetting, number>>;
}

const DEFAULT_MIN_DELTA: Record<LearnableSetting, number> = {
  pressure: 3,
  rebound: 1,
  compression: 1,
};

/**
 * Find run pairs where exactly one setting changed.
 *
 * The "exactly one" rule is what makes the result attributable. If the rider
 * changed pressure and rebound between two runs, the metric moved for reasons
 * we cannot separate, and guessing would produce a confident wrong number.
 */
export function findObservations(
  points: RunPoint[],
  options: LearningOptions = {},
): Observation[] {
  const minRunSec = options.minRunSec ?? 60;
  const minDelta = { ...DEFAULT_MIN_DELTA, ...options.minDelta };
  const observations: Observation[] = [];

  // Group by bike and component: a fork's response says nothing about a shock.
  const groups = new Map<string, RunPoint[]>();
  for (const point of points) {
    if (point.durationSec < minRunSec) continue;
    const key = `${point.bikeId}:${point.component}`;
    const group = groups.get(key) ?? [];
    group.push(point);
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    const ordered = [...group].sort((a, b) => a.startedAt.localeCompare(b.startedAt));

    for (let i = 1; i < ordered.length; i++) {
      const before = ordered[i - 1];
      const after = ordered[i];

      const changed = (Object.keys(minDelta) as LearnableSetting[]).filter((setting) => {
        const from = before.settings[setting];
        const to = after.settings[setting];
        return from !== undefined && to !== undefined && from !== to;
      });

      // Exactly one setting moved, by enough to be meaningful.
      if (changed.length !== 1) continue;
      const setting = changed[0];
      const settingDelta = (after.settings[setting] ?? 0) - (before.settings[setting] ?? 0);
      if (Math.abs(settingDelta) < minDelta[setting]) continue;

      const metric = SETTING_METRIC[setting];
      observations.push({
        setting,
        component: before.component,
        settingDelta,
        metricDelta: round(after.metrics[metric] - before.metrics[metric], 3),
        metric,
        fromSessionId: before.sessionId,
        toSessionId: after.sessionId,
      });
    }
  }

  return observations;
}

/**
 * Average the observations into a response rate per setting.
 *
 * Observations whose sign disagrees are dropped rather than averaged towards
 * zero: a contradiction means something else was changing too, and a
 * near-zero rate would later be inverted into an absurd step size.
 */
export function estimateSensitivities(observations: Observation[]): Sensitivity[] {
  const groups = new Map<string, Observation[]>();
  for (const observation of observations) {
    const key = `${observation.setting}:${observation.component}`;
    const group = groups.get(key) ?? [];
    group.push(observation);
    groups.set(key, group);
  }

  const out: Sensitivity[] = [];
  for (const group of groups.values()) {
    const rates = group.map((o) => o.metricDelta / o.settingDelta);
    const positive = rates.filter((r) => r > 0).length;
    const negative = rates.filter((r) => r < 0).length;

    // Keep only the majority direction; a tie tells us nothing.
    if (positive === negative) continue;
    const keepPositive = positive > negative;
    const kept = rates.filter((r) => (keepPositive ? r > 0 : r < 0));
    if (kept.length === 0) continue;

    const perUnit = kept.reduce((sum, r) => sum + r, 0) / kept.length;
    if (!Number.isFinite(perUnit) || perUnit === 0) continue;

    out.push({
      setting: group[0].setting,
      component: group[0].component,
      metric: group[0].metric,
      perUnit: round(perUnit, 4),
      samples: kept.length,
    });
  }

  return out;
}

/** Look up a learned rate, if the history supports one. */
export function findSensitivity(
  sensitivities: Sensitivity[],
  setting: LearnableSetting,
  component: SuspensionComponent,
): Sensitivity | null {
  return (
    sensitivities.find((s) => s.setting === setting && s.component === component) ?? null
  );
}

/**
 * Everything the learner derived, ready for the engine and for the UI that
 * explains where a number came from.
 */
export interface SetupLearning {
  observations: Observation[];
  sensitivities: Sensitivity[];
}

export function learnFromHistory(
  runs: Array<{ session: Session | SessionMeta; report: AnalysisReport }>,
  options: LearningOptions = {},
): SetupLearning {
  const points = runs.flatMap(({ session, report }) => runPoints(session, report));
  const observations = findObservations(points, options);
  return { observations, sensitivities: estimateSensitivities(observations) };
}
