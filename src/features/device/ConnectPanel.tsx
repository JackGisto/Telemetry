import { useState } from 'react';
import type { TransportKind } from '@/types';
import { availableTransports, errorMessage } from '@/transport';
import {
  Button,
  Card,
  ErrorState,
  Field,
  StatusIndicator,
  useToast,
} from '@/design-system';
import { useDeviceStore, useSettingsStore } from '@/app/store';

/**
 * Device connection, reused by onboarding, the Run screen and Settings.
 *
 * Wi-Fi leads because it is the channel that works on every phone. Each option
 * states plainly whether this browser can actually use it, rather than offering
 * a button that will fail on click.
 */
export function ConnectPanel({ onConnected }: { onConnected?: () => void }) {
  const { connection, info, status, connect, disconnect, lastError } = useDeviceStore();
  const { deviceOrigin, update } = useSettingsStore();
  const [origin, setOrigin] = useState(deviceOrigin);
  const [busy, setBusy] = useState<TransportKind | null>(null);
  const toast = useToast();
  const options = availableTransports(origin);

  const handleConnect = async (kind: TransportKind) => {
    setBusy(kind);
    try {
      await connect(kind, kind === 'wifi' ? origin : undefined);
      if (kind === 'wifi' && origin !== deviceOrigin) await update({ deviceOrigin: origin });
      await update({ preferredTransport: kind === 'usb' ? 'wifi' : kind });
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
            <Button variant="primary" onClick={() => void handleConnect('wifi')}>
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
            <span className="info-label">
              <strong>{option.label}</strong>
              {option.primary && <span className="badge badge--info">Consigliato</span>}
            </span>
            {!option.available && <StatusIndicator tone="warn" label="Non disponibile" />}
          </div>

          <p className="text-sm muted">{option.description}</p>

          {option.kind === 'wifi' && (
            <>
              <ol className="stack stack--1 text-sm muted" style={{ margin: 0, paddingLeft: '1.2rem' }}>
                <li>Accendi il dispositivo sulla bici.</li>
                <li>Collega il telefono alla rete Wi-Fi del dispositivo.</li>
                <li>Torna qui e premi Collega.</li>
              </ol>
              <Field
                label="Indirizzo del dispositivo"
                hint="Cambialo solo se il dispositivo è collegato alla tua rete di casa."
                htmlFor="device-origin"
              >
                <input
                  id="device-origin"
                  className="input ds-mono"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  value={origin}
                  onChange={(event) => setOrigin(event.target.value.trim())}
                />
              </Field>
            </>
          )}

          {option.note && (
            <p className="text-sm" style={{ color: 'var(--c-warn)' }}>
              {option.note}
            </p>
          )}

          <Button
            variant={option.primary ? 'primary' : 'secondary'}
            block
            disabled={!option.available}
            loading={busy === option.kind}
            onClick={() => void handleConnect(option.kind)}
          >
            {busy === option.kind
              ? busy === 'ble'
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
