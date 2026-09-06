import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { AnalysisReport, Session } from '@/types';
import { Button, Card, ComparisonBars, ErrorState, LoadingState } from '@/design-system';
import { ScreenHeader } from '@/app/AppShell';
import { useHistoryStore } from '@/app/store';
import { formatDateTime } from '@/features/analysis/presentation';
import { buildComparisonRows, buildSetupChanges, verdictSentence } from './comparison';

type Pair = { session: Session; report: AnalysisReport };

/** Side-by-side comparison of two runs, oldest on the left. */
export function ComparePage() {
  const { idA = '', idB = '' } = useParams();
  const navigate = useNavigate();
  const open = useHistoryStore((s) => s.open);
  const [pair, setPair] = useState<[Pair, Pair] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([open(idA), open(idB)]).then(([a, b]) => {
      if (cancelled) return;
      if (a && b) {
        // Always present the older run first, so a delta reads as "what changed".
        const ordered: [Pair, Pair] =
          a.session.startedAt <= b.session.startedAt ? [a, b] : [b, a];
        setPair(ordered);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [idA, idB, open]);

  if (loading) return <LoadingState label="Confronto in corso…" />;

  if (!pair) {
    return (
      <ErrorState
        title="Confronto non disponibile"
        body="Una delle due run non è più presente su questo dispositivo."
        action={
          <Button variant="primary" onClick={() => navigate('/app/storico')}>
            Torna allo storico
          </Button>
        }
      />
    );
  }

  const [a, b] = pair;
  const rows = buildComparisonRows(a.report, b.report);
  const changes = buildSetupChanges(a.session, b.session);

  return (
    <>
      <ScreenHeader
        title="Confronto"
        question="Cosa è cambiato tra le due run?"
        action={
          <Button variant="ghost" size="sm" onClick={() => navigate('/app/storico')}>
            Storico
          </Button>
        }
      />

      <div className="stack stack--4">
        <Card className="stack stack--2">
          <span className="ds-label">Esito</span>
          <strong style={{ fontSize: 'var(--fs-h3)' }}>{verdictSentence(a.report, b.report)}</strong>
          <span className="text-sm muted">
            Score {a.report.scores.overall} → {b.report.scores.overall}
          </span>
        </Card>

        <Card className="stack stack--3">
          <h2 className="card__title" style={{ margin: 0 }}>
            Modifiche al setup
          </h2>
          {changes.length === 0 ? (
            <p className="text-sm muted">Nessuna differenza registrata nelle impostazioni.</p>
          ) : (
            changes.map((change) => (
              <div key={change.label} className="row row--between text-sm">
                <span className="muted">{change.label}</span>
                <span className="ds-mono">
                  {change.from} → <strong>{change.to}</strong>
                </span>
              </div>
            ))
          )}
        </Card>

        <Card className="stack stack--3">
          <h2 className="card__title" style={{ margin: 0 }}>
            Metriche a confronto
          </h2>
          <div className="compare-grid">
            <span className="compare-grid__head">Metrica</span>
            <span className="compare-grid__head">{formatDateTime(a.session.startedAt).slice(0, 6)}</span>
            <span className="compare-grid__head">{formatDateTime(b.session.startedAt).slice(0, 6)}</span>

            {rows.map((row) => {
              const delta = (row.b ?? 0) - (row.a ?? 0);
              const improved =
                row.better === 'neutral' || delta === 0
                  ? null
                  : (delta < 0) === (row.better === 'lower');
              return (
                <FragmentRow
                  key={row.label}
                  label={row.label}
                  left={row.a === null ? '—' : `${row.a.toFixed(row.decimals)}${row.unit}`}
                  right={row.b === null ? '—' : `${row.b.toFixed(row.decimals)}${row.unit}`}
                  improved={improved}
                />
              );
            })}
          </div>
        </Card>

        <Card className="stack stack--3">
          <h2 className="card__title" style={{ margin: 0 }}>
            Variazione
          </h2>
          <p className="text-sm muted">Verde: la seconda run è migliorata su quella metrica.</p>
          <ComparisonBars
            rows={rows
              .filter((r) => r.a !== null && r.b !== null && r.better !== 'neutral')
              .map((r) => ({ label: r.label, a: r.a as number, b: r.b as number, better: r.better }))}
          />
        </Card>

        <div className="row" style={{ gap: 'var(--s-2)' }}>
          <Button size="sm" onClick={() => navigate(`/app/analisi/${a.session.id}`)}>
            Apri prima run
          </Button>
          <Button size="sm" onClick={() => navigate(`/app/analisi/${b.session.id}`)}>
            Apri seconda run
          </Button>
        </div>
      </div>
    </>
  );
}

function FragmentRow({
  label,
  left,
  right,
  improved,
}: {
  label: string;
  left: string;
  right: string;
  improved: boolean | null;
}) {
  return (
    <>
      <span className="compare-grid__row-label">{label}</span>
      <span className="compare-grid__cell">{left}</span>
      <span
        className={`compare-grid__cell${improved === null ? '' : improved ? ' delta-up' : ' delta-down'}`}
      >
        {right} {improved === null ? '' : improved ? '▲' : '▼'}
      </span>
    </>
  );
}
