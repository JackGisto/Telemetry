import type {
  BikeConfig,
  ClickAdjuster,
  DampingCircuit,
  Diagnosis,
  Recommendation,
  RecommendationAction,
  SessionMetrics,
  SuspensionComponent,
  SuspensionConfig,
} from '@/types';
import type { StyleProfile, Tunables } from '../tunables';
import { clamp, round } from '../metrics/signal';
import { bandError } from '../diagnostics';
import { changeFor, expectFor, howToFor } from './practical';
import { findSensitivity, type Sensitivity } from '../learning';

/**
 * Turns diagnoses into concrete adjustments.
 *
 * Hard rule: an adjustment is only ever proposed when the configured suspension
 * actually has that adjuster. When nothing is adjustable we fall back to an
 * `explain` recommendation instead of inventing a knob.
 */

function unitFor(bike: BikeConfig, component: SuspensionComponent): SuspensionConfig | null {
  if (component === 'front') return bike.frontSuspension;
  return bike.rearSuspension.present ? bike.rearSuspension : null;
}

/**
 * Italian needs the article to agree with the noun's gender: "forcella" is
 * feminine, "posteriore" masculine. Storing the inflected forms keeps the
 * generated sentences grammatical instead of producing "il forcella".
 */
/** With the definite article: subject position. */
const THE: Record<SuspensionComponent, string> = {
  front: 'la forcella',
  rear: 'il posteriore',
};
/** After "su". */
const ON: Record<SuspensionComponent, string> = {
  front: 'sulla forcella',
  rear: 'sul posteriore',
};

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const hasPressure = (u: SuspensionConfig) => u.springType === 'air' && u.pressurePsi !== undefined;
const hasPreload = (u: SuspensionConfig) => u.preload?.available === true;

/** Spring-side fix: pressure if the unit is air, preload if coil, else explain. */
function springAction(
  unit: SuspensionConfig,
  component: SuspensionComponent,
  direction: 'softer' | 'stiffer',
  travelErrorPoints: number,
  tunables: Tunables,
  sensitivities?: Sensitivity[],
): { action: RecommendationAction; title: string; learned: boolean } {
  if (hasPressure(unit)) {
    // A measured rate says how many points of travel one PSI actually moves on
    // this bike; invert it to get the PSI needed to close the gap.
    const learned = findSensitivity(sensitivities ?? [], 'pressure', component);
    const psiPerPoint =
      learned && Math.abs(learned.perUnit) > 0.01
        ? 1 / Math.abs(learned.perUnit)
        : tunables.psiPerTravelPoint[component];

    const step = clamp(
      Math.round(Math.abs(travelErrorPoints) * psiPerPoint),
      1,
      tunables.maxPsiStep[component],
    );
    const delta = direction === 'stiffer' ? step : -step;
    return {
      action: { kind: 'pressure', component, deltaPsi: delta },
      title:
        direction === 'stiffer'
          ? `Aggiungi ${step} PSI ${component === 'front' ? 'alla forcella' : 'al posteriore'}`
          : `Togli ${step} PSI ${component === 'front' ? 'alla forcella' : 'al posteriore'}`,
      learned: learned !== null,
    };
  }

  if (hasPreload(unit)) {
    const turns = clamp(Math.round(Math.abs(travelErrorPoints) / 5), 1, 3) * 0.5;
    const delta = direction === 'stiffer' ? turns : -turns;
    return {
      action: { kind: 'preload', component, deltaTurns: delta },
      title:
        direction === 'stiffer'
          ? `Aumenta il precarico ${component === 'front' ? 'della forcella' : 'del posteriore'} di ${turns} giri`
          : `Riduci il precarico ${component === 'front' ? 'della forcella' : 'del posteriore'} di ${turns} giri`,
      learned: false,
    };
  }

  // Coil unit with no preload adjuster: the honest answer is a different spring.
  if (unit.springType === 'coil') {
    return {
      action: { kind: 'spring-rate', component, direction },
      title: `Valuta una molla più ${direction === 'stiffer' ? 'dura' : 'morbida'} ${ON[component]}`,
      learned: false,
    };
  }

  return {
    action: { kind: 'explain', component },
    title: `${capitalise(THE[component])} lavora fuori range, ma non ha regolazioni disponibili`,
    learned: false,
  };
}

