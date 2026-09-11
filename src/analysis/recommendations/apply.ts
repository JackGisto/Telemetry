import type { BikeConfig, Recommendation, SuspensionConfig } from '@/types';

/**
 * Write a recommendation's change into the bike setup.
 *
 * This is what closes the loop. The rider makes the adjustment on the bike and
 * taps a button; the stored setup moves with it, so the next run's snapshot is
 * accurate, the comparison screen shows what actually changed, and the learner
 * gets a clean pair of runs to measure. Without it the rider has to remember to
 * edit the setup by hand, and in practice they will not.
 *
 * Pure: takes a config, returns a new one. Nothing is persisted here.
 */
export function applyRecommendation(
  bike: BikeConfig,
  recommendation: Recommendation,
): BikeConfig {
  const action = recommendation.action;
  if (action.kind === 'explain' || action.kind === 'spring-rate') return bike;
  const now = new Date().toISOString();

  if (action.component === 'front') {
    const updated = applyToUnit(bike.frontSuspension, recommendation);
    return updated === bike.frontSuspension
      ? bike
      : { ...bike, frontSuspension: updated, updatedAt: now };
  }

  // A hardtail has no rear unit to write to, and the guard keeps the narrowing
  // explicit rather than relying on a cast.
  if (!bike.rearSuspension.present) return bike;
  const rear = bike.rearSuspension;
  const updated = applyToUnit(rear, recommendation);
  return updated === rear
    ? bike
    : { ...bike, rearSuspension: { ...updated, present: true }, updatedAt: now };
}

function applyToUnit(unit: SuspensionConfig, recommendation: Recommendation): SuspensionConfig {
  const action = recommendation.action;
  // Prefer the computed target: it is already clamped to the adjuster's range.
  const target = recommendation.change?.to;

  switch (action.kind) {
    case 'pressure': {
      if (unit.pressurePsi === undefined) return unit;
      return { ...unit, pressurePsi: target ?? Math.max(0, unit.pressurePsi + action.deltaPsi) };
    }

    case 'preload': {
      if (!unit.preload?.available || unit.preload.turns === undefined) return unit;
      return {
        ...unit,
        preload: {
          available: true,
          turns: target ?? Math.max(0, unit.preload.turns + action.deltaTurns),
        },
      };
    }

    case 'rebound':
    case 'compression': {
      const high = action.circuit === 'high-speed';
      const key = action.kind === 'rebound'
        ? (high ? 'highSpeedRebound' : 'rebound')
        : (high ? 'highSpeedCompression' : 'compression');
      const adjuster = unit[key];
      if (!adjuster?.available || adjuster.clicks === undefined) return unit;

      const next = target ?? Math.max(0, adjuster.clicks + action.deltaClicks);
      const capped =
        adjuster.totalClicks !== undefined ? Math.min(next, adjuster.totalClicks) : next;
      return { ...unit, [key]: { ...adjuster, clicks: capped } };
    }

    default:
      return unit;
  }
}

/** True when the change can actually be written back to the setup. */
export function isApplicable(bike: BikeConfig, recommendation: Recommendation): boolean {
  return applyRecommendation(bike, recommendation) !== bike;
}
