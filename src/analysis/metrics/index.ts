import type { BikeConfig, ComponentMetrics, RawSample, SessionMetrics, BalanceMetrics } from '@/types';
import type { Tunables } from '../tunables';
import { computeTravel } from './travel';
import { computeVelocity } from './velocity';

export * from './signal';
export * from './travel';
export * from './velocity';

function componentMetrics(
  component: 'front' | 'rear',
  positionsMm: number[],
  timestampsMs: number[],
  totalTravelMm: number,
  tunables: Tunables,
): ComponentMetrics {
  const travel = computeTravel(positionsMm, timestampsMs, totalTravelMm, tunables);
  const { velocity, compressionEvents } = computeVelocity(
    positionsMm,
    timestampsMs,
    totalTravelMm,
    tunables,
  );
  return { component, totalTravelMm, ...travel, velocity, compressionEvents };
}

function balanceMetrics(front: ComponentMetrics, rear: ComponentMetrics): BalanceMetrics {
  return {
    travelUseRatio: rear.maxTravelPct > 0 ? front.maxTravelPct / rear.maxTravelPct : 0,
    travelUseDeltaPct: front.maxTravelPct - rear.maxTravelPct,
    bottomOutDelta: front.bottomOutCount - rear.bottomOutCount,
    reboundDeltaSec: front.velocity.meanRecoveryTimeSec - rear.velocity.meanRecoveryTimeSec,
    rideHeightDeltaPct: front.rideHeightPct - rear.rideHeightPct,
  };
}

/** Compute every metric for one run. Pure: no I/O, no React, no globals. */
export function computeMetrics(
  samples: RawSample[],
  bike: BikeConfig,
  tunables: Tunables,
): SessionMetrics {
  const timestamps = samples.map((s) => s.t);
  const durationSec = samples.length > 1 ? (samples[samples.length - 1].t - samples[0].t) / 1000 : 0;

  const front = componentMetrics(
    'front',
    samples.map((s) => s.frontMm),
    timestamps,
    bike.frontSuspension.totalTravelMm,
    tunables,
  );

  // The rear branch disappears entirely on a hardtail, and also when the
  // device recorded no rear channel even though the bike has a shock.
  const hasRearData = samples.some((s) => s.rearMm !== null);
  const rear =
    bike.rearSuspension.present && hasRearData
      ? componentMetrics(
          'rear',
          samples.map((s) => s.rearMm ?? 0),
          timestamps,
          bike.rearSuspension.totalTravelMm,
          tunables,
        )
      : null;

  return {
    front,
    rear,
    balance: rear ? balanceMetrics(front, rear) : null,
    durationSec,
    sampleCount: samples.length,
  };
}
