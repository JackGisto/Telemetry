import { describe, expect, it } from 'vitest';
import { analyseSession } from '@/analysis';
import { datasetSession } from '@/data/datasets';
import { createDefaultBike, createHardtailBike } from '@/data/defaults';
import { parseJson, samplesToCsv, summaryToCsv, toJson } from './exporters';

const bike = createDefaultBike({ id: 'bike-1' });
const session = datasetSession('soft_shock', bike);
const report = analyseSession(session);

describe('export JSON', () => {
  it('fa il round-trip di sessione e analisi', () => {
    const parsed = parseJson(toJson(session, report));
    expect(parsed.session.samples).toHaveLength(session.samples.length);
    expect(parsed.report?.scores.overall).toBe(report.scores.overall);
    expect(parsed.session.setupSnapshot.frontSuspension.totalTravelMm).toBe(160);
  });

  it('accetta un export senza analisi', () => {
    expect(parseJson(toJson(session, null)).report).toBeNull();
  });

  it('rifiuta un file che non contiene una sessione', () => {
    expect(() => parseJson('{"formatVersion":1}')).toThrow(/nessuna sessione/i);
  });

  it('rifiuta una versione di formato sconosciuta', () => {
    const broken = JSON.stringify({ formatVersion: 99, session });
    expect(() => parseJson(broken)).toThrow(/versione/i);
  });
});

describe('export CSV dei campioni', () => {
  const csv = samplesToCsv(session);
  const lines = csv.split('\n');

  it('ha una riga di intestazione e una riga per campione', () => {
    expect(lines[0]).toBe('time_ms,front_mm,front_pct,rear_mm,rear_pct');
    expect(lines).toHaveLength(session.samples.length + 1);
  });

  it('esprime le posizioni sia in mm sia in percentuale di corsa', () => {
    const [t, frontMm, frontPct] = lines[1].split(',');
    expect(Number(t)).toBe(session.samples[0].t);
    expect(Number(frontPct)).toBeCloseTo((Number(frontMm) / 160) * 100, 1);
  });

  it('lascia vuote le colonne posteriori su una hardtail', () => {
    const hardtail = datasetSession('normal_run', createHardtailBike({ id: 'ht' }));
    const row = samplesToCsv({
      ...hardtail,
      samples: hardtail.samples.map((s) => ({ ...s, rearMm: null })),
    }).split('\n')[1];
    expect(row.endsWith(',,')).toBe(true);
  });
});

describe('export CSV di riepilogo', () => {
  const csv = summaryToCsv(session, report);

  it('include setup, metriche, score, diagnosi e raccomandazioni', () => {
    expect(csv).toContain('setup,front_travel_mm,160');
    expect(csv).toContain('setup,riding_style,balanced');
    expect(csv).toMatch(/metrics,front_max_travel_pct,/);
    expect(csv).toMatch(/score,overall,/);
    expect(csv).toMatch(/^diagnosis,/m);
    expect(csv).toMatch(/^recommendation,1,/m);
  });

  it('omette del tutto le righe del posteriore su una hardtail', () => {
    const hardtail = datasetSession('normal_run', createHardtailBike({ id: 'ht' }));
    const out = summaryToCsv(hardtail, analyseSession(hardtail));
    expect(out).toContain('setup,rear_present,no');
    expect(out).not.toMatch(/setup,rear_travel_mm/);
    expect(out).not.toMatch(/metrics,rear_/);
  });

  it('mette tra virgolette i valori che contengono virgole', () => {
    const withNotes = { ...session, notes: 'Mono +5 PSI, trail asciutto' };
    expect(summaryToCsv(withNotes, report)).toContain('"Mono +5 PSI, trail asciutto"');
  });
});
