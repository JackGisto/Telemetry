import { describe, expect, it } from 'vitest';
import type { BikeConfig, Session } from '@/types';
import { DATASETS, datasetSession } from '@/data/datasets';
import { createDefaultBike, createHardtailBike } from '@/data/defaults';
import { analyseSession, standardRecommendations } from './engine';
import { DEFAULT_TUNABLES } from './tunables';

const bike = () => createDefaultBike({ id: 'bike-test' });

function analyse(datasetId: string, config: BikeConfig = bike()) {
  return analyseSession(datasetSession(datasetId, config));
}

describe('motore di analisi sui dataset di riferimento', () => {
  it.each(DATASETS.map((d) => [d.id, d.expectedDiagnoses] as const))(
    'produce le diagnosi attese per %s',
    (id, expected) => {
      const found = analyse(id).diagnoses.map((d) => d.id);
      for (const diagnosis of expected) {
        expect(found, `dataset ${id}`).toContain(diagnosis);
      }
    },
  );

  it('non segnala nulla su una run di riferimento corretta', () => {
    const report = analyse('normal_run');
    expect(report.diagnoses).toHaveLength(0);
    expect(report.recommendations).toHaveLength(0);
    expect(report.scores.overall).toBe(100);
    expect(report.verdicts.front).toBe('correct');
    expect(report.verdicts.balance).toBe('balanced');
  });

  it('penalizza lo score quando ci sono anomalie', () => {
    expect(analyse('soft_shock').scores.overall).toBeLessThan(
      analyse('normal_run').scores.overall,
    );
  });

  it('è deterministico: la stessa run dà sempre lo stesso risultato', () => {
    const a = analyse('stiff_fork');
    const b = analyse('stiff_fork');
    expect(b.diagnoses).toEqual(a.diagnoses);
    expect(b.scores).toEqual(a.scores);
    expect(b.recommendations.map((r) => r.title)).toEqual(a.recommendations.map((r) => r.title));
  });

  it('ordina le raccomandazioni per priorità decrescente', () => {
    const priorities = analyse('soft_shock').recommendations.map((r) => r.priority);
    expect([...priorities].sort((x, y) => y - x)).toEqual(priorities);
  });

  it('limita la modalità Standard a tre raccomandazioni', () => {
    const report = analyse('front_rear_imbalance');
    expect(standardRecommendations(report).length).toBeLessThanOrEqual(
      DEFAULT_TUNABLES.maxStandardRecommendations,
    );
  });
});

describe('coerenza con lo stile di guida', () => {
  it('giudica la stessa run in modo diverso a seconda dello stile scelto', () => {
    const comfort = analyse('normal_run', createDefaultBike({ rider: { style: 'comfort' } }));
    const aggressive = analyse('normal_run', createDefaultBike({ rider: { style: 'aggressive' } }));
    // A run that is neutral for a balanced rider looks soft to a comfort rider
    // and firm to an aggressive one, so the two verdicts must differ.
    expect(comfort.verdicts.front).not.toBe(aggressive.verdicts.front);
  });

  it('le soglie sono configurabili senza toccare il codice delle regole', () => {
    const strict = analyseSession(datasetSession('normal_run', bike()), {
      tunables: {
        styles: {
          ...DEFAULT_TUNABLES.styles,
          balanced: {
            ...DEFAULT_TUNABLES.styles.balanced,
            front: { ...DEFAULT_TUNABLES.styles.balanced.front, maxTravelPct: [99, 100] },
          },
        },
      },
    });
    expect(strict.diagnoses.map((d) => d.id)).toContain('insufficient-travel-use');
  });
});

describe('hardtail', () => {
  const hardtail = createHardtailBike({ id: 'bike-hardtail' });

  it('non produce metriche, verdetti o diagnosi per il posteriore', () => {
    const report = analyse('normal_run', hardtail);
    expect(report.metrics.rear).toBeNull();
    expect(report.metrics.balance).toBeNull();
    expect(report.verdicts.rear).toBeNull();
    expect(report.scores.rear).toBeNull();
    expect(report.diagnoses.every((d) => d.component !== 'rear')).toBe(true);
  });

  it('non consiglia mai una regolazione del posteriore', () => {
    const report = analyse('front_rear_imbalance', hardtail);
    for (const rec of report.recommendations) {
      if ('component' in rec.action) expect(rec.action.component).not.toBe('rear');
    }
  });
});

describe('run non analizzabili', () => {
  it('rifiuta una run troppo breve invece di inventare una diagnosi', () => {
    const short: Session = {
      ...datasetSession('normal_run', bike()),
      samples: [
        { t: 0, frontMm: 10, rearMm: 5 },
        { t: 1000, frontMm: 20, rearMm: 8 },
      ],
    };
    const report = analyseSession(short);
    expect(report.diagnoses).toHaveLength(0);
    expect(report.recommendations).toHaveLength(0);
    expect(report.warnings[0]).toMatch(/troppo breve/i);
  });

  it('avvisa quando manca il canale posteriore su una full suspension', () => {
    const full = datasetSession('normal_run', bike());
    const report = analyseSession({
      ...full,
      samples: full.samples.map((s) => ({ ...s, rearMm: null })),
    });
    expect(report.metrics.rear).toBeNull();
    expect(report.warnings.join(' ')).toMatch(/sensore posteriore/i);
  });
});
