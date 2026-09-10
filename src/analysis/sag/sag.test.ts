import { describe, expect, it } from 'vitest';
import type { PositionReading, SuspensionConfig } from '@/types';
import { createDefaultBike, createHardtailBike } from '@/data/defaults';
import { DEFAULT_TUNABLES } from '../tunables';
import { SagUnstableError, computeSag, sagAdvice, stability } from './index';

/** Steady readings at the given fraction of a 160 mm fork and 60 mm shock. */
function readings(frontFraction: number, rearFraction: number | null, jitter = 0.2): PositionReading[] {
  return Array.from({ length: DEFAULT_TUNABLES.sagSampleCount }, (_, i) => ({
    frontMm: 160 * frontFraction + (i % 2 === 0 ? jitter : -jitter),
    rearMm: rearFraction === null ? null : 60 * rearFraction + (i % 2 === 0 ? jitter : -jitter),
  }));
}

describe('misura del sag', () => {
  it('calcola il sag in millimetri e in percentuale per entrambe le sospensioni', () => {
    const measurement = computeSag(readings(0.17, 0.27), createDefaultBike());
    const front = measurement.channels.find((c) => c.component === 'front')!;
    const rear = measurement.channels.find((c) => c.component === 'rear')!;

    expect(front.sagPct).toBeCloseTo(17, 0);
    expect(front.sagMm).toBeCloseTo(27.2, 0);
    expect(rear.sagPct).toBeCloseTo(27, 0);
  });

  it('giudica corretto un sag dentro la banda dello stile scelto', () => {
    const measurement = computeSag(readings(0.17, 0.27), createDefaultBike());
    for (const channel of measurement.channels) expect(channel.verdict).toBe('correct');
    expect(sagAdvice(measurement, createDefaultBike())).toHaveLength(0);
  });

  it('riconosce un sag troppo scarso come sospensione troppo rigida', () => {
    const bike = createDefaultBike();
    const front = computeSag(readings(0.06, 0.27), bike).channels[0];
    expect(front.verdict).toBe('too-stiff');
  });

  it('riconosce un sag eccessivo come sospensione troppo morbida', () => {
    const bike = createDefaultBike();
    const front = computeSag(readings(0.32, 0.27), bike).channels[0];
    expect(front.verdict).toBe('too-soft');
  });

  it('usa bande diverse a seconda dello stile di guida', () => {
    // 24% of fork travel is right for a comfort rider and too much for a racer.
    const comfort = computeSag(readings(0.24, 0.3), createDefaultBike({ rider: { style: 'comfort' } }));
    const aggressive = computeSag(
      readings(0.24, 0.3),
      createDefaultBike({ rider: { style: 'aggressive' } }),
    );
    expect(comfort.channels[0].verdict).toBe('correct');
    expect(aggressive.channels[0].verdict).not.toBe('correct');
  });

  it('rifiuta la misura se il rider si è mosso', () => {
    const wobbly = readings(0.18, 0.27, 8);
    expect(() => computeSag(wobbly, createDefaultBike())).toThrow(SagUnstableError);
    try {
      computeSag(wobbly, createDefaultBike());
    } catch (error) {
      expect((error as SagUnstableError).spreadMm).toBeGreaterThan(
        DEFAULT_TUNABLES.sagStabilityMaxMm,
      );
    }
  });

  it('rifiuta un insieme di letture vuoto', () => {
    expect(() => computeSag([], createDefaultBike())).toThrow(SagUnstableError);
  });

  it('misura il solo canale anteriore su una hardtail', () => {
    const measurement = computeSag(readings(0.17, null), createHardtailBike());
    expect(measurement.channels).toHaveLength(1);
    expect(measurement.channels[0].component).toBe('front');
  });

  it('ignora il canale posteriore se il dispositivo non lo riporta', () => {
    const measurement = computeSag(readings(0.17, null), createDefaultBike());
    expect(measurement.channels.map((c) => c.component)).toEqual(['front']);
  });

  it('riporta l’oscillazione osservata come misura di stabilità', () => {
    expect(stability([10, 12, 11])).toBeCloseTo(2, 6);
    expect(stability([])).toBe(0);
    const measurement = computeSag(readings(0.18, 0.27, 0.5), createDefaultBike());
    expect(measurement.stabilityMm).toBeCloseTo(1, 1);
  });
});

describe('consigli sul sag', () => {
  it('propone PSI su una sospensione ad aria, nella direzione giusta', () => {
    const bike = createDefaultBike();
    const soft = sagAdvice(computeSag(readings(0.32, 0.27), bike), bike);
    const stiff = sagAdvice(computeSag(readings(0.06, 0.27), bike), bike);

    expect(soft[0].action).toMatchObject({ kind: 'pressure', component: 'front' });
    if (soft[0].action.kind === 'pressure') expect(soft[0].action.deltaPsi).toBeGreaterThan(0);
    if (stiff[0].action.kind === 'pressure') expect(stiff[0].action.deltaPsi).toBeLessThan(0);
  });

  it('propone il precarico su una sospensione a molla che lo ha', () => {
    const coil: SuspensionConfig = {
      totalTravelMm: 160,
      springType: 'coil',
      springRateLbIn: 45,
      preload: { available: true, turns: 1 },
      rebound: { available: true, clicks: 8 },
      compression: { available: true, clicks: 8 },
    };
    const bike = createDefaultBike({ frontSuspension: coil });
    const advice = sagAdvice(computeSag(readings(0.32, 0.27), bike), bike);
    expect(advice[0].action.kind).toBe('preload');
  });

  it('suggerisce un’altra molla quando il precarico non c’è', () => {
    const bike = createDefaultBike({
      frontSuspension: {
        totalTravelMm: 160,
        springType: 'coil',
        preload: { available: false },
        rebound: { available: false },
        compression: { available: false },
      },
    });
    const advice = sagAdvice(computeSag(readings(0.32, 0.27), bike), bike);
    expect(advice[0].action.kind).toBe('spring-rate');
  });

  it('non inventa una regolazione su una sospensione ad aria senza pressione nota', () => {
    const bike = createDefaultBike({
      frontSuspension: {
        totalTravelMm: 160,
        springType: 'air',
        rebound: { available: false },
        compression: { available: false },
      },
    });
    const advice = sagAdvice(computeSag(readings(0.32, 0.27), bike), bike);
    expect(advice[0].action.kind).toBe('explain');
  });

  it('non dà consigli sul posteriore di una hardtail', () => {
    const bike = createHardtailBike();
    const advice = sagAdvice(computeSag(readings(0.32, null), bike), bike);
    expect(advice.every((a) => a.component !== 'rear')).toBe(true);
  });

  it('limita la modifica di pressione al passo massimo configurato', () => {
    const bike = createDefaultBike();
    const advice = sagAdvice(computeSag(readings(0.9, 0.9), bike), bike);
    for (const item of advice) {
      if (item.action.kind === 'pressure') {
        expect(Math.abs(item.action.deltaPsi)).toBeLessThanOrEqual(
          DEFAULT_TUNABLES.maxPsiStep[item.action.component],
        );
      }
    }
  });
});
