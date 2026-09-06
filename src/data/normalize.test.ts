import { describe, expect, it } from 'vitest';
import { createDefaultBike, createHardtailBike } from './defaults';
import {
  DEFAULT_FULL_SCALE_RAW,
  calibrationFor,
  decodeSample,
  normalizeRaw,
  positionMm,
  travelPercentage,
} from './normalize';

describe('normalizzazione posizione', () => {
  it('converte una posizione normalizzata in millimetri usando la corsa configurata', () => {
    expect(positionMm(0.5, 160)).toBe(80);
    expect(positionMm(0, 160)).toBe(0);
    expect(positionMm(1, 160)).toBe(160);
  });

  it('calcola la percentuale di corsa rispetto alla corsa totale', () => {
    expect(travelPercentage(80, 160)).toBe(50);
    expect(travelPercentage(160, 160)).toBe(100);
  });

  it('non divide per zero quando la corsa non è configurata', () => {
    expect(travelPercentage(80, 0)).toBe(0);
  });

  it('mappa i conteggi ADC nell’intervallo calibrato e satura fuori range', () => {
    const cal = { zeroRaw: 100, fullRaw: 1100, totalTravelMm: 160 };
    expect(normalizeRaw(100, cal)).toBe(0);
    expect(normalizeRaw(600, cal)).toBe(0.5);
    expect(normalizeRaw(1100, cal)).toBe(1);
    expect(normalizeRaw(50, cal)).toBe(0);
    expect(normalizeRaw(5000, cal)).toBe(1);
  });

  it('decodifica un campione a due canali in millimetri', () => {
    const cal = calibrationFor(createDefaultBike(), null);
    const sample = decodeSample(120, DEFAULT_FULL_SCALE_RAW / 2, DEFAULT_FULL_SCALE_RAW, cal);
    expect(sample.t).toBe(120);
    expect(sample.frontMm).toBeCloseTo(80, 0);
    expect(sample.rearMm).toBeCloseTo(60, 1);
  });

  it('non produce dati posteriori per una hardtail', () => {
    const cal = calibrationFor(createHardtailBike(), null);
    expect(cal.rear).toBeNull();
    expect(decodeSample(0, 2000, 2000, cal).rearMm).toBeNull();
  });
});
