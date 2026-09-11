import type {
  BikeConfig,
  PositionReading,
  SagAdvice,
  SagChannelResult,
  SagMeasurement,
  SuspensionComponent,
  SuspensionConfig,
  Verdict,
} from '@/types';
import type { StyleProfile, Tunables } from '../tunables';
import { DEFAULT_TUNABLES } from '../tunables';
import { clamp, mean, round } from '../metrics/signal';
import { changeFor, expectFor, howToFor } from '../recommendations/practical';

/**
 * Static sag: measurement, verdict and advice.
 *
 * Pure and synchronous like the rest of the engine. It takes the position
 * samples the transport collected and knows nothing about how they were read,
 * so it is reusable unchanged by a future native app.
 */

export class SagUnstableError extends Error {
  constructor(readonly spreadMm: number) {
    super(`Lettura instabile: ${spreadMm.toFixed(1)} mm di oscillazione`);
    this.name = 'SagUnstableError';
  }
}

function unitFor(bike: BikeConfig, component: SuspensionComponent): SuspensionConfig | null {
  if (component === 'front') return bike.frontSuspension;
  return bike.rearSuspension.present ? bike.rearSuspension : null;
}

/** Sag is judged the same way travel is: inside the band, or how far outside. */
function verdictFor(sagPct: number, [min, max]: [number, number]): Verdict {
  if (sagPct < min) return sagPct < min - 5 ? 'too-stiff' : 'slightly-stiff';
  if (sagPct > max) return sagPct > max + 5 ? 'too-soft' : 'slightly-soft';
  return 'correct';
}

/** Peak-to-peak spread of the samples: the honest measure of "did they hold still". */
export function stability(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.max(...values) - Math.min(...values);
}

export interface SagOptions {
  tunables?: Tunables;
}

/**
 * Turn a set of position readings into a sag measurement.
 *
 * Throws `SagUnstableError` when the rider moved during the hold: a sag figure
 * taken while the bike is rocking is worse than no figure at all, because it
 * looks just as authoritative.
 */
export function computeSag(
  readings: PositionReading[],
  bike: BikeConfig,
  options: SagOptions = {},
): SagMeasurement {
  const tunables = options.tunables ?? DEFAULT_TUNABLES;
  const style = tunables.styles[bike.rider.style] ?? DEFAULT_TUNABLES.styles.balanced;

  if (readings.length === 0) throw new SagUnstableError(0);

  const frontValues = readings.map((r) => r.frontMm);
  const rearValues = readings
    .map((r) => r.rearMm)
    .filter((v): v is number => v !== null);

  const spread = Math.max(
    stability(frontValues),
    rearValues.length > 0 ? stability(rearValues) : 0,
  );
  if (spread > tunables.sagStabilityMaxMm) throw new SagUnstableError(spread);

  const channels: SagChannelResult[] = [
    channelResult('front', mean(frontValues), bike, style),
  ];

  // The rear channel appears only when the bike has a shock and the device
  // actually reported that channel.
  if (bike.rearSuspension.present && rearValues.length > 0) {
    channels.push(channelResult('rear', mean(rearValues), bike, style));
  }

  return {
    bikeId: bike.id,
    at: new Date().toISOString(),
    channels,
    stabilityMm: round(spread, 2),
  };
}

function channelResult(
  component: SuspensionComponent,
  sagMm: number,
  bike: BikeConfig,
  style: StyleProfile,
): SagChannelResult {
  const unit = unitFor(bike, component);
  const totalTravelMm = unit?.totalTravelMm ?? 0;
  const sagPct = totalTravelMm > 0 ? clamp((sagMm / totalTravelMm) * 100, 0, 100) : 0;
  const targetPct = style.sagPct[component];

  return {
    component,
    sagMm: round(sagMm, 1),
    sagPct: round(sagPct, 1),
    targetPct,
    verdict: verdictFor(sagPct, targetPct),
  };
}