const OF: Record<SuspensionComponent, string> = {
  front: 'della forcella',
  rear: 'del posteriore',
};

/** How a circuit is named to the rider, once we know which one we picked. */
const CIRCUIT_LABEL: Record<DampingCircuit, string> = {
  'low-speed': 'alle basse velocità',
  'high-speed': 'alle alte velocità',
  single: '',
};

/**
 * Pick the adjuster that actually controls the behaviour we want to change.
 *
 * A unit with a split circuit gets the specific knob; a unit with a single
 * adjuster gets that one, described without a circuit name so the rider is not
 * sent looking for a dial that is not on their fork. A unit with neither gets
 * nothing, and the caller falls back to explaining.
 */
function pickAdjuster(
  unit: SuspensionConfig,
  kind: 'rebound' | 'compression',
  preferred: DampingCircuit,
): { adjuster: ClickAdjuster; circuit: DampingCircuit } | null {
  const single = kind === 'rebound' ? unit.rebound : unit.compression;
  const high = kind === 'rebound' ? unit.highSpeedRebound : unit.highSpeedCompression;

  if (preferred === 'high-speed' && high?.available) {
    return { adjuster: high, circuit: 'high-speed' };
  }
  if (!single.available) {
    // No base adjuster: the split one is the only option left, whatever we wanted.
    return high?.available ? { adjuster: high, circuit: 'high-speed' } : null;
  }
  // With a split circuit present, the base adjuster is the low-speed one.
  return { adjuster: single, circuit: high?.available ? 'low-speed' : 'single' };
}

function clickTitle(
  verb: string,
  what: string,
  component: SuspensionComponent,
  circuit: DampingCircuit,
  clicks: number,
): string {
  const where = CIRCUIT_LABEL[circuit];
  return `${verb} ${what} ${OF[component]}${where ? ` ${where}` : ''} di ${clicks} click`;
}

/** Rebound fix: only when the unit exposes a matching rebound adjuster. */
function reboundAction(
  unit: SuspensionConfig,
  component: SuspensionComponent,
  direction: 'slower' | 'faster',
  errorSec: number,
  tunables: Tunables,
  preferred: DampingCircuit = 'single',
): { action: RecommendationAction; title: string } | null {
  const picked = pickAdjuster(unit, 'rebound', preferred);
  if (!picked) return null;
  const clicks = clamp(Math.round(Math.abs(errorSec) / tunables.secPerReboundClick), 1, 4);
  // Closing clicks slows the rebound down; opening speeds it up.
  const delta = direction === 'slower' ? clicks : -clicks;
  return {
    action: { kind: 'rebound', component, deltaClicks: delta, circuit: picked.circuit },
    title: clickTitle(
      direction === 'slower' ? 'Chiudi' : 'Apri',
      'il rebound',
      component,
      picked.circuit,
      clicks,
    ),
  };
}

/** Compression fix, aimed at the circuit that governs the observed behaviour. */
function compressionAction(
  unit: SuspensionConfig,
  component: SuspensionComponent,
  direction: 'firmer' | 'softer' = 'firmer',
  clicks = 1,
  preferred: DampingCircuit = 'single',
): { action: RecommendationAction; title: string } | null {
  const picked = pickAdjuster(unit, 'compression', preferred);
  if (!picked) return null;
  const delta = direction === 'firmer' ? clicks : -clicks;
  return {
    action: { kind: 'compression', component, deltaClicks: delta, circuit: picked.circuit },
    title: clickTitle(
      direction === 'firmer' ? 'Chiudi' : 'Apri',
      'la compressione',
      component,
      picked.circuit,
      clicks,
    ),
  };
}

