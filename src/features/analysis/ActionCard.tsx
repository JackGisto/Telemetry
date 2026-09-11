import { useState } from 'react';
import type { BikeConfig, Recommendation } from '@/types';
import { applyRecommendation, isApplicable } from '@/analysis';
import { Button, Card, useToast } from '@/design-system';
import { useBikeStore } from '@/app/store';
import { actionSummary } from './presentation';

/**
 * One thing to do, stated so it can be done.
 *
 * The whole product turns on this card. A diagnosis the rider cannot act on is
 * worth nothing, so the card leads with the start and end values, then how to
 * physically make the change, then what should feel different. Everything else
 * about the run is secondary to getting this one instruction right.
 *
 * Only one action is shown at a time on purpose: changing two settings at once
 * makes the next run impossible to attribute, which is exactly what the
 * comparison and the learned response rates depend on.
 */
export function ActionCard({
  recommendation,
  index,
  bike,
  onApplied,
}: {
  recommendation: Recommendation;
  index: number;
  bike: BikeConfig;
  onApplied?: () => void;
}) {
  const [showHowTo, setShowHowTo] = useState(false);
  const [applied, setApplied] = useState(false);
  const upsert = useBikeStore((s) => s.upsert);
  const toast = useToast();

  const change = recommendation.change;
  const canApply = isApplicable(bike, recommendation);

  const apply = async () => {
    await upsert(applyRecommendation(bike, recommendation));
    setApplied(true);
    toast.push({
      tone: 'ok',
      title: 'Setup aggiornato',
      body: 'Registra una nuova run per verificare la modifica.',
    });
    onApplied?.();
  };

  return (
    <Card className="stack stack--4" style={{ borderColor: 'var(--c-accent)' }}>
      <div className="row" style={{ gap: 'var(--s-3)', alignItems: 'flex-start' }}>
        <span className="rec__index" aria-hidden="true">
          {index}
        </span>
        <div className="grow stack stack--1">
          <strong style={{ fontSize: '1.15rem', lineHeight: 1.3 }}>{recommendation.title}</strong>
          <span className="text-xs faint">{actionSummary(recommendation)}</span>
        </div>
      </div>

      {change && (
        <div className="change">
          <span className="change__label">{change.label}</span>
          <div className="change__values">
            <span className="change__from ds-mono">
              {change.from}
              <span className="change__unit"> {change.unit}</span>
            </span>
            <span className="change__arrow" aria-hidden="true">
              →
            </span>
            <span className="change__to ds-mono">
              {change.to}
              <span className="change__unit"> {change.unit}</span>
            </span>
          </div>
        </div>
      )}

      <p className="text-sm muted">{recommendation.rationale}</p>

      {recommendation.howTo.length > 0 && (
        <div className="stack stack--3">
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={showHowTo}
            onClick={() => setShowHowTo((open) => !open)}
          >
            {showHowTo ? 'Nascondi come si fa' : 'Come si fa'}
          </Button>

          {showHowTo && (
            <ol className="stack stack--2 text-sm" style={{ margin: 0, paddingLeft: '1.2rem' }}>
              {recommendation.howTo.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          )}
        </div>
      )}

      <div className="expect">
        <span className="expect__label">Cosa dovresti sentire</span>
        {recommendation.expect}
      </div>

      {canApply &&
        (applied ? (
          <p className="text-sm" style={{ color: 'var(--c-ok)' }}>
            ✓ Registrata nel setup. Fai una nuova run e confrontala con questa.
          </p>
        ) : (
          <Button variant="primary" size="lg" block onClick={() => void apply()}>
            Ho fatto questa modifica
          </Button>
        ))}
    </Card>
  );
}
