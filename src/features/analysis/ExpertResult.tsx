import { useState } from 'react';
import type { AnalysisReport, ComponentMetrics, Session } from '@/types';
import { Badge, BandMeter, Card, TravelHistogramChart, TravelTimeChart, VelocityChart } from '@/design-system';
import { DEFAULT_TUNABLES } from '@/analysis';
import { SEVERITY_LABEL, SEVERITY_TONE } from './presentation';

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
            <h3 className="card__title">Posizione nel tempo</h3>
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
            <h3 className="card__title">Distribuzione del travel</h3>
            <p className="text-sm muted" style={{ marginBottom: 'var(--s-3)' }}>
              Quanto tempo la sospensione passa in ogni zona della corsa.
            </p>
            <TravelHistogramChart front={front} rear={rear} />
          </Card>

          <Card>
            <h3 className="card__title">Velocità</h3>
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
            <BandMeter label="Corsa massima usata" value={front.maxTravelPct} band={style.front.maxTravelPct} />
            <BandMeter label="Corsa media usata" value={front.meanTravelPct} band={style.front.meanTravelPct} />
            <BandMeter
              label="Tempo di ritorno"
              value={front.velocity.meanRecoveryTimeSec}
              band={style.recoveryTimeSec}
              unit=" s"
            />
            <MetricGrid metrics={front} />
          </Card>

          {rear && (
            <Card className="stack stack--4">
              <h3 className="card__title" style={{ margin: 0 }}>
                Posteriore
              </h3>
              <BandMeter label="Corsa massima usata" value={rear.maxTravelPct} band={style.rear.maxTravelPct} />
              <BandMeter label="Corsa media usata" value={rear.meanTravelPct} band={style.rear.meanTravelPct} />
              <BandMeter
                label="Tempo di ritorno"
                value={rear.velocity.meanRecoveryTimeSec}
                band={style.recoveryTimeSec}
                unit=" s"
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
                  <strong className="text-sm">{d.id}</strong>
                  <Badge tone={SEVERITY_TONE[d.severity]}>{SEVERITY_LABEL[d.severity]}</Badge>
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
      <Metric label="Corsa max" value={`${metrics.maxTravelMm.toFixed(1)} mm`} />
      <Metric label="Corsa max %" value={`${metrics.maxTravelPct.toFixed(1)}%`} />
      <Metric label="Corsa media" value={`${metrics.meanTravelPct.toFixed(1)}%`} />
      <Metric label="P95 corsa" value={`${metrics.p95TravelPct.toFixed(1)}%`} />
      <Metric label="Fondo corsa" value={String(metrics.bottomOutCount)} />
      <Metric label="Tempo a fondo" value={`${(metrics.timeNearBottom * 100).toFixed(1)}%`} />
      <Metric label="Tempo in alto" value={`${(metrics.timeNearTop * 100).toFixed(1)}%`} />
      <Metric label="Top-out" value={String(metrics.topOutCount)} />
      <Metric label="Compressioni" value={String(metrics.compressionEvents)} />
      <Metric label="Compr. media" value={`${metrics.velocity.meanCompression.toFixed(0)} mm/s`} />
      <Metric label="Ritorno medio" value={`${metrics.velocity.meanRebound.toFixed(0)} mm/s`} />
      <Metric label="Ritorno p95" value={`${metrics.velocity.p95Rebound.toFixed(0)} mm/s`} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <div className="metric__value">{value}</div>
      <div className="metric__label">{label}</div>
    </div>
  );
}
