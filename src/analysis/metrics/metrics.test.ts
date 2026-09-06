import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNABLES } from '../tunables';
import { percentile, smooth, stdDev } from './signal';
import { buildHistogram, computeTravel } from './travel';
import { computeVelocity, findCompressionEvents, recoveryTimeSec } from './velocity';

const T = DEFAULT_TUNABLES;

/** Build a trace at 100 Hz from millimetre values. */
function trace(values: number[]): { pos: number[]; t: number[] } {
  return { pos: values, t: values.map((_, i) => i * 10) };
}

describe('helper numerici', () => {
  it('interpola il percentile', () => {
    expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(percentile([0, 10], 0.5)).toBe(5);
    expect(percentile([], 0.5)).toBe(0);
  });

  it('calcola la deviazione standard', () => {
    expect(stdDev([2, 2, 2, 2])).toBe(0);
    expect(stdDev([1, 3])).toBe(1);
  });

  it('smorza il segnale senza spostare il picco nel tempo', () => {
    const raw = [0, 0, 0, 10, 20, 10, 0, 0, 0];
    const smoothed = smooth(raw, 3);
    expect(smoothed).toHaveLength(raw.length);
    // The peak is reduced but stays at the same index: a filter that shifted it
    // would move every detected event in time.
    expect(smoothed.indexOf(Math.max(...smoothed))).toBe(4);
    expect(Math.max(...smoothed)).toBeLessThan(20);
  });
});

describe('metriche di travel', () => {
  it('riporta corsa massima e media in mm e in percentuale', () => {
    const { pos, t } = trace([0, 40, 80, 120, 80, 40, 0]);
    const result = computeTravel(pos, t, 160, T);
    expect(result.maxTravelMm).toBe(120);
    expect(result.maxTravelPct).toBeCloseTo(75, 5);
    expect(result.meanTravelPct).toBeCloseTo((360 / 7 / 160) * 100, 5);
  });

  it('conta un solo bottom-out per colpo, non per campione', () => {
    // Ten consecutive samples past the threshold are one event.
    const { pos, t } = trace([0, 155, 156, 158, 159, 158, 156, 0, 0, 0]);
    expect(computeTravel(pos, t, 160, T).bottomOutCount).toBe(1);
  });

  it('conta due bottom-out separati nel tempo', () => {
    const values = [0, 158, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    values[50] = 158;
    for (let i = 16; i < 60; i++) values[i] = values[i] ?? 0;
    const { pos, t } = trace(values.map((v) => v ?? 0));
    expect(computeTravel(pos, t, 160, T).bottomOutCount).toBe(2);
  });

  it('non conta un bottom-out se il colpo resta sotto soglia', () => {
    const { pos, t } = trace([0, 100, 140, 100, 0]);
    expect(computeTravel(pos, t, 160, T).bottomOutCount).toBe(0);
  });

  it('misura la frazione di tempo passata a fondo corsa', () => {
    const { pos, t } = trace([0, 0, 158, 158, 0, 0, 0, 0, 0, 0]);
    expect(computeTravel(pos, t, 160, T).timeNearBottom).toBeCloseTo(0.2, 5);
  });

  it('costruisce un istogramma normalizzato che somma a 1', () => {
    const histogram = buildHistogram([5, 15, 25, 95, 100], 10);
    const total = histogram.reduce((sum, bin) => sum + bin.fraction, 0);
    expect(total).toBeCloseTo(1, 6);
    // A full-travel sample belongs in the top bin, not off the end.
    expect(histogram[9].fraction).toBeCloseTo(0.4, 6);
  });

  it('restituisce metriche neutre su un segnale vuoto', () => {
    const result = computeTravel([], [], 160, T);
    expect(result.maxTravelPct).toBe(0);
    expect(result.bottomOutCount).toBe(0);
    expect(result.histogram).toHaveLength(T.histogramBins);
  });
});

describe('metriche di velocità', () => {
  /** One compression to `peak` mm over `riseSteps`, then an exponential return. */
  function hit(peak: number, riseSteps: number, tau: number, length = 120): number[] {
    const out: number[] = [];
    for (let i = 0; i < riseSteps; i++) out.push((peak * i) / riseSteps);
    for (let i = 0; out.length < length; i++) out.push(peak * Math.exp(-(i * 0.01) / tau));
    return out;
  }

  it('individua un evento di compressione e ne trova il picco', () => {
    const events = findCompressionEvents(hit(100, 10, 0.15), 160, T);
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].peakMm).toBeCloseTo(100, 0);
  });

  it('ignora movimenti troppo piccoli per essere un colpo', () => {
    const noise = Array.from({ length: 200 }, (_, i) => 20 + Math.sin(i / 3) * 2);
    expect(findCompressionEvents(noise, 160, T)).toHaveLength(0);
  });

  it('misura un tempo di ritorno più lungo quando lo smorzamento è maggiore', () => {
    const fast = hit(100, 10, 0.08);
    const slow = hit(100, 10, 0.35);
    const t = fast.map((_, i) => i * 10);

    const fastRecovery = computeVelocity(fast, t, 160, T).velocity.meanRecoveryTimeSec;
    const slowRecovery = computeVelocity(slow, t, 160, T).velocity.meanRecoveryTimeSec;

    expect(fastRecovery).toBeGreaterThan(0);
    expect(slowRecovery).toBeGreaterThan(fastRecovery);
  });

  it('separa compressione e ritorno come magnitudini positive', () => {
    const values = hit(100, 10, 0.15);
    const { velocity } = computeVelocity(values, values.map((_, i) => i * 10), 160, T);
    expect(velocity.meanCompression).toBeGreaterThan(0);
    expect(velocity.meanRebound).toBeGreaterThan(0);
    expect(velocity.maxCompression).toBeGreaterThanOrEqual(velocity.meanCompression);
  });

  it('non restituisce un tempo di ritorno se la sospensione non rientra', () => {
    const stuck = [0, 20, 40, 60, 80, 100, 100, 100, 100, 100];
    const event = { peakIndex: 5, peakMm: 100, startIndex: 0, startMm: 0 };
    expect(recoveryTimeSec(stuck, stuck.map((_, i) => i * 10), event)).toBeNull();
  });

  it('restituisce zero su un segnale troppo corto', () => {
    expect(computeVelocity([1, 2], [0, 10], 160, T).velocity.meanCompression).toBe(0);
  });
});
