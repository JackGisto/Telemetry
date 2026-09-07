import type {
  BikeConfig,
  ComponentMetrics,
  Diagnosis,
  SessionMetrics,
  Severity,
  SuspensionComponent,
} from '@/types';
import type { StyleProfile, Tunables, TravelWindow } from '../tunables';
import { clamp, round } from '../metrics/signal';

export interface DiagnosticContext {
  metrics: SessionMetrics;
  bike: BikeConfig;
  style: StyleProfile;
  tunables: Tunables;
  /** 0..1 multiplier applied to every confidence, from run length / quality. */
  baseConfidence: number;
}

const LABEL: Record<SuspensionComponent, string> = { front: 'La forcella', rear: 'Il posteriore' };

/**
 * Turn "how far outside the target band" into a severity.
 * `error` is expressed in the same unit as the band itself.
 */
function severityFromError(error: number, scale: number): Severity {
  const ratio = Math.abs(error) / scale;
  if (ratio < 0.4) return 'info';
  if (ratio < 1) return 'minor';
  if (ratio < 2) return 'moderate';
  return 'major';
}

/** Distance outside a [min, max] band; 0 when inside. */
export function bandError(value: number, [min, max]: [number, number]): number {
  if (value < min) return value - min;
  if (value > max) return value - max;
  return 0;
}

function confidence(base: number, error: number, scale: number): number {
  return round(clamp(base * clamp(0.5 + Math.abs(error) / (scale * 2), 0, 1), 0, 1), 2);
}

function windowFor(style: StyleProfile, component: SuspensionComponent): TravelWindow {
  return component === 'front' ? style.front : style.rear;
}

/** Travel-usage rules: is the unit using the right amount of its stroke? */
function travelRules(m: ComponentMetrics, ctx: DiagnosticContext): Diagnosis[] {
  const out: Diagnosis[] = [];
  const win = windowFor(ctx.style, m.component);
  const label = LABEL[m.component];

  const maxErr = bandError(m.maxTravelPct, win.maxTravelPct);
  if (maxErr < 0) {
    out.push({
      id: 'insufficient-travel-use',
      component: m.component,
      severity: severityFromError(maxErr, 6),
      confidence: confidence(ctx.baseConfidence, maxErr, 6),
      metric: 'maxTravelPct',
      metricValue: round(m.maxTravelPct, 1),
      threshold: win.maxTravelPct[0],
      description: `${label} ha usato solo il ${Math.round(m.maxTravelPct)}% della corsa. Sta lavorando in modo troppo rigido per lo stile scelto.`,
    });
  } else if (maxErr > 0) {
    out.push({
      id: 'excessive-travel-use',
      component: m.component,
      severity: severityFromError(maxErr, 4),
      confidence: confidence(ctx.baseConfidence, maxErr, 4),
      metric: 'maxTravelPct',
      metricValue: round(m.maxTravelPct, 1),
      threshold: win.maxTravelPct[1],
      description: `${label} arriva molto vicino a fine corsa. Sta lavorando in modo troppo morbido.`,
    });
  }

  const meanErr = bandError(m.meanTravelPct, win.meanTravelPct);
  if (meanErr < 0) {
    out.push({
      id: 'suspension-riding-high',
      component: m.component,
      severity: severityFromError(meanErr, 4),
      confidence: confidence(ctx.baseConfidence, meanErr, 4),
      metric: 'meanTravelPct',
      metricValue: round(m.meanTravelPct, 1),
      threshold: win.meanTravelPct[0],
      description: `${label} resta alto nella corsa: assorbe poco le asperità piccole.`,
    });
  } else if (meanErr > 0) {
    out.push({
      id: 'suspension-riding-low',
      component: m.component,
      severity: severityFromError(meanErr, 4),
      confidence: confidence(ctx.baseConfidence, meanErr, 4),
      metric: 'meanTravelPct',
      metricValue: round(m.meanTravelPct, 1),
      threshold: win.meanTravelPct[1],
      description: `${label} viaggia affondato nella corsa e ha poco margine sui colpi forti.`,
    });
  }

  return out;
}

