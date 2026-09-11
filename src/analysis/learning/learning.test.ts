import { describe, expect, it } from 'vitest';
import type { AnalysisReport, BikeConfig, SessionMeta } from '@/types';
import { createDefaultBike, createHardtailBike } from '@/data/defaults';
import {
  estimateSensitivities,
  findObservations,
  findSensitivity,
  learnFromHistory,
  runPoints,
  type RunPoint,
} from './index';

/**
 * The learner turns the rider's own runs into a response rate. These tests pin
 * the attribution rules, because a wrong rate would later be inverted into a
 * confidently wrong step size.
 */

/** A run at a given pressure, whose fork reached a given share of travel. */
function run(
  id: string,
  startedAt: string,
  options: {
    pressure?: number;
    rebound?: number;
    compression?: number;
    maxTravelPct?: number;
    recoveryTimeSec?: number;
    rideHeightPct?: number;
    bottomOutCount?: number;
    durationSec?: number;
    bike?: BikeConfig;
  } = {},
): { session: SessionMeta; report: AnalysisReport } {
  const base = options.bike ?? createDefaultBike({ id: 'bike-1' });
  const setupSnapshot: BikeConfig = {
    ...base,
    frontSuspension: {
      ...base.frontSuspension,
      pressurePsi: options.pressure ?? 75,
      rebound: { ...base.frontSuspension.rebound, clicks: options.rebound ?? 8 },
      compression: { ...base.frontSuspension.compression, clicks: options.compression ?? 10 },
    },
  };

  const component = {
    maxTravelPct: options.maxTravelPct ?? 90,
    rideHeightPct: options.rideHeightPct ?? 20,
    bottomOutCount: options.bottomOutCount ?? 0,
    velocity: { meanRecoveryTimeSec: options.recoveryTimeSec ?? 0.3 },
  };

  return {
    session: {
      id,
      bikeId: setupSnapshot.id,
      startedAt,
      durationSec: options.durationSec ?? 150,
      sampleRateHz: 100,
      setupSnapshot,
      source: 'device',
    },
    report: {
      metrics: {
        front: component,
        rear: null,
        durationSec: options.durationSec ?? 150,
      },
    } as unknown as AnalysisReport,
  };
}

describe('estrazione dei punti da una run', () => {
  it('legge impostazioni e metriche della forcella', () => {
    const { session, report } = run('r1', '2026-01-01T10:00:00Z', { pressure: 80 });
    const points = runPoints(session, report);
    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({
      component: 'front',
      settings: { pressure: 80, rebound: 8, compression: 10 },
    });
  });

  it('non produce punti per il posteriore di una hardtail', () => {
    const { session, report } = run('r1', '2026-01-01T10:00:00Z', {
      bike: createHardtailBike({ id: 'ht' }),
    });
    expect(runPoints(session, report).every((p) => p.component === 'front')).toBe(true);
  });
});

describe('attribuzione di una modifica', () => {
  it('riconosce l’effetto quando è cambiata una sola impostazione', () => {
    const observations = findObservations([
      ...runPoints(
        run('r1', '2026-01-01T10:00:00Z', { pressure: 180, maxTravelPct: 100 }).session,
        run('r1', '2026-01-01T10:00:00Z', { pressure: 180, maxTravelPct: 100 }).report,
      ),
      ...runPoints(
        run('r2', '2026-01-02T10:00:00Z', { pressure: 187, maxTravelPct: 93 }).session,
        run('r2', '2026-01-02T10:00:00Z', { pressure: 187, maxTravelPct: 93 }).report,
      ),
    ]);

    expect(observations).toHaveLength(1);
    expect(observations[0]).toMatchObject({
      setting: 'pressure',
      settingDelta: 7,
      metricDelta: -7,
      metric: 'maxTravelPct',
    });
  });

  it('non attribuisce nulla se sono cambiate due impostazioni insieme', () => {
    // Pressure and rebound both moved: the metric shifted for reasons that
    // cannot be separated, and a guess here would be a confident wrong number.
    const learning = learnFromHistory([
      run('r1', '2026-01-01T10:00:00Z', { pressure: 180, rebound: 8, maxTravelPct: 100 }),
      run('r2', '2026-01-02T10:00:00Z', { pressure: 187, rebound: 6, maxTravelPct: 93 }),
    ]);
    expect(learning.observations).toHaveLength(0);
    expect(learning.sensitivities).toHaveLength(0);
  });

  it('ignora una modifica troppo piccola per essere significativa', () => {
    const learning = learnFromHistory([
      run('r1', '2026-01-01T10:00:00Z', { pressure: 180 }),
      run('r2', '2026-01-02T10:00:00Z', { pressure: 181 }),
    ]);
    expect(learning.observations).toHaveLength(0);
  });

  it('ignora le run troppo brevi, le cui metriche non sono affidabili', () => {
    const learning = learnFromHistory([
      run('r1', '2026-01-01T10:00:00Z', { pressure: 180, durationSec: 20 }),
      run('r2', '2026-01-02T10:00:00Z', { pressure: 190, durationSec: 20 }),
    ]);
    expect(learning.observations).toHaveLength(0);
  });

  it('ordina le run per data, non per ordine di inserimento', () => {
    const learning = learnFromHistory([
      run('recente', '2026-01-05T10:00:00Z', { pressure: 187, maxTravelPct: 93 }),
      run('vecchia', '2026-01-01T10:00:00Z', { pressure: 180, maxTravelPct: 100 }),
    ]);
    expect(learning.observations[0]).toMatchObject({
      fromSessionId: 'vecchia',
      toSessionId: 'recente',
      settingDelta: 7,
    });
  });

  it('non mescola bici diverse', () => {
    const learning = learnFromHistory([
      run('r1', '2026-01-01T10:00:00Z', { pressure: 180, bike: createDefaultBike({ id: 'a' }) }),
      run('r2', '2026-01-02T10:00:00Z', { pressure: 200, bike: createDefaultBike({ id: 'b' }) }),
    ]);
    expect(learning.observations).toHaveLength(0);
  });

  it('associa il rebound al tempo di ritorno, non alla corsa', () => {
    const learning = learnFromHistory([
      run('r1', '2026-01-01T10:00:00Z', { rebound: 8, recoveryTimeSec: 0.2 }),
      run('r2', '2026-01-02T10:00:00Z', { rebound: 10, recoveryTimeSec: 0.32 }),
    ]);
    expect(learning.observations[0]).toMatchObject({
      setting: 'rebound',
      metric: 'recoveryTimeSec',
    });
  });
});

