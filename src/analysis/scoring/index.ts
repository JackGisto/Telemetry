import type {
  AnalysisReport,
  BalanceVerdict,
  Diagnosis,
  SessionMetrics,
  SuspensionComponent,
  Verdict,
} from '@/types';
import type { StyleProfile, Tunables } from '../tunables';
import { clamp } from '../metrics/signal';
import { bandError } from '../diagnostics';

/**
 * Deterministic scoring: each diagnosis deducts `severityWeight x confidence`
 * points from a perfect 100, per scope. No randomness, no model.
 */
function scoreFor(
  diagnoses: Diagnosis[],
  scope: SuspensionComponent | 'system',
  tunables: Tunables,
): number {
  const deduction = diagnoses
    .filter((d) => d.component === scope)
    .reduce((sum, d) => sum + tunables.severityWeight[d.severity] * d.confidence, 0);
  return Math.round(clamp(100 - deduction, 0, 100));
}

/**
 * Component verdict for Standard mode: one word the rider can act on.
 * Derived from travel usage against the style band, not from the score, so the
 * wording always matches the recommendation shown next to it.
 */
export function verdictFor(
  metrics: SessionMetrics,
  component: SuspensionComponent,
  style: StyleProfile,
): Verdict {
  const m = component === 'front' ? metrics.front : metrics.rear;
  if (!m || m.compressionEvents === 0) return 'unknown';
  const win = component === 'front' ? style.front : style.rear;

  // Combine "did it reach the end" with "where did it sit on average".
  const maxErr = bandError(m.maxTravelPct, win.maxTravelPct);
  const meanErr = bandError(m.meanTravelPct, win.meanTravelPct);
  const error = maxErr !== 0 ? maxErr : meanErr;

  if (error === 0) return 'correct';
  if (error > 0) return error > 5 ? 'too-soft' : 'slightly-soft';
  return error < -8 ? 'too-stiff' : 'slightly-stiff';
}

export function balanceVerdictFor(metrics: SessionMetrics, tunables: Tunables): BalanceVerdict {
  if (!metrics.balance) return 'unknown';
  const delta = metrics.balance.travelUseDeltaPct;
  if (Math.abs(delta) <= tunables.imbalanceDeltaPct) return 'balanced';
  return delta > 0 ? 'front-soft' : 'rear-soft';
}

export function computeScores(
  metrics: SessionMetrics,
  diagnoses: Diagnosis[],
  tunables: Tunables,
): AnalysisReport['scores'] {
  const front = scoreFor(diagnoses, 'front', tunables);
  const rear = metrics.rear ? scoreFor(diagnoses, 'rear', tunables) : null;
  const balance = metrics.balance ? scoreFor(diagnoses, 'system', tunables) : null;

  const w = tunables.scoreWeights;
  const parts: Array<[number, number]> = [[front, w.front]];
  if (rear !== null) parts.push([rear, w.rear]);
  if (balance !== null) parts.push([balance, w.balance]);
  const totalWeight = parts.reduce((s, [, weight]) => s + weight, 0);
  const overall = Math.round(
    parts.reduce((s, [value, weight]) => s + value * weight, 0) / totalWeight,
  );

  return { front, rear, balance, overall };
}
