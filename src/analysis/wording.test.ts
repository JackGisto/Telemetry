import { describe, expect, it } from 'vitest';
import { DATASETS, datasetSession } from '@/data/datasets';
import { createDefaultBike } from '@/data/defaults';
import { analyseSession } from './engine';

/**
 * The advice is generated, so its Italian has to be generated correctly too.
 * A sentence like "la forcella è arrivato a fondo corsa" reads as broken
 * software and costs the rider's trust in the number next to it.
 */
describe('grammatica del testo generato', () => {
  const reports = DATASETS.map((d) => analyseSession(datasetSession(d.id, createDefaultBike())));
  const sentences = reports.flatMap((report) => [
    ...report.diagnoses.map((d) => d.description),
    ...report.recommendations.flatMap((r) => [r.title, r.rationale, r.expect, ...r.howTo]),
  ]);

  it('produce del testo su cui verificare', () => {
    expect(sentences.length).toBeGreaterThan(20);
  });

  it('non sbaglia l’accordo di genere con la forcella', () => {
    // "forcella" is feminine: these masculine forms next to it are always wrong.
    const wrong = [
      /\bla forcella (è|e) arrivato\b/i,
      /\bla forcella resta alto\b/i,
      /\bla forcella viaggia (affondato|seduto)\b/i,
      /\bil forcella\b/i,
      /\brisulta duro\b.*forcella/i,
      /\bsul forcella\b/i,
    ];
    for (const sentence of sentences) {
      for (const pattern of wrong) {
        expect(sentence, sentence).not.toMatch(pattern);
      }
    }
  });

  it('non sbaglia l’accordo con il posteriore', () => {
    for (const sentence of sentences) {
      expect(sentence, sentence).not.toMatch(/\bil posteriore (è|e) arrivata\b/i);
      expect(sentence, sentence).not.toMatch(/\bla posteriore\b/i);
      expect(sentence, sentence).not.toMatch(/\bsulla posteriore\b/i);
    }
  });

  it('non incolla un aggettivo allo stile come se fosse un sostantivo', () => {
    // "una guida bilanciato" does not agree; the style qualifies "lo stile".
    for (const sentence of sentences) {
      expect(sentence, sentence).not.toMatch(/una guida (bilanciato|aggressivo)/i);
    }
  });

  it('non lascia segnaposto o doppi spazi', () => {
    for (const sentence of sentences) {
      expect(sentence, sentence).not.toMatch(/undefined|NaN|\{\{|TODO/);
      expect(sentence, sentence).not.toMatch(/ {2}/);
      expect(sentence.trim()).toBe(sentence);
    }
  });

  it('apre ogni frase con una maiuscola', () => {
    for (const sentence of sentences) {
      const first = sentence.trimStart().charAt(0);
      expect(first, sentence).toBe(first.toUpperCase());
    }
  });
});