describe('stima della sensibilità', () => {
  it('calcola quanto si muove la metrica per unità di regolazione', () => {
    const learning = learnFromHistory([
      run('r1', '2026-01-01T10:00:00Z', { pressure: 180, maxTravelPct: 100 }),
      run('r2', '2026-01-02T10:00:00Z', { pressure: 190, maxTravelPct: 90 }),
    ]);
    const sensitivity = findSensitivity(learning.sensitivities, 'pressure', 'front');
    // Ten PSI moved travel by ten points: one point per PSI.
    expect(sensitivity?.perUnit).toBeCloseTo(-1, 3);
    expect(sensitivity?.samples).toBe(1);
  });

  it('media più osservazioni coerenti fra loro', () => {
    const learning = learnFromHistory([
      run('r1', '2026-01-01T10:00:00Z', { pressure: 180, maxTravelPct: 100 }),
      run('r2', '2026-01-02T10:00:00Z', { pressure: 190, maxTravelPct: 90 }),
      run('r3', '2026-01-03T10:00:00Z', { pressure: 200, maxTravelPct: 84 }),
    ]);
    const sensitivity = findSensitivity(learning.sensitivities, 'pressure', 'front');
    expect(sensitivity?.samples).toBe(2);
    // Rates of -1.0 and -0.6 average to -0.8.
    expect(sensitivity?.perUnit).toBeCloseTo(-0.8, 2);
  });

  it('scarta le osservazioni che si contraddicono invece di annullarle', () => {
    // Two equal and opposite observations mean something else was moving too;
    // averaging them would give roughly zero and later invert to a huge step.
    const contradictory = estimateSensitivities([
      {
        setting: 'pressure',
        component: 'front',
        settingDelta: 10,
        metricDelta: -10,
        metric: 'maxTravelPct',
        fromSessionId: 'a',
        toSessionId: 'b',
      },
      {
        setting: 'pressure',
        component: 'front',
        settingDelta: 10,
        metricDelta: 10,
        metric: 'maxTravelPct',
        fromSessionId: 'b',
        toSessionId: 'c',
      },
    ]);
    expect(contradictory).toHaveLength(0);
  });

  it('tiene la direzione prevalente quando una osservazione è discordante', () => {
    const mixed = estimateSensitivities([
      mk(10, -10),
      mk(10, -8),
      mk(10, 4),
    ]);
    expect(mixed).toHaveLength(1);
    expect(mixed[0].samples).toBe(2);
    expect(mixed[0].perUnit).toBeLessThan(0);
  });

  it('non restituisce nulla senza storico', () => {
    expect(learnFromHistory([]).sensitivities).toHaveLength(0);
    expect(findSensitivity([], 'pressure', 'front')).toBeNull();
  });

  it('tiene separate forcella e posteriore', () => {
    const points: RunPoint[] = [
      point('r1', '2026-01-01T10:00:00Z', 'front', 180, 100),
      point('r2', '2026-01-02T10:00:00Z', 'front', 190, 90),
      point('r1', '2026-01-01T10:00:00Z', 'rear', 180, 100),
      point('r2', '2026-01-02T10:00:00Z', 'rear', 190, 95),
    ];
    const sensitivities = estimateSensitivities(findObservations(points));
    expect(findSensitivity(sensitivities, 'pressure', 'front')?.perUnit).toBeCloseTo(-1, 2);
    expect(findSensitivity(sensitivities, 'pressure', 'rear')?.perUnit).toBeCloseTo(-0.5, 2);
  });
});

function mk(settingDelta: number, metricDelta: number) {
  return {
    setting: 'pressure' as const,
    component: 'front' as const,
    settingDelta,
    metricDelta,
    metric: 'maxTravelPct' as const,
    fromSessionId: 'a',
    toSessionId: 'b',
  };
}

function point(
  sessionId: string,
  startedAt: string,
  component: 'front' | 'rear',
  pressure: number,
  maxTravelPct: number,
): RunPoint {
  return {
    sessionId,
    startedAt,
    bikeId: 'bike-1',
    component,
    settings: { pressure },
    metrics: { maxTravelPct, rideHeightPct: 20, bottomOutCount: 0, recoveryTimeSec: 0.3 },
    durationSec: 150,
  };
}
