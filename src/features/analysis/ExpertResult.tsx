import { useState } from 'react';
import type { AnalysisReport, ComponentMetrics, Session } from '@/types';
import {
  Badge,
  BandMeter,
  Card,
  SpeedBandBar,
  TravelHistogramChart,
  TravelTimeChart,
  VelocityChart,
  VelocityHistogramChart,
} from '@/design-system';
import { DEFAULT_TUNABLES } from '@/analysis';
import type { GlossaryId } from '@/features/help/glossary';
import { TermInfo } from '@/features/help/TermInfo';
import { DIAGNOSIS_LABEL, SEVERITY_LABEL, SEVERITY_TONE } from './presentation';

type Tab = 'grafici' | 'metriche' | 'diagnosi' | 'dati';

/** Expert mode: charts, full metrics, every diagnosis, and the raw samples. */
export function ExpertResult({ session, report }: { session: Session; report: AnalysisReport }) {
  const [tab, setTab] = useState<Tab>('grafici');
  const { front, rear } = report.metrics;
  const style = DEFAULT_TUNABLES.styles[report.ridingStyle];
  const rearTravel = session.setupSnapshot.rearSuspension.present
    ? session.setupSnapshot.rearSuspension.totalTravelMm
    : null;

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'grafici', label: 'Grafici' },
    { id: 'metriche', label: 'Metriche' },
    { id: 'diagnosi', label: 'Diagnosi' },
    { id: 'dati', label: 'Dati' },
  ];

  return (
    <div className="stack stack--4">
      <div className="tabs" role="tablist" aria-label="Sezioni analisi esperto">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            className="tabs__tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'grafici' && (
        <div className="stack stack--4">
          <Card>
            <h3 className="card__title info-label">
              <span>Posizione nel tempo</span>
              <TermInfo id="travel" />
            </h3>
            <p className="text-sm muted" style={{ marginBottom: 'var(--s-3)' }}>
              Percentuale di corsa usata. La linea rossa è la soglia di fondo corsa.
            </p>
            <TravelTimeChart
              samples={session.samples}
              frontTravelMm={session.setupSnapshot.frontSuspension.totalTravelMm}
              rearTravelMm={rearTravel}
            />
          </Card>

          <Card>
            <h3 className="card__title info-label">
              <span>Distribuzione del travel</span>
              <TermInfo id="travel-distribution" />
            </h3>
            <p className="text-sm muted" style={{ marginBottom: 'var(--s-3)' }}>
              Quanto tempo la sospensione passa in ogni zona della corsa.
            </p>
            <TravelHistogramChart front={front} rear={rear} />
          </Card>

          <Card>
            <h3 className="card__title info-label">
              <span>Distribuzione delle velocità</span>
              <TermInfo id="velocity-distribution" />
            </h3>
            <p className="text-sm muted" style={{ marginBottom: 'var(--s-3)' }}>
              Quanto tempo lo stelo passa a ogni velocità. A sinistra dello zero il ritorno, a
              destra la compressione. Le barre in tinta scura sono le alte velocità, quelle dei
              colpi secchi, governate da regolazioni diverse.
            </p>
            <VelocityHistogramChart
              front={front}
              rear={rear}
              splitMmS={DEFAULT_TUNABLES.velocitySplitMmS}
            />
          </Card>

          <Card className="stack stack--4">
            <div>
              <h3 className="card__title info-label">
                <span>Ripartizione del movimento</span>
                <TermInfo id="speed-split" />
              </h3>
              <p className="text-sm muted">
                Basse e alte velocità sono governate da regolazioni diverse, per questo l’analisi le
                valuta separatamente.
              </p>
            </div>
            <div className="stack stack--2">
              <span className="ds-label">Forcella</span>
              <SpeedBandBar metrics={front} />
            </div>
            {rear && (
              <div className="stack stack--2">
                <span className="ds-label">Posteriore</span>
                <SpeedBandBar metrics={rear} />
              </div>
            )}
          </Card>

          <Card>
            <h3 className="card__title info-label">
              <span>Velocità medie e di picco</span>
              <TermInfo id="shaft-velocity" />
            </h3>
            <p className="text-sm muted" style={{ marginBottom: 'var(--s-3)' }}>
              Velocità di compressione e di ritorno dello stelo.
            </p>
            <VelocityChart front={front} rear={rear} />
          </Card>
        </div>
      )}

      {tab === 'metriche' && (
        <div className="stack stack--4">
          <Card className="stack stack--4">
            <h3 className="card__title" style={{ margin: 0 }}>
              Forcella
            </h3>
            <BandMeter
              label="Corsa massima usata"
              value={front.maxTravelPct}
              band={style.front.maxTravelPct}
              info={<TermInfo id="travel-max" />}
            />
            <BandMeter
              label="Corsa media usata"
              value={front.meanTravelPct}
              band={style.front.meanTravelPct}
              info={<TermInfo id="travel-mean" />}
            />
            <BandMeter
              label="Altezza di marcia"
              value={front.rideHeightPct}
              band={style.rideHeightPct}
              info={<TermInfo id="ride-height" />}
            />
            <BandMeter
              label="Tempo di ritorno"
              value={front.velocity.meanRecoveryTimeSec}
              band={style.recoveryTimeSec}
              unit=" s"
              info={<TermInfo id="recovery-time" />}
            />
            <MetricGrid metrics={front} />
          </Card>

          {rear && (
            <Card className="stack stack--4">
              <h3 className="card__title" style={{ margin: 0 }}>
                Posteriore
              </h3>
              <BandMeter
                label="Corsa massima usata"
                value={rear.maxTravelPct}
                band={style.rear.maxTravelPct}
                info={<TermInfo id="travel-max" />}
              />
              <BandMeter
                label="Corsa media usata"
                value={rear.meanTravelPct}
                band={style.rear.meanTravelPct}
                info={<TermInfo id="travel-mean" />}
              />
              <BandMeter
                label="Altezza di marcia"
                value={rear.rideHeightPct}
                band={style.rideHeightPct}
                info={<TermInfo id="ride-height" />}
              />
              <BandMeter
                label="Tempo di ritorno"
                value={rear.velocity.meanRecoveryTimeSec}
                band={style.recoveryTimeSec}
                unit=" s"
                info={<TermInfo id="recovery-time" />}
              />
              <MetricGrid metrics={rear} />
            </Card>
          )}

          {report.metrics.balance && (
            <Card className="stack stack--3">
              <h3 className="card__title" style={{ margin: 0 }}>
                Confronto anteriore / posteriore
              </h3>
              <div className="metric-grid">
                <Metric
                  label="Differenza corsa"
                  value={`${report.metrics.balance.travelUseDeltaPct > 0 ? '+' : ''}${report.metrics.balance.travelUseDeltaPct.toFixed(1)} pt`}
                />
                <Metric label="Rapporto F/R" value={report.metrics.balance.travelUseRatio.toFixed(2)} />
                <Metric
                  label="Differenza ritorno"
                  value={`${report.metrics.balance.reboundDeltaSec > 0 ? '+' : ''}${report.metrics.balance.reboundDeltaSec.toFixed(3)} s`}
                />
                <Metric label="Differenza fondo corsa" value={String(report.metrics.balance.bottomOutDelta)} />
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === 'diagnosi' && (
        <Card className="stack stack--4">
          {report.diagnoses.length === 0 ? (
            <p className="muted">Nessuna anomalia rilevata su questa run.</p>
          ) : (
            report.diagnoses.map((d, i) => (
              <div key={`${d.id}-${d.component}-${i}`} className="stack stack--2">
                <div className="row row--between">
                  <strong className="text-sm">{DIAGNOSIS_LABEL[d.id] ?? d.id}</strong>
                  <span className="info-label">
                    <Badge tone={SEVERITY_TONE[d.severity]}>{SEVERITY_LABEL[d.severity]}</Badge>
                    <TermInfo id="severity" />
                  </span>
                </div>
                <p className="text-sm">{d.description}</p>
                <div className="text-xs faint ds-mono">
                  {d.component} · {d.metric} = {d.metricValue} (soglia {d.threshold}) · confidenza{' '}
                  {(d.confidence * 100).toFixed(0)}%
                </div>
                <hr className="divider" />
              </div>
            ))
          )}
        </Card>
      )}

      {tab === 'dati' && (
        <Card className="stack stack--3">
          <h3 className="card__title" style={{ margin: 0 }}>
            Dati grezzi
          </h3>
          <div className="metric-grid">
            <Metric label="Campioni" value={String(report.metrics.sampleCount)} />
            <Metric label="Frequenza" value={`${session.sampleRateHz} Hz`} />
            <Metric label="Durata" value={`${report.metrics.durationSec.toFixed(1)} s`} />
            <Metric label="Motore" value={report.engineVersion} />
          </div>
          <p className="text-sm muted">Primi 20 campioni (millimetri di corsa usata):</p>
          <div style={{ overflowX: 'auto' }}>
            <table className="text-xs ds-mono" style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr style={{ color: 'var(--c-text-faint)', textAlign: 'left' }}>
                  <th style={{ padding: '4px 12px 4px 0' }}>t (ms)</th>
                  <th style={{ padding: '4px 12px 4px 0' }}>forcella</th>
                  {rearTravel && <th style={{ padding: '4px 0' }}>posteriore</th>}
                </tr>
              </thead>
              <tbody>
                {session.samples.slice(0, 20).map((s) => (
                  <tr key={s.t}>
                    <td style={{ padding: '2px 12px 2px 0' }}>{s.t}</td>
                    <td style={{ padding: '2px 12px 2px 0' }}>{s.frontMm.toFixed(2)}</td>
                    {rearTravel && <td style={{ padding: '2px 0' }}>{s.rearMm?.toFixed(2) ?? '—'}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function MetricGrid({ metrics }: { metrics: ComponentMetrics }) {
  return (
    <div className="metric-grid">
      <Metric label="Corsa max" value={`${metrics.maxTravelMm.toFixed(1)} mm`} info="travel-max" />
      <Metric label="Corsa max %" value={`${metrics.maxTravelPct.toFixed(1)}%`} info="travel-max" />
      <Metric label="Corsa media" value={`${metrics.meanTravelPct.toFixed(1)}%`} info="travel-mean" />
      <Metric label="Altezza di marcia" value={`${metrics.rideHeightPct.toFixed(1)}%`} info="ride-height" />
      <Metric label="P95 corsa" value={`${metrics.p95TravelPct.toFixed(1)}%`} info="percentile" />
      <Metric label="Fondo corsa" value={String(metrics.bottomOutCount)} info="bottom-out" />
      <Metric label="Tempo a fondo" value={`${(metrics.timeNearBottom * 100).toFixed(1)}%`} info="time-near-bottom" />
      <Metric label="Tempo in alto" value={`${(metrics.timeNearTop * 100).toFixed(1)}%`} info="time-near-top" />
      <Metric label="Top-out" value={String(metrics.topOutCount)} info="top-out" />
      <Metric label="Compressioni" value={String(metrics.compressionEvents)} info="compression-events" />
      <Metric label="Compr. media" value={`${metrics.velocity.meanCompression.toFixed(0)} mm/s`} info="shaft-velocity" />
      <Metric label="Ritorno medio" value={`${metrics.velocity.meanRebound.toFixed(0)} mm/s`} info="rebound" />
      <Metric label="Ritorno p95" value={`${metrics.velocity.p95Rebound.toFixed(0)} mm/s`} />
      <Metric
        label="Compr. alta vel."
        value={`${(metrics.velocity.highSpeedCompression.fraction * 100).toFixed(0)}%`}
        info="high-speed"
      />
      <Metric
        label="Ritorno bassa vel."
        value={`${(metrics.velocity.lowSpeedRebound.fraction * 100).toFixed(0)}%`}
        info="low-speed"
      />
    </div>
  );
}

function Metric({
  label,
  value,
  info,
}: {
  label: string;
  value: string;
  info?: GlossaryId;
}) {
  return (
    <div className="metric">
      <div className="metric__value">{value}</div>
      <div className="metric__label info-label">
        <span>{label}</span>
        {info && <TermInfo id={info} />}
      </div>
    </div>
  );
}
