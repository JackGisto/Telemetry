import type { AnalysisReport, Recommendation } from '@/types';
import { Badge, Card } from '@/design-system';
import {
  BALANCE_LABEL,
  BALANCE_TONE,
  VERDICT_LABEL,
  VERDICT_TONE,
  actionSummary,
  scoreLabel,
  scoreTone,
} from './presentation';

/**
 * Standard mode: three verdicts and at most three actions.
 *
 * No formulas, no metric names, no numbers beyond the score. Everything else
 * lives behind Expert mode.
 */
export function StandardResult({
  report,
  maxRecommendations = 3,
}: {
  report: AnalysisReport;
  maxRecommendations?: number;
}) {
  const recommendations = report.recommendations.slice(0, maxRecommendations);
  const tone = scoreTone(report.scores.overall);

  return (
    <div className="stack stack--4">
      <Card className="row" style={{ gap: 'var(--s-5)' }}>
        <div
          className="score"
          style={{ background: `var(--c-${tone}-dim)`, border: `2px solid var(--c-${tone})` }}
        >
          <div className="center">
            <div className="score__value" style={{ color: `var(--c-${tone})` }}>
              {report.scores.overall}
            </div>
            <div className="score__max">/ 100</div>
          </div>
        </div>
        <div className="stack stack--2 grow">
          <span className="ds-label">Valutazione complessiva</span>
          <strong style={{ fontSize: 'var(--fs-h3)' }}>{scoreLabel(report.scores.overall)}</strong>
          <span className="text-sm muted">
            {recommendations.length === 0
              ? 'La bici sta lavorando come dovrebbe. Nessuna modifica necessaria.'
              : `${recommendations.length} ${recommendations.length === 1 ? 'modifica consigliata' : 'modifiche consigliate'}.`}
          </span>
        </div>
      </Card>

      <Card>
        <div className="verdict-row">
          <span className="verdict-row__label">Forcella</span>
          <div className="row" style={{ gap: 'var(--s-2)' }}>
            <span className="verdict-row__value">{VERDICT_LABEL[report.verdicts.front]}</span>
            <Badge tone={VERDICT_TONE[report.verdicts.front]}>
              {report.scores.front}
            </Badge>
          </div>
        </div>

        {report.verdicts.rear && (
          <div className="verdict-row">
            <span className="verdict-row__label">Posteriore</span>
            <div className="row" style={{ gap: 'var(--s-2)' }}>
              <span className="verdict-row__value">{VERDICT_LABEL[report.verdicts.rear]}</span>
              <Badge tone={VERDICT_TONE[report.verdicts.rear]}>{report.scores.rear}</Badge>
            </div>
          </div>
        )}

        {report.verdicts.balance && (
          <div className="verdict-row">
            <span className="verdict-row__label">Bilanciamento</span>
            <div className="row" style={{ gap: 'var(--s-2)' }}>
              <span className="verdict-row__value">{BALANCE_LABEL[report.verdicts.balance]}</span>
              <Badge tone={BALANCE_TONE[report.verdicts.balance]}>{report.scores.balance}</Badge>
            </div>
          </div>
        )}
      </Card>

      {recommendations.length > 0 && (
        <Card>
          <h2 className="card__title">Azione consigliata</h2>
          <ol className="rec-list">
            {recommendations.map((rec, index) => (
              <RecommendationRow key={rec.id} rec={rec} index={index + 1} />
            ))}
          </ol>
        </Card>
      )}

      {report.warnings.length > 0 && (
        <Card className="stack stack--2">
          <span className="ds-label">Da sapere</span>
          {report.warnings.map((warning) => (
            <p key={warning} className="text-sm muted">
              · {warning}
            </p>
          ))}
        </Card>
      )}
    </div>
  );
}

function RecommendationRow({ rec, index }: { rec: Recommendation; index: number }) {
  return (
    <li className="rec">
      <span className="rec__index" aria-hidden="true">
        {index}
      </span>
      <div className="grow">
        <div className="rec__title">{rec.title}</div>
        <div className="rec__meta">{actionSummary(rec)}</div>
        <p className="text-sm muted" style={{ marginTop: 'var(--s-2)' }}>
          {rec.rationale}
        </p>
      </div>
    </li>
  );
}