/** Bottom-out rules: how often, and how long, the unit sits at the end. */
function bottomOutRules(m: ComponentMetrics, ctx: DiagnosticContext): Diagnosis[] {
  const out: Diagnosis[] = [];
  const win = windowFor(ctx.style, m.component);
  const label = LABEL[m.component];
  const minutes = Math.max(ctx.metrics.durationSec / 60, 1 / 60);
  const perMin = m.bottomOutCount / minutes;

  const err = bandError(perMin, win.bottomOutPerMin);
  if (err > 0) {
    out.push({
      id: 'frequent-bottom-out',
      component: m.component,
      severity: severityFromError(err, 0.8),
      confidence: confidence(ctx.baseConfidence, err, 0.8),
      metric: 'bottomOutPerMin',
      metricValue: round(perMin, 2),
      threshold: win.bottomOutPerMin[1],
      description: `${label} è arrivato a fondo corsa ${m.bottomOutCount} volte: troppe per una guida ${ctx.style.label.toLowerCase()}.`,
    });
  }

  if (m.timeNearBottom > ctx.tunables.timeNearBottomMax) {
    const e = m.timeNearBottom - ctx.tunables.timeNearBottomMax;
    out.push({
      id: 'excessive-time-near-bottom',
      component: m.component,
      severity: severityFromError(e, 0.04),
      confidence: confidence(ctx.baseConfidence, e, 0.04),
      metric: 'timeNearBottom',
      metricValue: round(m.timeNearBottom, 3),
      threshold: ctx.tunables.timeNearBottomMax,
      description: `${label} passa il ${Math.round(m.timeNearBottom * 100)}% del tempo a fine corsa, non solo sui colpi più forti.`,
    });
  }

  return out;
}

/** Rebound rules, driven by recovery time rather than peak velocity. */
function reboundRules(m: ComponentMetrics, ctx: DiagnosticContext): Diagnosis[] {
  const out: Diagnosis[] = [];
  const label = LABEL[m.component];
  const recovery = m.velocity.meanRecoveryTimeSec;
  // No usable compression events means no opinion on rebound.
  if (recovery <= 0 || m.compressionEvents < 3) return out;

  const err = bandError(recovery, ctx.style.recoveryTimeSec);
  if (err < 0) {
    out.push({
      id: 'rebound-too-fast',
      component: m.component,
      severity: severityFromError(err, 0.06),
      confidence: confidence(ctx.baseConfidence, err, 0.06),
      metric: 'meanRecoveryTimeSec',
      metricValue: round(recovery, 3),
      threshold: ctx.style.recoveryTimeSec[0],
      description: `${label} ritorna troppo in fretta dopo i colpi: la bici tende a rimbalzare.`,
    });
  } else if (err > 0) {
    out.push({
      id: 'rebound-too-slow',
      component: m.component,
      severity: severityFromError(err, 0.06),
      confidence: confidence(ctx.baseConfidence, err, 0.06),
      metric: 'meanRecoveryTimeSec',
      metricValue: round(recovery, 3),
      threshold: ctx.style.recoveryTimeSec[1],
      description: `${label} ritorna lentamente e sui tratti veloci rischia di restare affondato.`,
    });
  }

  return out;
}

/**
 * Damping rules read from the speed-split distribution.
 *
 * These separate what a single "compression" verdict cannot: a suspension can
 * be perfectly supported under rider input and still be harsh over sharp
 * impacts, because the two are governed by different circuits.
 */
function dampingRules(m: ComponentMetrics, ctx: DiagnosticContext): Diagnosis[] {
  const out: Diagnosis[] = [];
  const label = LABEL[m.component];
  const v = m.velocity;
  // Too little movement to say anything about damping.
  if (m.compressionEvents < 5) return out;

  const hsc = v.highSpeedCompression.fraction;
  if (hsc > ctx.tunables.highSpeedCompressionMax) {
    const error = hsc - ctx.tunables.highSpeedCompressionMax;
    out.push({
      id: 'harsh-on-impacts',
      component: m.component,
      severity: severityFromError(error, 0.07),
      confidence: confidence(ctx.baseConfidence, error, 0.07),
      metric: 'highSpeedCompressionFraction',
      metricValue: round(hsc, 3),
      threshold: ctx.tunables.highSpeedCompressionMax,
      description: `${label} affronta molti colpi secchi ad alta velocità di stelo: sui tratti rotti risulta dura.`,
    });
  }

  const lsr = v.lowSpeedRebound.fraction;
  const reboundTotal = lsr + v.highSpeedRebound.fraction;
  if (reboundTotal > 0.1 && lsr / reboundTotal < ctx.tunables.lowSpeedReboundMin) {
    const error = ctx.tunables.lowSpeedReboundMin - lsr / reboundTotal;
    out.push({
      id: 'packing-down',
      component: m.component,
      severity: severityFromError(error, 0.1),
      confidence: confidence(ctx.baseConfidence, error, 0.1),
      metric: 'lowSpeedReboundShare',
      metricValue: round(lsr / reboundTotal, 3),
      threshold: ctx.tunables.lowSpeedReboundMin,
      description: `${label} non fa in tempo a riestendersi tra un colpo e l'altro e si siede progressivamente nella corsa.`,
    });
  }

  return out;
}

/**
 * Dynamic ride height.
 *
 * Only the "sitting too deep" case is reported here. Riding high is already
 * covered by the mean-travel rule, and raising it twice from two signals would
 * just double the same advice.
 */
