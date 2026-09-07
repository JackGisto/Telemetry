import { describe, expect, it } from 'vitest';
import type { BikeConfig, Diagnosis, SuspensionConfig } from '@/types';
import { createDefaultBike } from '@/data/defaults';
import { datasetSession } from '@/data/datasets';
import { analyseSession } from '../engine';
import { computeMetrics } from '../metrics';
import { DEFAULT_TUNABLES } from '../tunables';
import { buildRecommendations } from './index';

const style = DEFAULT_TUNABLES.styles.balanced;

function contextFor(bike: BikeConfig) {
  const session = datasetSession('stiff_fork', bike);
  return {
    bike,
    metrics: computeMetrics(session.samples, bike, DEFAULT_TUNABLES),
    style,
    tunables: DEFAULT_TUNABLES,
  };
}

function diagnosis(overrides: Partial<Diagnosis> = {}): Diagnosis {
  return {
    id: 'insufficient-travel-use',
    component: 'front',
    severity: 'moderate',
    confidence: 0.9,
    metric: 'maxTravelPct',
    metricValue: 60,
    threshold: 88,
    description: 'test',
    ...overrides,
  };
}

/** A fork with no adjusters at all: the hardest case for the engine. */
const lockedFork: SuspensionConfig = {
  totalTravelMm: 160,
  springType: 'coil',
  springRateLbIn: 45,
  preload: { available: false },
  rebound: { available: false },
  compression: { available: false },
};

describe('le raccomandazioni rispettano le regolazioni disponibili', () => {
  it('propone una modifica di pressione su una sospensione ad aria', () => {
    const bike = createDefaultBike();
    const recs = buildRecommendations([diagnosis()], contextFor(bike));
    expect(recs[0].action.kind).toBe('pressure');
    // Too little travel used means the fork must get softer, so pressure drops.
    expect(recs[0].action).toMatchObject({ component: 'front' });
    if (recs[0].action.kind === 'pressure') expect(recs[0].action.deltaPsi).toBeLessThan(0);
  });

  it('propone il precarico, non i PSI, su una sospensione a molla', () => {
    const bike = createDefaultBike({
      frontSuspension: {
        totalTravelMm: 160,
        springType: 'coil',
        springRateLbIn: 45,
        preload: { available: true, turns: 2 },
        rebound: { available: true, clicks: 8 },
        compression: { available: true, clicks: 8 },
      },
    });
    const recs = buildRecommendations([diagnosis()], contextFor(bike));
    expect(recs[0].action.kind).toBe('preload');
  });

  it('suggerisce una molla diversa quando non c’è nemmeno il precarico', () => {
    const bike = createDefaultBike({ frontSuspension: lockedFork });
    const recs = buildRecommendations([diagnosis()], contextFor(bike));
    expect(recs[0].action.kind).toBe('spring-rate');
    if (recs[0].action.kind === 'spring-rate') expect(recs[0].action.direction).toBe('softer');
  });

  it('non inventa mai un click di rebound su una sospensione senza rebound', () => {
    const bike = createDefaultBike({ frontSuspension: lockedFork });
    const recs = buildRecommendations(
      [diagnosis({ id: 'rebound-too-fast' })],
      contextFor(bike),
    );
    expect(recs.every((r) => r.action.kind !== 'rebound')).toBe(true);
    // It explains the problem instead of proposing a knob that does not exist.
    expect(recs[0].action.kind).toBe('explain');
  });

  it('chiude il rebound quando è troppo veloce e lo apre quando è troppo lento', () => {
    const bike = createDefaultBike();
    const fast = buildRecommendations([diagnosis({ id: 'rebound-too-fast' })], contextFor(bike));
    const slow = buildRecommendations([diagnosis({ id: 'rebound-too-slow' })], contextFor(bike));

    expect(fast[0].action.kind).toBe('rebound');
    expect(slow[0].action.kind).toBe('rebound');
    if (fast[0].action.kind === 'rebound' && slow[0].action.kind === 'rebound') {
      // Closing clicks is positive, opening is negative.
      expect(fast[0].action.deltaClicks).toBeGreaterThan(0);
      expect(slow[0].action.deltaClicks).toBeLessThan(0);
    }
  });

  it('aumenta la pressione quando la sospensione arriva troppo spesso a fondo corsa', () => {
    const bike = createDefaultBike();
    const recs = buildRecommendations(
      [diagnosis({ id: 'frequent-bottom-out', component: 'rear' })],
      contextFor(bike),
    );
    expect(recs[0].action.kind).toBe('pressure');
    if (recs[0].action.kind === 'pressure') {
      expect(recs[0].action.deltaPsi).toBeGreaterThan(0);
      expect(recs[0].action.component).toBe('rear');
    }
  });

  it('non supera mai il passo massimo di pressione configurato', () => {
    const bike = createDefaultBike();
    const recs = buildRecommendations(
      [diagnosis({ metricValue: 5, severity: 'major' }), diagnosis({ component: 'rear' })],
      contextFor(bike),
    );
    for (const rec of recs) {
      if (rec.action.kind === 'pressure') {
        const limit = DEFAULT_TUNABLES.maxPsiStep[rec.action.component];
        expect(Math.abs(rec.action.deltaPsi)).toBeLessThanOrEqual(limit);
        expect(Math.abs(rec.action.deltaPsi)).toBeGreaterThan(0);
      }
    }
  });

  it('unisce le diagnosi che portano alla stessa regolazione', () => {
    const bike = createDefaultBike();
    const recs = buildRecommendations(
      [diagnosis({ id: 'frequent-bottom-out' }), diagnosis({ id: 'excessive-travel-use' })],
      contextFor(bike),
    );
    const pressureRecs = recs.filter(
      (r) => r.action.kind === 'pressure' && r.action.component === 'front',
    );
    expect(pressureRecs).toHaveLength(1);
    expect(pressureRecs[0].causes.length).toBeGreaterThan(1);
  });

  it('ogni raccomandazione ha un titolo leggibile e una motivazione', () => {
    const report = analyseSession(datasetSession('soft_shock', createDefaultBike()));
    expect(report.recommendations.length).toBeGreaterThan(0);
    for (const rec of report.recommendations) {
      expect(rec.title.length).toBeGreaterThan(8);
      expect(rec.rationale.length).toBeGreaterThan(20);
      expect(rec.causes.length).toBeGreaterThan(0);
    }
  });
});

