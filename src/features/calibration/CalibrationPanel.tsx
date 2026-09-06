import { useState } from 'react';
import type { CalibrationResult } from '@/types';
import { Button, Card, Progress, useToast } from '@/design-system';
import { errorMessage } from '@/ble';
import { useBikeStore, useDeviceStore } from '@/app/store';

type Phase = 'idle' | 'running' | 'done' | 'failed';

/**
 * Calibration: hold the bike off the ground with the suspension fully extended
 * so the device can learn the zero position of each sensor.
 *
 * Works unchanged on a hardtail: only the channels the device reports are
 * calibrated, and only the fork is mentioned when there is no shock.
 */
export function CalibrationPanel({ onDone }: { onDone?: (result: CalibrationResult) => void }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<CalibrationResult | null>(null);
  const calibrate = useDeviceStore((s) => s.calibrate);
  const connection = useDeviceStore((s) => s.connection);
  const bike = useBikeStore((s) => s.activeBike());
  const toast = useToast();

  const hasRear = bike?.rearSuspension.present ?? false;

  const run = async () => {
    setPhase('running');
    try {
      const outcome = await calibrate();
      setResult(outcome);
      setPhase(outcome.ok ? 'done' : 'failed');
      if (outcome.ok) {
        toast.push({ tone: 'ok', title: 'Calibrazione completata' });
        onDone?.(outcome);
      }
    } catch (error) {
      setPhase('failed');
      setResult(null);
      const message = errorMessage(
        useDeviceStore.getState().lastError ?? 'calibration-failed',
      );
      toast.push({ tone: 'danger', title: message.title, body: message.body });
      void error;
    }
  };

  return (
    <Card className="stack stack--5">
      <div className="stack stack--2">
        <span className="ds-label">Calibrazione</span>
        <p>
          Solleva la bici da terra. {hasRear ? 'Le sospensioni devono essere' : 'La forcella deve essere'}{' '}
          completamente {hasRear ? 'estese' : 'estesa'}. Mantieni la bici ferma.
        </p>
      </div>

      {phase === 'running' && (
        <div className="stack stack--2">
          <Progress indeterminate label="Calibrazione in corso" />
          <span className="text-sm muted">Lettura dei sensori in corso…</span>
        </div>
      )}

      {phase === 'done' && result?.ok && (
        <div className="stack stack--2">
          <strong style={{ color: 'var(--c-ok)' }}>✓ Calibrazione completata</strong>
          <ul className="stack stack--1 text-sm muted" style={{ margin: 0, paddingLeft: '1.1rem' }}>
            {result.channels.map((channel) => (
              <li key={channel.component}>
                {channel.component === 'front' ? 'Forcella' : 'Posteriore'}: zero a{' '}
                <span className="ds-mono">{channel.zeroRaw}</span>, rumore{' '}
                <span className="ds-mono">{channel.noiseStdDev.toFixed(1)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {phase === 'failed' && (
        <p role="alert" style={{ color: 'var(--c-danger)' }}>
          {result?.failure === 'sensor-disconnected'
            ? 'Sensore non rilevato. Controlla il collegamento e riprova.'
            : 'Movimento rilevato. Tieni ferma la bici e riprova.'}
        </p>
      )}

      <Button
        variant="primary"
        size="lg"
        block
        loading={phase === 'running'}
        disabled={connection !== 'connected'}
        onClick={() => void run()}
      >
        {phase === 'done' ? 'Calibra di nuovo' : 'Calibra'}
      </Button>

      {connection !== 'connected' && (
        <p className="text-sm muted">Collega il dispositivo per poter calibrare.</p>
      )}
    </Card>
  );
}