function rideHeightRules(m: ComponentMetrics, ctx: DiagnosticContext): Diagnosis[] {
  if (m.compressionEvents < 5) return [];
  const error = bandError(m.rideHeightPct, ctx.style.rideHeightPct);
  if (error <= 0) return [];

  return [
    {
      id: 'lacks-low-speed-support',
      component: m.component,
      severity: severityFromError(error, 5),
      confidence: confidence(ctx.baseConfidence, error, 5),
      metric: 'rideHeightPct',
      metricValue: round(m.rideHeightPct, 1),
      threshold: ctx.style.rideHeightPct[1],
      description: `${LABEL[m.component]} viaggia seduto al ${Math.round(m.rideHeightPct)}% della corsa: manca sostegno alle basse velocità e la bici perde geometria.`,
    },
  ];
}

/** System-level rules: front against rear. */
function balanceRules(ctx: DiagnosticContext): Diagnosis[] {
  const { balance } = ctx.metrics;
  if (!balance) return [];
  const out: Diagnosis[] = [];

  const delta = balance.travelUseDeltaPct;
  if (Math.abs(delta) > ctx.tunables.imbalanceDeltaPct) {
    const soft = delta > 0 ? "L'anteriore" : 'Il posteriore';
    const firm = delta > 0 ? 'il posteriore' : "l'anteriore";
    out.push({
      id: 'front-rear-imbalance',
      component: 'system',
      severity: severityFromError(Math.abs(delta) - ctx.tunables.imbalanceDeltaPct, 8),
      confidence: confidence(
        ctx.baseConfidence,
        Math.abs(delta) - ctx.tunables.imbalanceDeltaPct,
        8,
      ),
      metric: 'travelUseDeltaPct',
      metricValue: round(delta, 1),
      threshold: ctx.tunables.imbalanceDeltaPct,
      description: `${soft} usa molta più corsa di ${firm}: le due sospensioni non lavorano insieme.`,
    });
  }

  const reboundDelta = balance.reboundDeltaSec;
  if (Math.abs(reboundDelta) > ctx.tunables.imbalanceReboundSec) {
    const slower = reboundDelta > 0 ? 'la forcella' : 'il posteriore';
    out.push({
      id: 'front-rear-imbalance',
      component: 'system',
      severity: severityFromError(
        Math.abs(reboundDelta) - ctx.tunables.imbalanceReboundSec,
        0.08,
      ),
      confidence: confidence(
        ctx.baseConfidence,
        Math.abs(reboundDelta) - ctx.tunables.imbalanceReboundSec,
        0.08,
      ),
      metric: 'reboundDeltaSec',
      metricValue: round(reboundDelta, 3),
      threshold: ctx.tunables.imbalanceReboundSec,
      description: `I due ritorni non sono allineati: ${slower} rientra sensibilmente più lentamente dell'altra sospensione.`,
    });
  }

  return out;
}

/**
 * Style-coherence rule: the run as a whole does not look like the style the
 * rider selected. Fires only when several travel rules already agree, so it
 * summarises rather than duplicates.
 */
function styleRule(found: Diagnosis[], ctx: DiagnosticContext): Diagnosis[] {
  const offending = found.filter(
    (d) =>
      d.severity === 'moderate' ||
      (d.severity === 'major' && d.id !== 'inconsistent-with-style'),
  );
  if (offending.length < 2) return [];
  return [
    {
      id: 'inconsistent-with-style',
      component: 'system',
      severity: 'moderate',
      confidence: round(clamp(ctx.baseConfidence * 0.8, 0, 1), 2),
      metric: 'styleMismatchCount',
      metricValue: offending.length,
      threshold: 2,
      description: `Il comportamento della bici non corrisponde allo stile "${ctx.style.label}" che hai scelto.`,
    },
  ];
}

/** Run every rule and return the diagnoses, worst first. */
export function runDiagnostics(ctx: DiagnosticContext): Diagnosis[] {
  const perComponent = (m: ComponentMetrics) => [
    ...travelRules(m, ctx),
    ...bottomOutRules(m, ctx),
    ...reboundRules(m, ctx),
    ...dampingRules(m, ctx),
    ...rideHeightRules(m, ctx),
  ];

  const found = [
    ...perComponent(ctx.metrics.front),
    ...(ctx.metrics.rear ? perComponent(ctx.metrics.rear) : []),
    ...balanceRules(ctx),
  ].filter((d) => d.severity !== 'info');

  const all = [...found, ...styleRule(found, ctx)];
  const order: Record<Severity, number> = { major: 3, moderate: 2, minor: 1, info: 0 };
  return all.sort(
    (a, b) => order[b.severity] - order[a.severity] || b.confidence - a.confidence,
  );
}
