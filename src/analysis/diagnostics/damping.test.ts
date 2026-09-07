import { describe, expect, it } from 'vitest';
import type { ComponentMetrics, SessionMetrics, SpeedBandStats } from '@/types';
import { createDefaultBike } from '@/data/defaults';
import { DEFAULT_TUNABLES } from '../tunables';
import { runDiagnostics } from './index';

/**
 * These rules are exercised against constructed metrics rather than a generated
 * run: the point is to pin the rule's threshold behaviour exactly, which a
 * synthetic trace can only approach.
 */

const T = DEFAULT_TUNABLES;
const band = (mean: number, fraction: number): SpeedBandStats => ({ mean, fraction });

function metrics(overrides: Partial<ComponentMetrics> = {}): ComponentMetrics {
  const velocity = {
    meanCompression: 300,
    meanRebound: 250,
    p95Compression: 700,
    p95Rebound: 600,
    maxCompression: 1200,
    maxRebound: 900,
    // Inside the balanced target band, so the rebound-time rule stays quiet.
    meanRecoveryTimeSec: 0.3,
    histogram: [],
    lowSpeedCompression: band(120, 0.2),
    highSpeedCompression: band(420, 0.2),
    lowSpeedRebound: band(110, 0.5),
    highSpeedRebound: band(380, 0.1),
    ...(overrides.velocity ?? {}),
  };

  return {
    component: 'front',
    totalTravelMm: 160,
    maxTravelMm: 148,
    maxTravelPct: 92,
    meanTravelMm: 40,
    meanTravelPct: 25,
    rideHeightPct: 22,
    p95TravelPct: 70,
    histogram: [],
    bottomOutCount: 0,
    timeNearBottom: 0,
    timeNearTop: 0.3,
    topOutCount: 0,
    compressionEvents: 40,
    ...overrides,
    velocity,
  };
}

function diagnose(front: ComponentMetrics) {
  const sessionMetrics: SessionMetrics = {
    front,
    rear: null,
    balance: null,
    durationSec: 150,
    sampleCount: 15000,
  };
  return runDiagnostics({
    metrics: sessionMetrics,
    bike: createDefaultBike(),
    style: T.styles.balanced,
    tunables: T,
    baseConfidence: 1,
  }).map((d) => d.id);
}

describe('regola sui colpi ad alta velocità', () => {
  it('non segnala nulla su una distribuzione equilibrata', () => {
    expect(diagnose(metrics())).not.toContain('harsh-on-impacts');
  });

  it('segnala durezza quando la compressione è dominata dalle alte velocità', () => {
    const harsh = metrics({
      velocity: { ...metrics().velocity, highSpeedCompression: band(600, 0.55) },
    });
    expect(diagnose(harsh)).toContain('harsh-on-impacts');
  });

  it('resta in silenzio se ci sono troppe poche compressioni per giudicare', () => {
    const sparse = metrics({
      compressionEvents: 2,
      velocity: { ...metrics().velocity, highSpeedCompression: band(600, 0.55) },
    });
    expect(diagnose(sparse)).not.toContain('harsh-on-impacts');
  });
});

describe('regola di impaccamento', () => {
  it('non segnala nulla quando il ritorno avviene in prevalenza a bassa velocità', () => {
    expect(diagnose(metrics())).not.toContain('packing-down');
  });

  it('segnala impaccamento quando il ritorno resta bloccato alle alte velocità', () => {
    const packing = metrics({
      velocity: {
        ...metrics().velocity,
        lowSpeedRebound: band(90, 0.15),
        highSpeedRebound: band(420, 0.35),
      },
    });
    expect(diagnose(packing)).toContain('packing-down');
  });
});

describe('regola sull’altezza di marcia', () => {
  it('accetta un’altezza dentro la banda dello stile', () => {
    expect(diagnose(metrics({ rideHeightPct: 22 }))).not.toContain('lacks-low-speed-support');
  });

  it('segnala mancanza di sostegno quando la bici viaggia seduta', () => {
    expect(diagnose(metrics({ rideHeightPct: 42 }))).toContain('lacks-low-speed-support');
  });

  it('non duplica la diagnosi quando la sospensione viaggia alta', () => {
    // Riding high is already covered by the mean-travel rule; this rule must
    // stay quiet rather than raise the same advice from a second signal.
    expect(diagnose(metrics({ rideHeightPct: 6 }))).not.toContain('lacks-low-speed-support');
  });
});
