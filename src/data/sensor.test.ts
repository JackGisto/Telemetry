import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SENSOR_MODEL,
  positionFraction,
  resistanceFromAdc,
  type SensorModel,
} from './sensor';

/**
 * The sensors are linear potentiometers. These tests pin both wirings, and in
 * particular the one that matters: a two-wire divider whose response is not
 * linear in position, so calibrating only the endpoints leaves the middle of
 * the stroke wrong.
 */

const CAL = { zeroRaw: 0, fullRaw: 4095 };

/** A 10 kOhm pot against a 10 kOhm fixed resistor, 12-bit ADC. */
const rheostat: Extract<SensorModel, { kind: 'rheostat' }> = {
  kind: 'rheostat',
  fixedOhm: 10_000,
  minOhm: 0,
  maxOhm: 10_000,
  adcFullScale: 4095,
  potOnHighSide: true,
};

describe('potenziometro ratiometrico a tre fili', () => {
  it('è lineare tra i due estremi calibrati', () => {
    expect(positionFraction(0, CAL)).toBeCloseTo(0, 6);
    expect(positionFraction(2047.5, CAL)).toBeCloseTo(0.5, 3);
    expect(positionFraction(4095, CAL)).toBeCloseTo(1, 6);
  });

  it('satura fuori dall’intervallo calibrato invece di extrapolare', () => {
    expect(positionFraction(-500, CAL)).toBe(0);
    expect(positionFraction(9999, CAL)).toBe(1);
  });

  it('usa gli estremi calibrati, non la scala piena dell’ADC', () => {
    // A sensor mounted with limited range still reads 0..1 across its own span.
    const partial = { zeroRaw: 500, fullRaw: 1500 };
    expect(positionFraction(1000, partial)).toBeCloseTo(0.5, 3);
  });

  it('non divide per zero se la calibrazione è degenere', () => {
    expect(positionFraction(800, { zeroRaw: 800, fullRaw: 800 })).toBe(0);
  });

  it('è il modello predefinito', () => {
    expect(DEFAULT_SENSOR_MODEL.kind).toBe('ratiometric');
  });
});

describe('potenziometro a due fili con resistenza fissa', () => {
  it('ricava la resistenza dalla lettura dell’ADC', () => {
    // Half scale means the two resistances are equal.
    expect(resistanceFromAdc(2047.5, rheostat)).toBeCloseTo(10_000, 0);
  });

  it('non inverte il divisore quando la lettura è a fondo scala', () => {
    expect(resistanceFromAdc(0, rheostat)).toBeNull();
    expect(resistanceFromAdc(4095, rheostat)).toBeNull();
  });

  it('resta monotono su tutta la corsa utile', () => {
    // With a 10k pot against a 10k fixed resistor the readings span roughly
    // half the ADC range, so the sweep stays inside that span.
    const readings = [100, 400, 800, 1200, 1600, 2000];
    const positions = readings.map((raw) => positionFraction(raw, CAL, rheostat));
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]);
    }
  });

  it('la risposta NON è lineare, ed è il motivo per cui va modellata', () => {
    // For this wiring the ends of the stroke land at ADC 0 and about 2047.
    const endpoints = { zeroRaw: 0, fullRaw: 2047.5 };
    const midRaw = (endpoints.zeroRaw + endpoints.fullRaw) / 2;

    const linearReading = positionFraction(midRaw, endpoints);
    const trueReading = positionFraction(midRaw, endpoints, rheostat);

    // Reading the midpoint as if the response were linear says half travel;
    // the divider actually sits a third of the way further down the stroke.
    expect(linearReading).toBeCloseTo(0.5, 3);
    expect(trueReading).toBeCloseTo(0.333, 2);
    expect(Math.abs(trueReading - linearReading)).toBeGreaterThan(0.1);
  });

  it('gestisce la resistenza fissa sul lato alimentazione', () => {
    const lowSide = { ...rheostat, potOnHighSide: false };
    // With the fixed resistor on the supply side the reading falls as the pot
    // resistance rises, so the same ADC value means the opposite end.
    expect(positionFraction(3900, CAL, lowSide)).toBeLessThan(
      positionFraction(800, CAL, lowSide),
    );
  });

  it('satura agli estremi invece di restituire un valore inventato', () => {
    expect(positionFraction(0, CAL, rheostat)).toBe(0);
    expect(positionFraction(4095, CAL, rheostat)).toBe(1);
  });

  it('con la resistenza fissa dimensionata bene copre tutta la scala', () => {
    // A fixed resistor much smaller than the pot spreads the pot's range
    // across most of the ADC, which is how it should be specified.
    const wide = { ...rheostat, fixedOhm: 2000 };
    expect(positionFraction(3500, CAL, wide)).toBeGreaterThan(0.9);
    expect(positionFraction(500, CAL, wide)).toBeLessThan(0.1);
  });

  it('non divide per zero se gli estremi di resistenza coincidono', () => {
    expect(positionFraction(2000, CAL, { ...rheostat, minOhm: 5000, maxOhm: 5000 })).toBe(0);
  });

  it('mappa una corsa parziale del potenziometro sull’intero intervallo', () => {
    // A pot whose used span is 2k..8k should read 0 and 1 at those resistances.
    const partial = { ...rheostat, minOhm: 2000, maxOhm: 8000 };
    const atMin = resistanceFromAdc(683, partial); // ~2 kOhm
    expect(atMin).toBeGreaterThan(1500);
    expect(positionFraction(683, CAL, partial)).toBeCloseTo(0, 1);
  });
});
