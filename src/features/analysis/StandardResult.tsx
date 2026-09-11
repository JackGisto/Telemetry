import { useState } from 'react';
import type { AnalysisReport, BikeConfig, Recommendation } from '@/types';
import type { SetupLearning } from '@/analysis';
import { Badge, Button, Card } from '@/design-system';
import { TermInfo } from '@/features/help/TermInfo';
import { ActionCard } from './ActionCard';
import { LearnedPanel } from './LearnedPanel';
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
  bike,
  learning,
  maxRecommendations = 3,
}: {
  report: AnalysisReport;
  /** Needed to write an applied change back into the setup. */
  bike?: BikeConfig;
  /** What previous runs taught, shown so the numbers can be trusted. */
  learning?: SetupLearning;
  maxRecommendations?: number;
}) {
  const [showOthers, setShowOthers] = useState(false);
  const recommendations = report.recommendations.slice(0, maxRecommendations);
  const [primary, ...others] = recommendations;
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
          <span className="info-label">
            <span className="ds-label">Valutazione complessiva</span>
            <TermInfo id="score" />
          </span>
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
          <span className="info-label">
            <span className="verdict-row__label">Forcella</span>
            <TermInfo id="travel-max" />
          </span>
          <div className="row" style={{ gap: 'var(--s-2)' }}>
            <span className="verdict-row__value">{VERDICT_LABEL[report.verdicts.front]}</span>
            <Badge tone={VERDICT_TONE[report.verdicts.front]}>
              {report.scores.front}
            </Badge>
          </div>
        </div>

        {report.verdicts.rear && (
          <div className="verdict-row">
            <span className="info-label">
              <span className="verdict-row__label">Posteriore</span>
              <TermInfo id="travel-max" />
            </span>
            <div className="row" style={{ gap: 'var(--s-2)' }}>
              <span className="verdict-row__value">{VERDICT_LABEL[report.verdicts.rear]}</span>
              <Badge tone={VERDICT_TONE[report.verdicts.rear]}>{report.scores.rear}</Badge>
            </div>
          </div>
        )}

        {report.verdicts.balance && (
          <div className="verdict-row">
            <span className="info-label">
              <span className="verdict-row__label">Bilanciamento</span>
              <TermInfo id="balance" />
            </span>
            <div className="row" style={{ gap: 'var(--s-2)' }}>
              <span className="verdict-row__value">{BALANCE_LABEL[report.verdicts.balance]}</span>
              <Badge tone={BALANCE_TONE[report.verdicts.balance]}>{report.scores.balance}</Badge>
            </div>
          </div>
        )}
      </Card>

      {primary && (
        <div className="stack stack--3">
          <span className="ds-label">
            {others.length > 0 ? 'Fai prima questa' : 'Azione consigliata'}
          </span>

          {bike ? (
            <ActionCard recommendation={primary} index={1} bike={bike} />
          ) : (
            <Card>
              <ol className="rec-list">
                <RecommendationRow rec={primary} index={1} />
              </ol>
            </Card>
          )}

          {others.length > 0 && (
            <>
              <p className="text-sm muted">
                Cambia una cosa per volta: se ne cambi due, la run successiva non dice quale delle
                due ha funzionato.
              </p>

              <Button
                variant="ghost"
                size="sm"
                aria-expanded={showOthers}
                onClick={() => setShowOthers((open) => !open)}
              >
                {showOthers
                  ? 'Nascondi le altre'
                  : `Altre ${others.length} ${others.length === 1 ? 'modifica' : 'modifiche'} da fare dopo`}
              </Button>

              {showOthers && (
                <Card>
                  <ol className="rec-list">
                    {others.map((rec, index) => (
                      <RecommendationRow key={rec.id} rec={rec} index={index + 2} />
                    ))}
                  </ol>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {learning && <LearnedPanel learning={learning} />}

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
        <div className="rec__meta">
          {rec.change
            ? `${rec.change.label}: da ${rec.change.from} a ${rec.change.to} ${rec.change.unit}`
            : actionSummary(rec)}
        </div>
        <p className="text-sm muted" style={{ marginTop: 'var(--s-2)' }}>
          {rec.rationale}
        </p>
      </div>
    </li>
  );
}
