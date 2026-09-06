import { Suspense, lazy, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { AnalysisReport, Session } from '@/types';
import {
  Button,
  Card,
  ErrorState,
  Field,
  LoadingState,
  Segmented,
  useToast,
} from '@/design-system';
import { ScreenHeader } from '@/app/AppShell';
import { useHistoryStore, useSettingsStore } from '@/app/store';
import { downloadFile } from '@/features/export/download';
import { samplesToCsv, summaryToCsv, toJson } from '@/features/export/exporters';
import { StandardResult } from './StandardResult';

// Expert mode pulls in the charting library; keep it out of the default path.
const ExpertResult = lazy(() =>
  import('./ExpertResult').then((m) => ({ default: m.ExpertResult })),
);
import { formatDateTime, formatDuration } from './presentation';

/** Analysis screen. Answers: how is my bike working, and what should I change? */
export function AnalysisPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { open, updateMeta } = useHistoryStore();
  const { mode, update: updateSettings } = useSettingsStore();

  const [data, setData] = useState<{ session: Session; report: AnalysisReport } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [trail, setTrail] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void open(id).then((result) => {
      if (cancelled) return;
      setData(result);
      setNotes(result?.session.notes ?? '');
      setTrail(result?.session.trail ?? '');
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id, open]);

  if (loading) return <LoadingState label="Analisi della run…" />;

  if (!data) {
    return (
      <ErrorState
        title="Non è stato possibile leggere questa sessione."
        body="La run non esiste più oppure i dati sono danneggiati."
        action={
          <Button variant="primary" onClick={() => navigate('/app/storico')}>
            Torna allo storico
          </Button>
        }
      />
    );
  }

  const { session, report } = data;

  const saveNotes = async () => {
    await updateMeta(session.id, { notes, trail });
    setData({ ...data, session: { ...session, notes, trail } });
    toast.push({ tone: 'ok', title: 'Note salvate' });
  };

  const exportRun = (format: 'json' | 'csv' | 'csv-summary') => {
    const stamp = session.startedAt.slice(0, 10);
    if (format === 'json') {
      downloadFile(`run-${stamp}.json`, toJson(session, report), 'application/json');
    } else if (format === 'csv') {
      downloadFile(`run-${stamp}-campioni.csv`, samplesToCsv(session), 'text/csv');
    } else {
      downloadFile(`run-${stamp}-riepilogo.csv`, summaryToCsv(session, report), 'text/csv');
    }
    toast.push({ tone: 'ok', title: 'Export completato' });
  };

  return (
    <>
      <ScreenHeader
        title="Analisi"
        question="Come sta lavorando la mia bici?"
        action={
          <Button variant="ghost" size="sm" onClick={() => navigate('/app/storico')}>
            Storico
          </Button>
        }
      />

      <div className="stack stack--4">
        <div className="row row--between text-sm muted">
          <span>{formatDateTime(session.startedAt)}</span>
          <span className="ds-mono">{formatDuration(session.durationSec)}</span>
        </div>

        <Segmented
          ariaLabel="Modalità di visualizzazione"
          value={mode}
          options={[
            { value: 'standard' as const, label: 'Standard' },
            { value: 'expert' as const, label: 'Esperto' },
          ]}
          onChange={(next) => void updateSettings({ mode: next })}
        />

        {mode === 'standard' ? (
          <StandardResult report={report} />
        ) : (
          <>
            <StandardResult report={report} maxRecommendations={3} />
            <Suspense fallback={<LoadingState label="Caricamento grafici…" />}>
              <ExpertResult session={session} report={report} />
            </Suspense>
          </>
        )}

        <Card className="stack stack--4">
          <h2 className="card__title" style={{ margin: 0 }}>
            Note setup
          </h2>
          <Field label="Trail" htmlFor="run-trail">
            <input
              id="run-trail"
              className="input"
              value={trail}
              placeholder="Es. Sentiero dei Larici"
              onChange={(e) => setTrail(e.target.value)}
            />
          </Field>
          <Field label="Note" hint="Es. +5 PSI mono · trail asciutto · sensazione migliore" htmlFor="run-notes">
            <textarea
              id="run-notes"
              className="textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
          <Button variant="secondary" onClick={() => void saveNotes()}>
            Salva note
          </Button>
        </Card>

        <Card className="stack stack--3">
          <h2 className="card__title" style={{ margin: 0 }}>
            Export
          </h2>
          <p className="text-sm muted">
            L’export contiene configurazione bici, impostazioni, dati della sessione, metriche,
            diagnosi e raccomandazioni.
          </p>
          <div className="row row--wrap" style={{ gap: 'var(--s-2)' }}>
            <Button size="sm" onClick={() => exportRun('json')}>
              JSON completo
            </Button>
            <Button size="sm" onClick={() => exportRun('csv-summary')}>
              CSV riepilogo
            </Button>
            <Button size="sm" onClick={() => exportRun('csv')}>
              CSV campioni
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}