describe('scelta del circuito di smorzamento', () => {
  /** A fork with a split compression circuit, as found on higher-end units. */
  const splitFork: SuspensionConfig = {
    totalTravelMm: 160,
    springType: 'air',
    pressurePsi: 75,
    rebound: { available: true, clicks: 8 },
    compression: { available: true, clicks: 10 },
    highSpeedCompression: { available: true, clicks: 4 },
    highSpeedRebound: { available: true, clicks: 3 },
  };

  /** The same fork with a single compression dial. */
  const singleFork: SuspensionConfig = {
    totalTravelMm: 160,
    springType: 'air',
    pressurePsi: 75,
    rebound: { available: true, clicks: 8 },
    compression: { available: true, clicks: 10 },
  };

  it('punta al circuito alta velocità per la durezza sui colpi secchi', () => {
    const bike = createDefaultBike({ frontSuspension: splitFork });
    const recs = buildRecommendations([diagnosis({ id: 'harsh-on-impacts' })], contextFor(bike));
    expect(recs[0].action.kind).toBe('compression');
    if (recs[0].action.kind === 'compression') {
      expect(recs[0].action.circuit).toBe('high-speed');
      // Harshness means letting the impact through, so the circuit opens.
      expect(recs[0].action.deltaClicks).toBeLessThan(0);
    }
    expect(recs[0].title).toMatch(/alte velocità/i);
  });

  it('punta al circuito bassa velocità quando manca sostegno', () => {
    const bike = createDefaultBike({ frontSuspension: splitFork });
    const recs = buildRecommendations(
      [diagnosis({ id: 'lacks-low-speed-support' })],
      contextFor(bike),
    );
    expect(recs[0].action.kind).toBe('compression');
    if (recs[0].action.kind === 'compression') {
      expect(recs[0].action.circuit).toBe('low-speed');
      expect(recs[0].action.deltaClicks).toBeGreaterThan(0);
    }
    expect(recs[0].title).toMatch(/basse velocità/i);
  });

  it('non nomina un circuito che la sospensione non ha', () => {
    const bike = createDefaultBike({ frontSuspension: singleFork });
    const recs = buildRecommendations(
      [diagnosis({ id: 'lacks-low-speed-support' })],
      contextFor(bike),
    );
    if (recs[0].action.kind === 'compression') expect(recs[0].action.circuit).toBe('single');
    // A rider with one dial must not be sent looking for a second one.
    expect(recs[0].title).not.toMatch(/basse velocità|alte velocità/i);
  });

  it('ripiega sulla molla quando non esiste alcuna compressione regolabile', () => {
    const bike = createDefaultBike({
      frontSuspension: { ...singleFork, compression: { available: false } },
    });
    const recs = buildRecommendations(
      [diagnosis({ id: 'lacks-low-speed-support' })],
      contextFor(bike),
    );
    expect(recs[0].action.kind).toBe('pressure');
    if (recs[0].action.kind === 'pressure') expect(recs[0].action.deltaPsi).toBeGreaterThan(0);
  });

  it('corregge l’impaccamento aprendo il ritorno, non toccando la molla', () => {
    const bike = createDefaultBike({ frontSuspension: splitFork });
    const recs = buildRecommendations([diagnosis({ id: 'packing-down' })], contextFor(bike));
    expect(recs[0].action.kind).toBe('rebound');
    if (recs[0].action.kind === 'rebound') {
      expect(recs[0].action.deltaClicks).toBeLessThan(0);
      expect(recs[0].action.circuit).toBe('low-speed');
    }
  });

  it('spiega senza inventare nulla se la compressione non è regolabile e la molla è fissa', () => {
    const bike = createDefaultBike({
      frontSuspension: {
        totalTravelMm: 160,
        springType: 'coil',
        preload: { available: false },
        rebound: { available: false },
        compression: { available: false },
      },
    });
    const recs = buildRecommendations([diagnosis({ id: 'harsh-on-impacts' })], contextFor(bike));
    expect(recs[0].action.kind).toBe('explain');
  });
});
