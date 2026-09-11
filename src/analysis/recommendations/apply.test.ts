import { describe, expect, it } from 'vitest';
import type { Recommendation, SuspensionConfig } from '@/types';
import { createDefaultBike, createHardtailBike } from '@/data/defaults';
import { applyRecommendation, isApplicable } from './apply';
import { changeFor, expectFor, howToFor } from './practical';

/**
 * Applying a change is what closes the loop: the rider adjusts the bike, taps
 * once, and the stored setup follows. If this drifts from reality the run
 * snapshots lie and everything built on them, comparison and learning
 * included, quietly goes wrong.
 */

function rec(action: Recommendation['action'], unit: SuspensionConfig): Recommendation {
  return {
    id: 'test',
    priority: 1,
    action,
    title: 'test',
    change: changeFor(action, unit),
    rationale: 'test',
    howTo: howToFor(action),
    expect: expectFor(action),
    causes: [],
  };
}

describe('registrare una modifica nel setup', () => {
  it('sposta la pressione al valore di arrivo', () => {
    const bike = createDefaultBike();
    const action = { kind: 'pressure', component: 'front', deltaPsi: 5 } as const;
    const updated = applyRecommendation(bike, rec(action, bike.frontSuspension));
    expect(updated.frontSuspension.pressurePsi).toBe(80);
    // The original is untouched: the function is pure.
    expect(bike.frontSuspension.pressurePsi).toBe(75);
  });

  it('non porta la pressione sotto zero', () => {
    const bike = createDefaultBike({
      frontSuspension: { ...createDefaultBike().frontSuspension, pressurePsi: 3 },
    });
    const action = { kind: 'pressure', component: 'front', deltaPsi: -20 } as const;
    expect(
      applyRecommendation(bike, rec(action, bike.frontSuspension)).frontSuspension.pressurePsi,
    ).toBe(0);
  });

  it('sposta i click del ritorno e rispetta il fine corsa del registro', () => {
    const bike = createDefaultBike();
    const action = { kind: 'rebound', component: 'front', deltaClicks: 30, circuit: 'single' } as const;
    const updated = applyRecommendation(bike, rec(action, bike.frontSuspension));
    // The fork declares 16 clicks of range, so the target is capped there.
    expect(updated.frontSuspension.rebound.clicks).toBe(16);
  });

  it('agisce sul circuito indicato, non su quello base', () => {
    const split: SuspensionConfig = {
      ...createDefaultBike().frontSuspension,
      highSpeedCompression: { available: true, clicks: 4 },
    };
    const bike = createDefaultBike({ frontSuspension: split });
    const action = {
      kind: 'compression',
      component: 'front',
      deltaClicks: -2,
      circuit: 'high-speed',
    } as const;

    const updated = applyRecommendation(bike, rec(action, split));
    expect(updated.frontSuspension.highSpeedCompression?.clicks).toBe(2);
    // The low-speed dial must not move.
    expect(updated.frontSuspension.compression.clicks).toBe(10);
  });

  it('aggiorna il precarico su una sospensione a molla', () => {
    const coil: SuspensionConfig = {
      totalTravelMm: 160,
      springType: 'coil',
      preload: { available: true, turns: 1 },
      rebound: { available: true, clicks: 8 },
      compression: { available: true, clicks: 8 },
    };
    const bike = createDefaultBike({ frontSuspension: coil });
    const action = { kind: 'preload', component: 'front', deltaTurns: 0.5 } as const;
    expect(
      applyRecommendation(bike, rec(action, coil)).frontSuspension.preload?.turns,
    ).toBeCloseTo(1.5, 3);
  });

  it('aggiorna il posteriore mantenendolo presente', () => {
    const bike = createDefaultBike();
    const rear = bike.rearSuspension.present ? bike.rearSuspension : null;
    const action = { kind: 'pressure', component: 'rear', deltaPsi: 7 } as const;
    const updated = applyRecommendation(bike, rec(action, rear!));
    expect(updated.rearSuspension.present).toBe(true);
    expect(updated.rearSuspension.present && updated.rearSuspension.pressurePsi).toBe(187);
  });

  it('non tocca nulla sul posteriore di una hardtail', () => {
    const bike = createHardtailBike();
    const action = { kind: 'pressure', component: 'rear', deltaPsi: 7 } as const;
    const fake = rec(action, createDefaultBike().frontSuspension);
    expect(applyRecommendation(bike, fake)).toBe(bike);
    expect(isApplicable(bike, fake)).toBe(false);
  });

  it('non è applicabile quando il consiglio è solo una spiegazione', () => {
    const bike = createDefaultBike();
    const action = { kind: 'explain', component: 'front' } as const;
    expect(isApplicable(bike, rec(action, bike.frontSuspension))).toBe(false);
  });

  it('non è applicabile per un cambio molla, che non è una regolazione', () => {
    const bike = createDefaultBike();
    const action = { kind: 'spring-rate', component: 'front', direction: 'stiffer' } as const;
    expect(isApplicable(bike, rec(action, bike.frontSuspension))).toBe(false);
  });

  it('non inventa un valore se il registro non è presente', () => {
    const locked: SuspensionConfig = {
      totalTravelMm: 160,
      springType: 'air',
      pressurePsi: 75,
      rebound: { available: false },
      compression: { available: false },
    };
    const bike = createDefaultBike({ frontSuspension: locked });
    const action = { kind: 'rebound', component: 'front', deltaClicks: 2, circuit: 'single' } as const;
    expect(applyRecommendation(bike, rec(action, locked))).toBe(bike);
  });

  it('aggiorna updatedAt solo quando qualcosa cambia davvero', () => {
    const bike = createDefaultBike({ updatedAt: '2020-01-01T00:00:00.000Z' });
    const action = { kind: 'pressure', component: 'front', deltaPsi: 5 } as const;
    expect(applyRecommendation(bike, rec(action, bike.frontSuspension)).updatedAt).not.toBe(
      '2020-01-01T00:00:00.000Z',
    );

    const explain = { kind: 'explain', component: 'front' } as const;
    expect(applyRecommendation(bike, rec(explain, bike.frontSuspension)).updatedAt).toBe(
      '2020-01-01T00:00:00.000Z',
    );
  });
});

