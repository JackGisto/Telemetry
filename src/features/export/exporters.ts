import type { AnalysisReport, Session } from '@/types';

/**
 * Run export. Both formats are self-contained: bike setup, samples, metrics,
 * diagnoses and recommendations travel together, so an exported run can be
 * re-imported or analysed elsewhere without the app's database.
 */

export const EXPORT_FORMAT_VERSION = 1;

export interface RunExport {
  formatVersion: number;
  exportedAt: string;
  session: Session;
  report: AnalysisReport | null;
}

export function toJson(session: Session, report: AnalysisReport | null): string {
  const payload: RunExport = {
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    session,
    report,
  };
  return JSON.stringify(payload, null, 2);
}

export function parseJson(text: string): RunExport {
  const parsed = JSON.parse(text) as Partial<RunExport>;
  if (!parsed.session || !Array.isArray(parsed.session.samples)) {
    throw new Error('File non valido: nessuna sessione trovata.');
  }
  if (parsed.formatVersion !== EXPORT_FORMAT_VERSION) {
    throw new Error(`Versione del formato non supportata: ${String(parsed.formatVersion)}`);
  }
  return parsed as RunExport;
}

function escapeCsv(value: string | number | null): string {
  if (value === null) return '';
  const s = String(value);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvRows(rows: Array<Array<string | number | null>>): string {
  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
}

/** Sample-level CSV: one row per sample, for spreadsheets and external tools. */
export function samplesToCsv(session: Session): string {
  const header = ['time_ms', 'front_mm', 'front_pct', 'rear_mm', 'rear_pct'];
  const frontTravel = session.setupSnapshot.frontSuspension.totalTravelMm;
  const rearTravel = session.setupSnapshot.rearSuspension.present
    ? session.setupSnapshot.rearSuspension.totalTravelMm
    : null;

  const rows = session.samples.map((s) => [
    s.t,
    round(s.frontMm),
    round((s.frontMm / frontTravel) * 100),
    s.rearMm === null ? null : round(s.rearMm),
    s.rearMm === null || rearTravel === null ? null : round((s.rearMm / rearTravel) * 100),
  ]);

  return csvRows([header, ...rows]);
}

/** Summary CSV: setup, metrics, diagnoses and recommendations as key/value rows. */
export function summaryToCsv(session: Session, report: AnalysisReport | null): string {
  const bike = session.setupSnapshot;
  const rows: Array<Array<string | number | null>> = [
    ['section', 'key', 'value'],
    ['run', 'id', session.id],
    ['run', 'started_at', session.startedAt],
    ['run', 'duration_sec', round(session.durationSec)],
    ['run', 'trail', session.trail ?? ''],
    ['run', 'notes', session.notes ?? ''],
    ['setup', 'riding_style', bike.rider.style],
    ['setup', 'front_travel_mm', bike.frontSuspension.totalTravelMm],
    ['setup', 'front_spring', bike.frontSuspension.springType],
    ['setup', 'front_pressure_psi', bike.frontSuspension.pressurePsi ?? ''],
    ['setup', 'front_rebound_clicks', bike.frontSuspension.rebound.clicks ?? ''],
    ['setup', 'front_compression_clicks', bike.frontSuspension.compression.clicks ?? ''],
    ['setup', 'rear_present', bike.rearSuspension.present ? 'yes' : 'no'],
  ];

  if (bike.rearSuspension.present) {
    rows.push(
      ['setup', 'rear_travel_mm', bike.rearSuspension.totalTravelMm],
      ['setup', 'rear_spring', bike.rearSuspension.springType],
      ['setup', 'rear_pressure_psi', bike.rearSuspension.pressurePsi ?? ''],
      ['setup', 'rear_rebound_clicks', bike.rearSuspension.rebound.clicks ?? ''],
      ['setup', 'rear_compression_clicks', bike.rearSuspension.compression.clicks ?? ''],
    );
  }

  if (report) {
    const m = report.metrics;
    const component = (prefix: string, c: typeof m.front) => {
      rows.push(
        ['metrics', `${prefix}_max_travel_pct`, round(c.maxTravelPct)],
        ['metrics', `${prefix}_mean_travel_pct`, round(c.meanTravelPct)],
        ['metrics', `${prefix}_ride_height_pct`, round(c.rideHeightPct)],
        ['metrics', `${prefix}_bottom_outs`, c.bottomOutCount],
        ['metrics', `${prefix}_time_near_bottom`, round(c.timeNearBottom, 4)],
        ['metrics', `${prefix}_mean_compression_mm_s`, round(c.velocity.meanCompression)],
        ['metrics', `${prefix}_mean_rebound_mm_s`, round(c.velocity.meanRebound)],
        ['metrics', `${prefix}_recovery_time_sec`, round(c.velocity.meanRecoveryTimeSec, 3)],
        ['metrics', `${prefix}_low_speed_compression_share`, round(c.velocity.lowSpeedCompression.fraction, 3)],
        ['metrics', `${prefix}_high_speed_compression_share`, round(c.velocity.highSpeedCompression.fraction, 3)],
        ['metrics', `${prefix}_low_speed_rebound_share`, round(c.velocity.lowSpeedRebound.fraction, 3)],
        ['metrics', `${prefix}_high_speed_rebound_share`, round(c.velocity.highSpeedRebound.fraction, 3)],
      );
    };
    component('front', m.front);
    if (m.rear) component('rear', m.rear);
    if (m.balance) {
      rows.push(
        ['metrics', 'balance_travel_delta_pct', round(m.balance.travelUseDeltaPct)],
        ['metrics', 'balance_rebound_delta_sec', round(m.balance.reboundDeltaSec, 3)],
        ['metrics', 'balance_ride_height_delta_pct', round(m.balance.rideHeightDeltaPct)],
      );
    }

    rows.push(
      ['score', 'front', report.scores.front],
      ['score', 'rear', report.scores.rear],
      ['score', 'balance', report.scores.balance],
      ['score', 'overall', report.scores.overall],
    );

    for (const d of report.diagnoses) {
      rows.push(['diagnosis', `${d.component}:${d.id}`, `${d.severity} (${d.confidence})`]);
    }
    for (const [i, r] of report.recommendations.entries()) {
      rows.push(['recommendation', String(i + 1), r.title]);
    }
  }

  return csvRows(rows);
}

function round(value: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}
