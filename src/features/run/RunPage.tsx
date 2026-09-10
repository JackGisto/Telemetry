import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  EmptyState,
  Progress,
  StatusIndicator,
  useToast,
} from '@/design-system';
import { errorMessage } from '@/transport';
import { ScreenHeader } from '@/app/AppShell';
import { useBikeStore, useDeviceStore, useHistoryStore } from '@/app/store';
import { ConnectPanel } from '@/features/device/ConnectPanel';
import { CalibrationPanel } from '@/features/calibration/CalibrationPanel';
import { SagPanel, useSagStatus } from '@/features/sag/SagPanel';
import { TermInfo } from '@/features/help/TermInfo';
import { formatDateTime, formatDuration } from '@/features/analysis/presentation';

/**
 * The Run screen answers exactly one question: can I start?
 *
 * Everything above the button is a readiness check; the button itself is the
 * only thing the rider needs to hit with gloves on at the top of a descent.
 */
export function RunPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const {
    connection,
    status,
    sessions,
    transfer,
    resumable,
    startRun,
    stopRun,
    downloadSession,
    refreshStatus,
    loadStoredCalibration,
    calibration,
  } = useDeviceStore();
  const bike = useBikeStore((s) => s.activeBike());
  const sagStatus = useSagStatus();
  const reloadHistory = useHistoryStore((s) => s.load);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    if (bike) void loadStoredCalibration(bike.id);
  }, [bike, loadStoredCalibration]);

  // The device's physical button changes state without the app asking, so poll
  // the status while connected and idle. Notifications keep this cheap.
  useEffect(() => {
    if (connection !== 'connected') return;
    const timer = setInterval(() => void refreshStatus(), 4000);
    return () => clearInterval(timer);
  }, [connection, refreshStatus]);

  if (!bike) {
    return (
      <>
        <ScreenHeader title="Run" />
        <EmptyState
          glyph="⚙"
          title="Configura prima la bici"
          body="L’analisi ha bisogno della corsa delle sospensioni per interpretare i dati."
          action={
            <Button variant="primary" onClick={() => navigate('/app/bici/nuova')}>
              Configura la bici
            </Button>
          }
        />
      </>
    );
  }

  const calibrated = Boolean(calibration?.ok) || Boolean(status?.calibrated);
  const ready = connection === 'connected' && calibrated && !!status && status.batteryPercent > 5;
  const recording = Boolean(status?.recording);

  const handleStart = async () => {
    setBusy(true);
    try {
      await startRun();
      toast.push({ tone: 'ok', title: 'Registrazione avviata' });
    } catch {
      const message = errorMessage(useDeviceStore.getState().lastError ?? 'connection-lost');
      toast.push({ tone: 'danger', title: message.title, body: message.body });
    } finally {
      setBusy(false);
    }
  };

  const handleStop = async () => {
    setBusy(true);
    try {
      await stopRun();
      toast.push({ tone: 'ok', title: 'Run completata', body: 'Ora puoi scaricare i dati.' });
    } catch {
      const message = errorMessage(useDeviceStore.getState().lastError ?? 'connection-lost');
      toast.push({ tone: 'danger', title: message.title, body: message.body });
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async (deviceSessionId: string) => {
    setDownloading(deviceSessionId);
    try {
      const localId = await downloadSession(deviceSessionId);
      await reloadHistory();
      toast.push({ tone: 'ok', title: 'Dati scaricati' });
      navigate(`/app/analisi/${localId}`);
    } catch {
      const message = errorMessage(useDeviceStore.getState().lastError ?? 'transfer-failed');
      toast.push({ tone: 'danger', title: message.title, body: message.body });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <>
      <ScreenHeader title="Run" question="Posso partire?" />

      <div className="stack stack--4">
        {connection !== 'connected' ? (
          <ConnectPanel />
        ) : (
          <Card className="stack stack--3">
            <div className="row row--between">
              <span className="ds-label">Stato</span>
              <StatusIndicator
                tone={ready ? 'ok' : 'warn'}
                label={ready ? 'Pronto' : 'Non pronto'}
              />
            </div>
            <div className="stack stack--2">
              <div className="row row--between text-sm">
                <span className="muted">Bici</span>
                <strong>{bike.name}</strong>
              </div>
              <div className="row row--between text-sm">
                <span className="muted">Batteria</span>
                <StatusIndicator
                  tone={
                    (status?.batteryPercent ?? 0) > 20
                      ? 'ok'
                      : (status?.batteryPercent ?? 0) > 10
                        ? 'warn'
                        : 'danger'
                  }
                  label={`${status?.batteryPercent ?? 0}%`}
                />
              </div>
              <div className="row row--between text-sm">
                <span className="muted">Memoria dispositivo</span>
                <StatusIndicator
                  tone={(status?.storageUsed ?? 0) < 0.9 ? 'ok' : 'danger'}
                  label={`${Math.round((status?.storageUsed ?? 0) * 100)}% usata`}
                />
              </div>
              <div className="row row--between text-sm">
                <span className="muted">Sensori</span>
                <StatusIndicator
                  tone={status?.sensors.front === 'ok' ? 'ok' : 'danger'}
                  label={
                    bike.rearSuspension.present
                      ? `Forcella ${status?.sensors.front === 'ok' ? 'ok' : 'ko'} · Posteriore ${status?.sensors.rear === 'ok' ? 'ok' : 'ko'}`
                      : `Forcella ${status?.sensors.front === 'ok' ? 'ok' : 'ko'}`
                  }
                />
              </div>
              <div className="row row--between text-sm">
                <span className="info-label muted">
                  <span>Calibrazione</span>
                  <TermInfo id="calibration" />
                </span>
                <StatusIndicator
                  tone={calibrated ? 'ok' : 'warn'}
                  label={calibrated ? 'Valida' : 'Da eseguire'}
                />
              </div>
              <div className="row row--between text-sm">
                <span className="info-label muted">
                  <span>Sag</span>
                  <TermInfo id="sag" />
                </span>
                <StatusIndicator
                  tone={sagStatus ? (sagStatus.ok ? 'ok' : 'warn') : 'neutral'}
                  label={
                    sagStatus
                      ? sagStatus.ok
                        ? 'Corretto'
                        : 'Fuori intervallo'
                      : 'Non misurato'
                  }
                />
              </div>
            </div>
          </Card>
        )}

        {connection === 'connected' && !calibrated && <CalibrationPanel />}

        {connection === 'connected' && calibrated && !sagStatus && <SagPanel />}

        {connection === 'connected' && calibrated && (
          <Button
            variant={recording ? 'danger' : 'primary'}
            size="hero"
            loading={busy}
            onClick={() => void (recording ? handleStop() : handleStart())}
          >
            {recording ? 'Stop run' : 'Start run'}
          </Button>
        )}

        {recording && (
          <Card className="row row--between">
            <StatusIndicator tone="danger" live label="Registrazione in corso" />
            <span className="text-sm muted">Puoi mettere via il telefono.</span>
          </Card>
        )}

        {(status?.pendingSessions ?? 0) > 0 && (
          <Card className="stack stack--4">
            <div className="row row--between">
              <h2 className="card__title" style={{ margin: 0 }}>
                Run disponibili
              </h2>
              <span className="badge badge--info">{sessions.length}</span>
            </div>
            <p className="text-sm muted">
              Il dispositivo registra da solo: queste run sono al sicuro anche se il telefono si è
              scollegato.
            </p>

            {resumable && (
              <p className="text-sm" style={{ color: 'var(--c-warn)' }}>
                Trasferimento interrotto. Premi di nuovo Scarica dati per riprendere da dove si era
                fermato.
              </p>
            )}

            <div className="stack stack--3">
              {sessions.map((session) => (
                <div key={session.id} className="stack stack--2">
                  <div className="row row--between">
                    <div className="stack stack--1">
                      <strong className="text-sm">{formatDateTime(session.startedAt)}</strong>
                      <span className="text-xs faint ds-mono">
                        {formatDuration(session.durationSec)} · {Math.round(session.sizeBytes / 1024)} kB
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="primary"
                      loading={downloading === session.id}
                      onClick={() => void handleDownload(session.id)}
                    >
                      Scarica dati
                    </Button>
                  </div>
                  {downloading === session.id && transfer && (
                    <Progress
                      value={transfer.receivedBytes}
                      max={transfer.totalBytes}
                      label="Trasferimento in corso"
                    />
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
