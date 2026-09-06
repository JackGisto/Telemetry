import { useState } from 'react';
import type { TransportKind } from '@/types';
import { availableTransports, errorMessage } from '@/ble';
import { Button, Card, ErrorState, StatusIndicator, useToast } from '@/design-system';
import { useDeviceStore } from '@/app/store';

/**
 * Device connection, reused by onboarding and by the Run screen.
 *
 * It states plainly what this browser can do rather than offering a Bluetooth
 * button that will fail: Web Bluetooth is missing on iOS Safari and Firefox.
 */
export function ConnectPanel({ onConnected }: { onConnected?: () => void }) {
  const { connection, info, status, connect, disconnect, lastError } = useDeviceStore();
  const [busy, setBusy] = useState<TransportKind | null>(null);
  const toast = useToast();
  const options = availableTransports();

  const handleConnect = async (kind: TransportKind) => {
    setBusy(kind);
    try {
      await connect(kind);
      toast.push({ tone: 'ok', title: 'Dispositivo collegato' });
      onConnected?.();
    } catch {
      const code = useDeviceStore.getState().lastError ?? 'device-not-found';
      const message = errorMessage(code);
      toast.push({ tone: 'danger', title: message.title, body: message.body });
    } finally {
      setBusy(null);
    }
  };

  if (connection === 'connected' && info && status) {
    return (
      <Card className="stack stack--4">
        <div className="row row--between">
          <div className="stack stack--1">
            <strong>{info.name}</strong>
            <span className="text-xs faint ds-mono">
              fw {info.firmwareVersion} · {info.sampleRateHz} Hz
            </span>
          </div>
          <StatusIndicator tone="ok" label="Collegato" />
        </div>
        <div className="row row--wrap" style={{ gap: 'var(--s-4)' }}>
          <StatusIndicator
            tone={status.batteryPercent > 20 ? 'ok' : status.batteryPercent > 10 ? 'warn' : 'danger'}
            label={`Batteria ${status.batteryPercent}%`}
          />
          <StatusIndicator
            tone={status.storageUsed < 0.9 ? 'ok' : 'danger'}
            label={`Memoria ${Math.round(status.storageUsed * 100)}%`}
          />
          <StatusIndicator
            tone={status.sensors.front === 'ok' ? 'ok' : 'danger'}
            label={`Sensore forcella ${status.sensors.front === 'ok' ? 'ok' : 'assente'}`}
          />
          {status.sensors.rear && (
            <StatusIndicator
              tone={status.sensors.rear === 'ok' ? 'ok' : 'warn'}
              label={`Sensore posteriore ${status.sensors.rear === 'ok' ? 'ok' : 'assente'}`}
            />
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={() => void disconnect()}>
          Disconnetti
        </Button>
      </Card>
    );
  }

  if (connection === 'lost') {
    const message = errorMessage('connection-lost');
    return (
      <Card>
        <ErrorState
          title={message.title}
          body={message.body}
          action={
            <Button variant="primary" onClick={() => void handleConnect('mock')}>
              Riprova
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <div className="stack stack--3">
      {options.map((option) => (
        <Card key={option.kind} className="stack stack--3">
          <div className="row row--between">
            <strong>{option.label}</strong>
            {!option.available && <StatusIndicator tone="warn" label="Non disponibile" />}
          </div>
          {option.note && <p className="text-sm muted">{option.note}</p>}
          <Button
            variant={option.kind === 'ble' ? 'primary' : 'secondary'}
            block
            disabled={!option.available}
            loading={busy === option.kind}
            onClick={() => void handleConnect(option.kind)}
          >
            {busy === option.kind
              ? connection === 'scanning'
                ? 'Ricerca dispositivo…'
                : 'Connessione…'
              : 'Collega'}
          </Button>
        </Card>
      ))}

      {lastError && (
        <p className="text-sm" style={{ color: 'var(--c-danger)' }} role="alert">
          {errorMessage(lastError).body}
        </p>
      )}
    </div>
  );
}