describe('valori concreti del consiglio', () => {
  it('indica da quale valore a quale', () => {
    const bike = createDefaultBike();
    const action = { kind: 'pressure', component: 'front', deltaPsi: 5 } as const;
    expect(changeFor(action, bike.frontSuspension)).toMatchObject({
      from: 75,
      to: 80,
      unit: 'PSI',
    });
  });

  it('non inventa un valore di partenza che non conosce', () => {
    const noPressure: SuspensionConfig = {
      totalTravelMm: 160,
      springType: 'air',
      rebound: { available: true, clicks: 8 },
      compression: { available: true },
    };
    const action = { kind: 'pressure', component: 'front', deltaPsi: 5 } as const;
    expect(changeFor(action, noPressure)).toBeNull();

    // Same for a dial whose current position the rider never entered.
    const compression = {
      kind: 'compression',
      component: 'front',
      deltaClicks: 1,
      circuit: 'single',
    } as const;
    expect(changeFor(compression, noPressure)).toBeNull();
  });

  it('nomina il circuito solo quando la sospensione ne ha due', () => {
    const single = createDefaultBike().frontSuspension;
    const action = {
      kind: 'compression',
      component: 'front',
      deltaClicks: 1,
      circuit: 'single',
    } as const;
    expect(changeFor(action, single)?.label).not.toMatch(/velocità/i);
  });

  it('ogni azione ha istruzioni pratiche e un risultato atteso', () => {
    const actions: Array<Recommendation['action']> = [
      { kind: 'pressure', component: 'front', deltaPsi: 5 },
      { kind: 'rebound', component: 'front', deltaClicks: 2, circuit: 'single' },
      { kind: 'compression', component: 'rear', deltaClicks: -1, circuit: 'high-speed' },
      { kind: 'preload', component: 'front', deltaTurns: 0.5 },
      { kind: 'spring-rate', component: 'rear', direction: 'stiffer' },
    ];
    for (const action of actions) {
      expect(howToFor(action).length).toBeGreaterThan(1);
      expect(expectFor(action).length).toBeGreaterThan(30);
    }
  });
});
