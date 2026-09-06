import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AnalysisReport } from '@/types';
import { Badge, Button, Card, StatusIndicator } from '@/design-system';
import { getReport } from '@/storage';
import { ScreenHeader } from '@/app/AppShell';
import { useBikeStore, useDeviceStore, useHistoryStore } from '@/app/store';
import { formatDateTime, scoreLabel, scoreTone } from '@/features/analysis/presentation';

/** Home: what is the state of my setup right now, and what is the next step? */
export function HomePage() {
  const navigate = useNavigate();
  const bike = useBikeStore((s) => s.activeBike());
  const sessions = useHistoryStore((s) => s.sessions);
  const { connection, status } = useDeviceStore();
  const [lastReport, setLastReport] = useState<AnalysisReport | null>(null);

  const latest = sessions[0];

  useEffect(() => {
    if (!latest) {
      setLastReport(null);
      return;
    }
    // Guard against the read resolving after the rider has navigated away.
    let cancelled = false;
    void getReport(latest.id).then((report) => {
      if (!cancelled) setLastReport(report ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [latest]);

  return (
    <>
      <ScreenHeader title="Telemetria MTB" question="Misura. Analizza. Regola." />

      <div className="stack stack--4">
        <Card className="stack stack--3">
          <div className="row row--between">
            <span className="ds-label">Dispositivo</span>
            <StatusIndicator
              tone={connection === 'connected' ? 'ok' : 'neutral'}
              label={connection === 'connected' ? 'Collegato' : 'Non collegato'}
              live={status?.recording}
            />
          </div>
          <div className="row row--between text-sm">
            <span className="muted">Bici attiva</span>
            <strong>{bike?.name ?? 'Nessuna'}</strong>
          </div>
          <Button variant="primary" block onClick={() => navigate('/app/run')}>
            {status?.recording ? 'Registrazione in corso' : 'Vai alla Run'}
          </Button>
        </Card>

        {lastReport && latest ? (
          <Card className="stack stack--3">
            <div className="row row--between">
              <span className="ds-label">Ultima run</span>
              <Badge tone={scoreTone(lastReport.scores.overall)}>
                {lastReport.scores.overall}/100 · {scoreLabel(lastReport.scores.overall)}
              </Badge>
            </div>
            <span className="text-sm muted">{formatDateTime(latest.startedAt)}</span>
            {lastReport.recommendations[0] ? (
              <p>
                <strong>Prossima modifica:</strong> {lastReport.recommendations[0].title}
              </p>
            ) : (
              <p className="muted">Nessuna modifica consigliata: la bici sta lavorando bene.</p>
            )}
            <Button variant="secondary" block onClick={() => navigate(`/app/analisi/${latest.id}`)}>
              Apri l’analisi
            </Button>
          </Card>
        ) : (
          <Card className="stack stack--3">
            <span className="ds-label">Per iniziare</span>
            <p className="muted">
              Collega il dispositivo, calibra le sospensioni e registra una discesa. L’analisi
              arriva subito dopo il download.
            </p>
            <Button variant="secondary" block onClick={() => navigate('/app/run')}>
              Registra la prima run
            </Button>
          </Card>
        )}

        {sessions.length >= 2 && (
          <Card className="stack stack--3">
            <span className="ds-label">Confronta</span>
            <p className="muted text-sm">
              Hai {sessions.length} run salvate. Confrontane due per capire se una modifica ha
              funzionato.
            </p>
            <Button variant="ghost" block onClick={() => navigate('/app/storico')}>
              Apri lo storico
            </Button>
          </Card>
        )}
      </div>
    </>
  );
}
