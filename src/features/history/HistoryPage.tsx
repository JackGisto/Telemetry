import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AnalysisReport, SessionMeta } from '@/types';
import { Badge, Button, Card, ConfirmModal, EmptyState, LoadingState } from '@/design-system';
import { getReport } from '@/storage';
import { ScreenHeader } from '@/app/AppShell';
import { useHistoryStore } from '@/app/store';
import { formatDateTime, formatDuration, scoreTone } from '@/features/analysis/presentation';

/** History answers: did the change I made actually work? */
export function HistoryPage() {
  const navigate = useNavigate();
  const { sessions, loading, load, remove } = useHistoryStore();
  const [scores, setScores] = useState<Record<string, AnalysisReport['scores'] | undefined>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  // Scores come from the cached reports, so the list never re-runs the engine.
  useEffect(() => {
    let cancelled = false;
    void Promise.all(sessions.map((s) => getReport(s.id))).then((reports) => {
      if (cancelled) return;
      const next: Record<string, AnalysisReport['scores'] | undefined> = {};
      sessions.forEach((s, i) => {
        next[s.id] = reports[i]?.scores;
      });
      setScores(next);
    });
    return () => {
      cancelled = true;
    };
  }, [sessions]);

  const toggle = (id: string) => {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((x) => x !== id)
        : // Keep only the two most recent picks: comparison is always pairwise.
          [...current, id].slice(-2),
    );
  };

  if (loading) return <LoadingState label="Caricamento run…" />;

  if (sessions.length === 0) {
    return (
      <>
        <ScreenHeader title="Storico" />
        <EmptyState
          glyph="≡"
          title="Nessuna run salvata"
          body="Registra una run e scarica i dati dal dispositivo: la troverai qui."
          action={
            <Button variant="primary" onClick={() => navigate('/app/run')}>
              Vai alla Run
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      <ScreenHeader
        title="Storico"
        question="La modifica che ho fatto ha funzionato?"
        action={
          selected.length === 2 ? (
            <Button
              size="sm"
              variant="primary"
              onClick={() => navigate(`/app/confronto/${selected[0]}/${selected[1]}`)}
            >
              Confronta
            </Button>
          ) : undefined
        }
      />

      <div className="stack stack--3">
        {selected.length === 1 && (
          <p className="text-sm muted">Seleziona una seconda run per confrontarle.</p>
        )}

        {sessions.map((session, index) => (
          <RunCard
            key={session.id}
            session={session}
            number={sessions.length - index}
            scores={scores[session.id]}
            selected={selected.includes(session.id)}
            onOpen={() => navigate(`/app/analisi/${session.id}`)}
            onToggle={() => toggle(session.id)}
            onDelete={() => setPendingDelete(session.id)}
          />
        ))}
      </div>

      <ConfirmModal
        open={pendingDelete !== null}
        title="Eliminare questa run?"
        body="La run, la sua analisi e le note verranno eliminate definitivamente da questo dispositivo."
        confirmLabel="Elimina"
        destructive
        onConfirm={() => {
          if (pendingDelete) void remove(pendingDelete);
        }}
        onClose={() => setPendingDelete(null)}
      />
    </>
  );
}

function RunCard({
  session,
  number,
  scores,
  selected,
  onOpen,
  onToggle,
  onDelete,
}: {
  session: SessionMeta;
  number: number;
  scores?: AnalysisReport['scores'];
  selected: boolean;
  onOpen: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const setup = session.setupSnapshot;
  const rear = setup.rearSuspension.present ? setup.rearSuspension : null;

  return (
    <Card
      className="stack stack--3"
      style={selected ? { borderColor: 'var(--c-accent)' } : undefined}
    >
      <div className="row row--between">
        <div className="stack stack--1">
          <strong>Run #{number}</strong>
          <span className="text-xs faint">{formatDateTime(session.startedAt)}</span>
        </div>
        {scores && <Badge tone={scoreTone(scores.overall)}>{scores.overall}/100</Badge>}
      </div>

      <div className="row row--wrap text-xs faint ds-mono" style={{ gap: 'var(--s-3)' }}>
        <span>{formatDuration(session.durationSec)}</span>
        {setup.frontSuspension.pressurePsi !== undefined && (
          <span>Forcella {setup.frontSuspension.pressurePsi} PSI</span>
        )}
        {rear?.pressurePsi !== undefined && <span>Mono {rear.pressurePsi} PSI</span>}
        {session.trail && <span>{session.trail}</span>}
      </div>

      {session.notes && <p className="text-sm muted">{session.notes}</p>}

      <div className="row" style={{ gap: 'var(--s-2)' }}>
        <Button size="sm" variant="primary" onClick={onOpen}>
          Apri
        </Button>
        <Button size="sm" variant="ghost" aria-pressed={selected} onClick={onToggle}>
          {selected ? 'Selezionata' : 'Confronta'}
        </Button>
        <div className="grow" />
        <Button size="sm" variant="ghost" onClick={onDelete} aria-label={`Elimina run ${number}`}>
          Elimina
        </Button>
      </div>
    </Card>
  );
}
