import type {
  BikeConfig,
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

const NAME: Record<SuspensionComponent, string> = { front: 'forcella', rear: 'posteriore' };

const hasPressure = (u: SuspensionConfig) => u.springType === 'air' && u.pressurePsi !== undefined;
const hasPreload = (u: SuspensionConfig) => u.preload?.available === true;

/** Spring-side fix: pressure if the unit is air, preload if coil, else explain. */
function springAction(
  unit: SuspensionConfig,
  component: SuspensionComponent,
  direction: 'softer' | 'stiffer',
  travelErrorPoints: number,
  tunables: Tunables,
): { action: RecommendationAction; title: string } {
  if (hasPressure(unit)) {
    const step = clamp(
      Math.round(Math.abs(travelErrorPoints) * tunables.psiPerTravelPoint[component]),
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
    };
  }

  // Coil unit with no preload adjuster: the honest answer is a different spring.
  if (unit.springType === 'coil') {
    return {
      action: { kind: 'spring-rate', component, direction },
      title: `Valuta una molla più ${direction === 'stiffer' ? 'dura' : 'morbida'} sul ${NAME[component]}`,
    };
  }

  return {
    action: { kind: 'explain', component },
    title: `Il ${NAME[component]} lavora fuori range, ma non ha regolazioni disponibili`,
  };
}

/** Rebound fix: only when the unit exposes a rebound adjuster. */
function reboundAction(
  unit: SuspensionConfig,
  component: SuspensionComponent,
  direction: 'slower' | 'faster',
  errorSec: number,
  tunables: Tunables,
): { action: RecommendationAction; title: string } | null {
  if (!unit.rebound.available) return null;
  const clicks = clamp(Math.round(Math.abs(errorSec) / tunables.secPerReboundClick), 1, 4);
  // Closing clicks slows the rebound down; opening speeds it up.
  const delta = direction === 'slower' ? clicks : -clicks;
  return {
    action: { kind: 'rebound', component, deltaClicks: delta },
    title:
      direction === 'slower'
        ? `Chiudi il rebound ${component === 'front' ? 'della forcella' : 'del posteriore'} di ${clicks} click`
        : `Apri il rebound ${component === 'front' ? 'della forcella' : 'del posteriore'} di ${clicks} click`,
  };
}

function compressionAction(
  unit: SuspensionConfig,
  component: SuspensionComponent,
): { action: RecommendationAction; title: string } | null {
  if (!unit.compression.available) return null;
  return {
    action: { kind: 'compression', component, deltaClicks: 1 },
    title: `Chiudi la compressione ${component === 'front' ? 'della forcella' : 'del posteriore'} di 1 click`,
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
}

export function buildRecommendations(
  diagnoses: Diagnosis[],
  ctx: RecommendationContext,
): Recommendation[] {
  const out: Recommendation[] = [];
  const seen = new Set<string>();

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
        const { action, title } = springAction(unit, component, 'softer', error, ctx.tunables);
        push({
          id: '',
          priority,
          action,
          title,
          rationale: `${d.description} Ammorbidire il ${NAME[component]} gli permette di usare più corsa e di copiare meglio il terreno.`,
          causes: [d.id],
        });
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
        const { action, title } = springAction(unit, component, 'stiffer', error, ctx.tunables);
        push({
          id: '',
          priority,
          action,
          title,
          rationale: `${d.description} Irrigidire il ${NAME[component]} recupera margine sul finale di corsa.`,
          causes: [d.id],
        });

        // When there is no spring-side knob left, low-speed compression is the
        // next best lever, if the unit has it.
        if (action.kind === 'explain') {
          const comp = compressionAction(unit, component);
          if (comp) {
            push({
              id: '',
              priority: priority - 0.1,
              action: comp.action,
              title: comp.title,
              rationale: `Senza regolazioni sulla molla, un click di compressione in più sostiene il ${NAME[component]} a metà corsa.`,
              causes: [d.id],
            });
          }
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
          push({
            id: '',
            priority,
            action: rec.action,
            title: rec.title,
            rationale: `${d.description} Il rebound controlla la velocità con cui la sospensione torna estesa.`,
            causes: [d.id],
          });
        } else {
          push({
            id: '',
            priority: priority - 0.5,
            action: { kind: 'explain', component },
            title: `Il ritorno del ${NAME[component]} è fuori range`,
            rationale: `${d.description} Questa sospensione non ha una regolazione del rebound, quindi non c'è una modifica da fare.`,
            causes: [d.id],
          });
        }
        break;
      }

      default:
        break;
    }
  }

  return out.sort((a, b) => b.priority - a.priority);
}
