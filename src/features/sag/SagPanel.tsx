import { useEffect, useState } from 'react';
import type { SagChannelResult } from '@/types';
import { sagAdvice } from '@/analysis';
import { errorMessage } from '@/transport';
import { Badge, BandMeter, Button, Card, Progress, useToast } from '@/design-system';
import { useBikeStore, useDeviceStore, useSagStore } from '@/app/store';
import { TermInfo } from '@/features/help/TermInfo';
import { VERDICT_LABEL, VERDICT_TONE } from '@/features/analysis/presentation';

/**
 * Static sag: the guided measurement every setup starts from.
 *
 * One question, as everywhere else: is the bike sitting at the right height
 * under my weight? The rider gets on the bike, holds still, and reads a verdict
 * plus the adjustment to make.
 */
export function SagPanel() {
  const bike = useBikeStore((s) => s.activeBike());
  const { connection, transport } = useDeviceStore();
  const { measurement, measuring, unstableMm, load, measure } = useSagStore();
  const [justMeasured, setJustMeasured] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (bike) void load(bike.id);
  }, [bike, load]);

  if (!bike) return null;

  const supported = typeof transport?.readPosition === 'function';
  const ready = connection === 'connected' && supported;
  const advice = measurement ? sagAdvice(measurement, bike) : [];
  const hasRear = bike.rearSuspension.present;

  const run = async () => {
    try {
      await measure();
      setJustMeasured(true);
      toast.push({ tone: 'ok', title: 'Sag misurato' });
    } catch (error) {
      const spread = useSagStore.getState().unstableMm;
      if (spread !== null) return; // The panel shows this inline.
      const code =
        error && typeof error === 'object' && 'code' in error
          ? (error as { code: 'not-supported' }).code
          : 'connection-lost';
      const message = errorMessage(code);
      toast.push({ tone: 'danger', title: message.title, body: message.body });
    }
  };

  return (
    <Card className="stack stack--5">
      <div className="stack stack--2">
        <span className="info-label">
          <span className="ds-label">Sag statico</span>
          <TermInfo id="sag" />
        </span>
        <p className="text-sm muted">
          Il sag è quanto la sospensione affonda sotto il tuo peso a bici ferma. È la regolazione
          da cui parte ogni assetto, e si misura prima di andare a registrare una run.
        </p>
      </div>

      {!measurement && !measuring && (
        <ol className="stack stack--2 text-sm" style={{ margin: 0, paddingLeft: '1.2rem' }}>
          <li>Mettiti in sella con l’attrezzatura che usi normalmente.</li>
          <li>Assumi la tua posizione di guida, appoggiando il peso come in piano.</li>
          <li>Resta immobile e premi Misura.</li>
        </ol>
      )}

      {measuring && (
        <div className="stack stack--2">
          <Progress indeterminate label="Misura del sag in corso" />
          <span className="text-sm muted">Resta fermo, sto leggendo la posizione…</span>
        </div>
      )}

      {unstableMm !== null && (
        <p role="alert" style={{ color: 'var(--c-danger)' }} className="text-sm">
          Movimento rilevato ({unstableMm.toFixed(1)} mm di oscillazione). Resta immobile in sella e
          riprova.
        </p>
      )}

      {measurement && !measuring && (
        <div className="stack stack--4">
          <div className="stack stack--3">
            {measurement.channels.map((channel) => (
              <SagRow key={channel.component} channel={channel} />
            ))}
          </div>

          {advice.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--c-ok)' }}>
              ✓ Il sag è corretto {hasRear ? 'su entrambe le sospensioni' : 'sulla forcella'}.
              Nessuna modifica necessaria.
            </p>
          ) : (
            <div className="stack stack--3">
              <span className="ds-label">Azione consigliata</span>
              {advice.map((item) => (
                <div key={item.component} className="stack stack--1">
                  <strong>{item.title}</strong>
                  <span className="text-sm muted">{item.rationale}</span>
                </div>
              ))}
            </div>
          )}

          {justMeasured && advice.length > 0 && (
            <p className="text-xs faint">
              Dopo la modifica, misura di nuovo il sag per verificarla.
            </p>
          )}
        </div>
      )}

      <Button
        variant="primary"
        size="lg"
        block
        loading={measuring}
        disabled={!ready}
        onClick={() => void run()}
      >
        {measurement ? 'Misura di nuovo' : 'Misura il sag'}
      </Button>

      {connection !== 'connected' && (
        <p className="text-sm muted">Collega il dispositivo per misurare il sag.</p>
      )}
      {connection === 'connected' && !supported && (
        <p className="text-sm" style={{ color: 'var(--c-warn)' }}>
          Questo canale di collegamento non permette di leggere la posizione. Usa il Wi-Fi oppure il
          dispositivo simulato.
        </p>
      )}
    </Card>
  );
}

function SagRow({ channel }: { channel: SagChannelResult }) {
  return (
    <div className="stack stack--2">
      <div className="row row--between">
        <span className="info-label">
          <strong>{channel.component === 'front' ? 'Forcella' : 'Posteriore'}</strong>
          <TermInfo id="sag" />
        </span>
        <Badge tone={VERDICT_TONE[channel.verdict]}>{VERDICT_LABEL[channel.verdict]}</Badge>
      </div>

      <div className="row" style={{ gap: 'var(--s-4)' }}>
        <span className="ds-mono" style={{ fontSize: '1.35rem', fontWeight: 700 }}>
          {channel.sagPct}%
        </span>
        <span className="ds-mono muted text-sm">{channel.sagMm} mm</span>
      </div>

      <BandMeter
        label={`Intervallo consigliato ${channel.targetPct[0]}–${channel.targetPct[1]}%`}
        value={channel.sagPct}
        band={channel.targetPct}
        // Twice the top of the band keeps a 5-point window clearly readable.
        scaleMax={Math.max(channel.targetPct[1] * 2, channel.sagPct * 1.15)}
      />
    </div>
  );
}

/** Sag readiness for the Run screen, without the whole panel. */
export function useSagStatus() {
  const bike = useBikeStore((s) => s.activeBike());
  const measurement = useSagStore((s) => s.measurement);
  if (!bike || !measurement || measurement.bikeId !== bike.id) return null;
  const outOfBand = measurement.channels.filter((c) => c.verdict !== 'correct');
  return { measurement, ok: outOfBand.length === 0, outOfBand };
}
