import type { AnalysisReport, BikeConfig, Session } from '@/types';
import { computeMetrics } from './metrics';
import { runDiagnostics } from './diagnostics';
import { balanceVerdictFor, computeScores, verdictFor } from './scoring';
import { buildRecommendations } from './recommendations';
import { clamp } from './metrics/signal';
import { DEFAULT_TUNABLES, withOverrides, type Tunables } from './tunables';
import type { Sensitivity } from './learning';

export const ENGINE_VERSION = '1.0.0';

export interface AnalyseOptions {
  /** Override any threshold or weight for this run only. */
  tunables?: Partial<Tunables>;
  /** Bike config to analyse against. Defaults to the run's own snapshot. */
  bike?: BikeConfig;
  /**
   * Response rates learned from the rider's previous runs. When present the
   * engine sizes its suggestions from what this bike actually did rather than
   * from a generic constant.
   */
  sensitivities?: Sensitivity[];
}

/**
 * Confidence floor derived from run quality: a 20-second run with three
 * compressions cannot support the same certainty as a full descent.
 */
function baseConfidence(durationSec: number, events: number, tunables: Tunables): number {
  const byLength = clamp(durationSec / tunables.minRunSec, 0.35, 1);
  const byEvents = clamp(events / 20, 0.35, 1);
  return Math.min(byLength, byEvents);
}

/**
 * Analyse one run. Pure and synchronous: no storage, no network, no React.
 * This is the function a future native app reuses unchanged.
 */
export function analyseSession(session: Session, options: AnalyseOptions = {}): AnalysisReport {
  const tunables = withOverrides(options.tunables);
  const bike = options.bike ?? session.setupSnapshot;
  const style = tunables.styles[bike.rider.style] ?? DEFAULT_TUNABLES.styles.balanced;

  const metrics = computeMetrics(session.samples, bike, tunables);
  const warnings: string[] = [];

  if (metrics.durationSec < tunables.hardMinRunSec) {
    warnings.push(
      'Run troppo breve per essere analizzata. Registra almeno una discesa completa.',
    );
    return {
      sessionId: session.id,
      generatedAt: new Date().toISOString(),
      engineVersion: ENGINE_VERSION,
      ridingStyle: bike.rider.style,
      metrics,
      diagnoses: [],
      recommendations: [],
      scores: { front: 0, rear: null, balance: null, overall: 0 },
      verdicts: { front: 'unknown', rear: null, balance: null },
      warnings,
    };
  }

  if (metrics.durationSec < tunables.minRunSec) {
    warnings.push('Run breve: i consigli hanno una affidabilità ridotta.');
  }
  if (metrics.front.compressionEvents < 10) {
    warnings.push('Poche compressioni rilevate: prova su un tratto più tecnico.');
  }
  if (bike.rearSuspension.present && !metrics.rear) {
    warnings.push('Nessun dato dal sensore posteriore: analizzata solo la forcella.');
  }

  const events =
    metrics.front.compressionEvents + (metrics.rear?.compressionEvents ?? metrics.front.compressionEvents);
  const ctx = {
    metrics,
    bike,
    style,
    tunables,
    baseConfidence: baseConfidence(metrics.durationSec, events / 2, tunables),
  };

  const diagnoses = runDiagnostics(ctx);
  const recommendations = buildRecommendations(diagnoses, {
    bike,
    metrics,
    style,
    tunables,
    sensitivities: options.sensitivities,
  });

  return {
    sessionId: session.id,
    generatedAt: new Date().toISOString(),
    engineVersion: ENGINE_VERSION,
    ridingStyle: bike.rider.style,
    metrics,
    diagnoses,
    recommendations,
    scores: computeScores(metrics, diagnoses, tunables),
    verdicts: {
      front: verdictFor(metrics, 'front', style),
      rear: metrics.rear ? verdictFor(metrics, 'rear', style) : null,
      balance: balanceVerdictFor(metrics, tunables),
    },
    warnings,
  };
}

/** Top N recommendations for Standard mode. */
export function standardRecommendations(
  report: AnalysisReport,
  tunables: Tunables = DEFAULT_TUNABLES,
) {
  return report.recommendations.slice(0, tunables.maxStandardRecommendations);
}