/** severity x confidence, so a confident minor issue can outrank a vague major one. */
const SEVERITY_RANK = { info: 0, minor: 1, moderate: 2, major: 3 } as const;
const priorityOf = (d: Diagnosis) => round(SEVERITY_RANK[d.severity] * d.confidence, 3);

export interface RecommendationContext {
  bike: BikeConfig;
  metrics: SessionMetrics;
  style: StyleProfile;
  tunables: Tunables;
  /**
   * Response rates measured from the rider's own history.
   *
   * When one covers the adjuster in question it replaces the generic constant:
   * a step derived from what this bike actually did beats a step derived from
   * an average of every bike.
   */
  sensitivities?: Sensitivity[];
}

export function buildRecommendations(
  diagnoses: Diagnosis[],
  ctx: RecommendationContext,
): Recommendation[] {
  const out: Recommendation[] = [];
  const seen = new Set<string>();

  /**
   * Fill in the practical fields from the action itself.
   *
   * Derived in one place so no branch above can produce a recommendation
   * without a start value, a how-to and an expected outcome.
   */
  const complete = (
    rec: Omit<Recommendation, 'change' | 'howTo' | 'expect'>,
    unit: SuspensionConfig,
  ): Recommendation => ({
    ...rec,
    change: changeFor(rec.action, unit),
    howTo: howToFor(rec.action),
    expect: expectFor(rec.action),
  });

  const push = (rec: Recommendation) => {
    // One recommendation per (kind, component): merge causes instead of repeating.
    const key = `${rec.action.kind}:${'component' in rec.action ? rec.action.component : 'system'}`;
    const existing = out.find((r) => seen.has(key) && r.id === key);
    if (existing) {
      existing.causes.push(...rec.causes);
      existing.priority = Math.max(existing.priority, rec.priority);
      return;
    }
    seen.add(key);
    out.push({ ...rec, id: key });
  };

  for (const d of diagnoses) {
    if (d.component === 'system') continue;
    const component = d.component;
    const unit = unitFor(ctx.bike, component);
    if (!unit) continue;
    const m = component === 'front' ? ctx.metrics.front : ctx.metrics.rear;
    if (!m) continue;
    const win = component === 'front' ? ctx.style.front : ctx.style.rear;
    const priority = priorityOf(d);

    switch (d.id) {
      case 'insufficient-travel-use':
      case 'suspension-riding-high': {
        const error =
          d.id === 'insufficient-travel-use'
            ? bandError(m.maxTravelPct, win.maxTravelPct)
            : bandError(m.meanTravelPct, win.meanTravelPct);
        const { action, title, learned } = springAction(
          unit,
          component,
          'softer',
          error,
          ctx.tunables,
          ctx.sensitivities,
        );
        push(complete({
          id: '',
          priority,
          action,
          title,
          rationale: `${d.description} Ammorbidire ${THE[component]} ${component === 'front' ? 'le' : 'gli'} permette di usare più corsa e di copiare meglio il terreno.${
            learned ? ' La quantità è calcolata su come la tua bici ha risposto alle modifiche precedenti.' : ''
          }`,
          causes: [d.id],
        }, unit));
        break;
      }

      case 'excessive-travel-use':
      case 'frequent-bottom-out':
      case 'excessive-time-near-bottom':
      case 'suspension-riding-low': {
        const error =
          d.id === 'suspension-riding-low'
            ? bandError(m.meanTravelPct, win.meanTravelPct)
            : Math.max(bandError(m.maxTravelPct, win.maxTravelPct), 4);
        const { action, title, learned } = springAction(
          unit,
          component,
          'stiffer',
          error,
          ctx.tunables,
          ctx.sensitivities,
        );
        push(complete({
          id: '',
          priority,
          action,
          title,
          rationale: `${d.description} Irrigidire ${THE[component]} recupera margine sul finale di corsa.${
            learned ? ' La quantità è calcolata su come la tua bici ha risposto alle modifiche precedenti.' : ''
          }`,
          causes: [d.id],
        }, unit));

        // When there is no spring-side knob left, low-speed compression is the
        // next best lever, if the unit has it.
        if (action.kind === 'explain') {
          const comp = compressionAction(unit, component);
          if (comp) {
            push(complete({
              id: '',
              priority: priority - 0.1,
              action: comp.action,
              title: comp.title,
              rationale: `Senza regolazioni sulla molla, un click di compressione in più sostiene ${THE[component]} a metà corsa.`,
              causes: [d.id],
            }, unit));
          }
        }
        break;
      }

      case 'harsh-on-impacts': {
        // Sharp impacts are the high-speed compression circuit's job.
        const rec = compressionAction(unit, component, 'softer', 2, 'high-speed');
        if (rec) {
          push(complete({
            id: '',
            priority,
            action: rec.action,
            title: rec.title,
            rationale: `${d.description} Aprire la compressione alle alte velocità lascia passare i colpi secchi senza toccare il sostegno in curva.`,
            causes: [d.id],
          }, unit));
        } else {
          push(complete({
            id: '',
            priority: priority - 0.5,
            action: { kind: 'explain', component },
            title: `${capitalise(THE[component])} risulta ${component === 'front' ? 'dura' : 'duro'} sui colpi secchi`,
            rationale: `${d.description} Questa sospensione non ha una regolazione della compressione, quindi la strada resta ammorbidire la molla.`,
            causes: [d.id],
          }, unit));
        }
        break;
      }

      case 'packing-down': {
        // Not recovering between hits is a rebound problem, not a spring one.
        const rec = reboundAction(unit, component, 'faster', 0.12, ctx.tunables, 'low-speed');
        if (rec) {
          push(complete({
            id: '',
            priority,
            action: rec.action,
            title: rec.title,
            rationale: `${d.description} Un ritorno più rapido le permette di riestendersi tra un colpo e l'altro.`,
            causes: [d.id],
          }, unit));
        }
        break;
      }

      case 'lacks-low-speed-support': {
        // Sitting too deep: firm up the low-speed circuit before touching the
        // spring, which would also change how the unit uses the whole stroke.
        const rec = compressionAction(unit, component, 'firmer', 2, 'low-speed');
        if (rec) {
          push(complete({
            id: '',
            priority,
            action: rec.action,
            title: rec.title,
            rationale: `${d.description} Chiudere la compressione alle basse velocità alza la bici senza irrigidirla sui colpi forti.`,
            causes: [d.id],
          }, unit));
        } else {
          const spring = springAction(unit, component, 'stiffer', 5, ctx.tunables, ctx.sensitivities);
          push(complete({
            id: '',
            priority: priority - 0.1,
            action: spring.action,
            title: spring.title,
            rationale: `${d.description} Senza regolazione di compressione, l'unica leva è irrigidire la molla.`,
            causes: [d.id],
          }, unit));
        }
        break;
      }

      case 'rebound-too-fast':
      case 'rebound-too-slow': {
        const errorSec = bandError(m.velocity.meanRecoveryTimeSec, ctx.style.recoveryTimeSec);
        const rec = reboundAction(
          unit,
          component,
          d.id === 'rebound-too-fast' ? 'slower' : 'faster',
          errorSec,
          ctx.tunables,
        );
        if (rec) {
          push(complete({
            id: '',
            priority,
            action: rec.action,
            title: rec.title,
            rationale: `${d.description} Il rebound controlla la velocità con cui la sospensione torna estesa.`,
            causes: [d.id],
          }, unit));
        } else {
          push(complete({
            id: '',
            priority: priority - 0.5,
            action: { kind: 'explain', component },
            title: `Il ritorno ${OF[component]} è fuori range`,
            rationale: `${d.description} Questa sospensione non ha una regolazione del rebound, quindi non c'è una modifica da fare.`,
            causes: [d.id],
          }, unit));
        }
        break;
      }

      default:
        break;
    }
  }

  return out.sort((a, b) => b.priority - a.priority);
}
