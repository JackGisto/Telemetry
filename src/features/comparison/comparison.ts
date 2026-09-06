import type { AnalysisReport, Session } from '@/types';

/**
 * Run comparison.
 *
 * The point is not to show two columns of numbers: it is to answer whether a
 * setup change made things better. Each row therefore declares which direction
 * counts as an improvement, and the UI colours the delta accordingly.
 */

export interface ComparisonRow {
  label: string;
  a: number | null;
  b: number | null;
  unit: string;
  better: 'lower' | 'higher' | 'neutral';
  decimals: number;
}

export interface SetupChange {
  label: string;
  from: string;
  to: string;
}

export function buildComparisonRows(a: AnalysisReport, b: AnalysisReport): ComparisonRow[] {
  const rows: ComparisonRow[] = [
    { label: 'Score complessivo', a: a.scores.overall, b: b.scores.overall, unit: '', better: 'higher', decimals: 0 },
    { label: 'Score forcella', a: a.scores.front, b: b.scores.front, unit: '', better: 'higher', decimals: 0 },
    {
      label: 'Forcella · corsa max',
      a: a.metrics.front.maxTravelPct,
      b: b.metrics.front.maxTravelPct,
      unit: '%',
      better: 'neutral',
      decimals: 1,
    },
    {
      label: 'Forcella · fondo corsa',
      a: a.metrics.front.bottomOutCount,
      b: b.metrics.front.bottomOutCount,
      unit: '',
      better: 'lower',
      decimals: 0,
    },
    {
      label: 'Forcella · ritorno',
      a: a.metrics.front.velocity.meanRecoveryTimeSec,
      b: b.metrics.front.velocity.meanRecoveryTimeSec,
      unit: ' s',
      better: 'neutral',
      decimals: 3,
    },
    {
      label: 'Forcella · compressione',
      a: a.metrics.front.velocity.meanCompression,
      b: b.metrics.front.velocity.meanCompression,
      unit: ' mm/s',
      better: 'neutral',
      decimals: 0,
    },
  ];

  // Rear rows only when both runs actually have rear data.
  if (a.metrics.rear && b.metrics.rear) {
    rows.push(
      { label: 'Score posteriore', a: a.scores.rear, b: b.scores.rear, unit: '', better: 'higher', decimals: 0 },
      {
        label: 'Posteriore · corsa max',
        a: a.metrics.rear.maxTravelPct,
        b: b.metrics.rear.maxTravelPct,
        unit: '%',
        better: 'neutral',
        decimals: 1,
      },
      {
        label: 'Posteriore · fondo corsa',
        a: a.metrics.rear.bottomOutCount,
        b: b.metrics.rear.bottomOutCount,
        unit: '',
        better: 'lower',
        decimals: 0,
      },
      {
        label: 'Posteriore · ritorno',
        a: a.metrics.rear.velocity.meanRecoveryTimeSec,
        b: b.metrics.rear.velocity.meanRecoveryTimeSec,
        unit: ' s',
        better: 'neutral',
        decimals: 3,
      },
    );
  }

  if (a.metrics.balance && b.metrics.balance) {
    rows.push({
      label: 'Bilanciamento (F−R)',
      a: a.metrics.balance.travelUseDeltaPct,
      b: b.metrics.balance.travelUseDeltaPct,
      unit: ' pt',
      better: 'neutral',
      decimals: 1,
    });
  }

  return rows;
}

/** What the rider actually changed between the two runs. */
export function buildSetupChanges(a: Session, b: Session): SetupChange[] {
  const changes: SetupChange[] = [];
  const push = (label: string, from: unknown, to: unknown) => {
    if (from === to || from === undefined || to === undefined) return;
    changes.push({ label, from: String(from), to: String(to) });
  };

  push('Forcella · pressione', a.setupSnapshot.frontSuspension.pressurePsi, b.setupSnapshot.frontSuspension.pressurePsi);
  push('Forcella · rebound', a.setupSnapshot.frontSuspension.rebound.clicks, b.setupSnapshot.frontSuspension.rebound.clicks);
  push(
    'Forcella · compressione',
    a.setupSnapshot.frontSuspension.compression.clicks,
    b.setupSnapshot.frontSuspension.compression.clicks,
  );

  const rearA = a.setupSnapshot.rearSuspension;
  const rearB = b.setupSnapshot.rearSuspension;
  if (rearA.present && rearB.present) {
    push('Mono · pressione', rearA.pressurePsi, rearB.pressurePsi);
    push('Mono · rebound', rearA.rebound.clicks, rearB.rebound.clicks);
    push('Mono · compressione', rearA.compression.clicks, rearB.compression.clicks);
  }

  push('Stile di guida', a.setupSnapshot.rider.style, b.setupSnapshot.rider.style);
  return changes;
}

/** One-sentence answer to "did it get better?". */
export function verdictSentence(a: AnalysisReport, b: AnalysisReport): string {
  const delta = b.scores.overall - a.scores.overall;
  if (delta >= 8) return 'La modifica ha migliorato chiaramente il comportamento della bici.';
  if (delta >= 3) return 'La modifica ha portato un miglioramento contenuto.';
  if (delta <= -8) return 'La modifica ha peggiorato il comportamento della bici.';
  if (delta <= -3) return 'La modifica ha peggiorato leggermente il comportamento.';
  return 'Le due run sono sostanzialmente equivalenti.';
}