const NAME: Record<SuspensionComponent, string> = { front: 'forcella', rear: 'posteriore' };
const OF: Record<SuspensionComponent, string> = {
  front: 'alla forcella',
  rear: 'al posteriore',
};

/**
 * Concrete advice for a sag that is out of band.
 *
 * Obeys the same hard rule as the run recommendations: never propose an
 * adjuster the configured suspension does not have.
 */
export function sagAdvice(
  measurement: SagMeasurement,
  bike: BikeConfig,
  tunables: Tunables = DEFAULT_TUNABLES,
): SagAdvice[] {
  const advice: SagAdvice[] = [];

  /** Derive the practical half once, so no branch can omit it. */
  const add = (
    partial: Omit<SagAdvice, 'change' | 'howTo' | 'expect'>,
    unit: SuspensionConfig,
  ) => {
    advice.push({
      ...partial,
      change: changeFor(partial.action, unit),
      howTo: howToFor(partial.action),
      expect: expectFor(partial.action),
    });
  };

  for (const channel of measurement.channels) {
    if (channel.verdict === 'correct' || channel.verdict === 'unknown') continue;
    const unit = unitFor(bike, channel.component);
    if (!unit) continue;

    const tooSoft = channel.verdict === 'too-soft' || channel.verdict === 'slightly-soft';
    // Distance back to the nearest edge of the band, in points of travel.
    const errorPoints = tooSoft
      ? channel.sagPct - channel.targetPct[1]
      : channel.targetPct[0] - channel.sagPct;
    const observed = `Il sag ${
      channel.component === 'front' ? 'della forcella' : 'del posteriore'
    } è al ${channel.sagPct}%, fuori dall'intervallo ${channel.targetPct[0]}–${channel.targetPct[1]}% dello stile scelto.`;

    if (unit.springType === 'air' && unit.pressurePsi !== undefined) {
      const step = clamp(
        Math.round(Math.abs(errorPoints) * tunables.psiPerTravelPoint[channel.component]),
        1,
        tunables.maxPsiStep[channel.component],
      );
      add(
        {
          component: channel.component,
          action: {
            kind: 'pressure',
            component: channel.component,
            deltaPsi: tooSoft ? step : -step,
          },
          title: `${tooSoft ? 'Aggiungi' : 'Togli'} ${step} PSI ${OF[channel.component]}`,
          rationale: `${observed} La pressione è la regolazione che sposta direttamente il sag.`,
        },
        unit,
      );
      continue;
    }

    if (unit.preload?.available) {
      const turns = clamp(Math.round(Math.abs(errorPoints) / 4), 1, 3) * 0.5;
      add(
        {
          component: channel.component,
          action: {
            kind: 'preload',
            component: channel.component,
            deltaTurns: tooSoft ? turns : -turns,
          },
          title: `${tooSoft ? 'Aumenta' : 'Riduci'} il precarico ${OF[channel.component]} di ${turns} giri`,
          rationale: `${observed} Il precarico alza o abbassa la bici senza cambiare la durezza della molla.`,
        },
        unit,
      );
      continue;
    }

    if (unit.springType === 'coil') {
      add(
        {
          component: channel.component,
          action: {
            kind: 'spring-rate',
            component: channel.component,
            direction: tooSoft ? 'stiffer' : 'softer',
          },
          title: `Valuta una molla più ${tooSoft ? 'dura' : 'morbida'} sul ${NAME[channel.component]}`,
          rationale: `${observed} Senza precarico regolabile, il sag si corregge solo cambiando molla.`,
        },
        unit,
      );
      continue;
    }

    // Nothing adjustable: say so rather than invent a knob.
    add(
      {
        component: channel.component,
        action: { kind: 'explain', component: channel.component },
        title: `Il sag ${OF[channel.component]} è fuori intervallo`,
        rationale: `${observed} Questa sospensione non ha regolazioni che permettano di correggerlo.`,
      },
      unit,
    );
  }

  return advice;
}
