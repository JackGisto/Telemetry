import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ComponentMetrics, RawSample } from '@/types';

/**
 * Charts for Expert mode. Deliberately few and plain: axis, grid, one or two
 * series. The palette comes from the tokens, so front is always teal and rear
 * always violet across every screen.
 */

const FRONT = '#4cd9c0';
const REAR = '#a78bfa';
const GRID = '#232c37';
const AXIS = '#6f7d8f';

const axisProps = { stroke: AXIS, fontSize: 11, tickLine: false } as const;

const tooltipStyle = {
  contentStyle: {
    background: '#1c232c',
    border: '1px solid #3d4a5c',
    borderRadius: 12,
    fontSize: 12,
  },
  labelStyle: { color: '#a3b0c0' },
} as const;

/** Travel against time. Downsampled so a 15 000-point run still scrolls. */
export function TravelTimeChart({
  samples,
  frontTravelMm,
  rearTravelMm,
  maxPoints = 900,
}: {
  samples: RawSample[];
  frontTravelMm: number;
  rearTravelMm: number | null;
  maxPoints?: number;
}) {
  const step = Math.max(1, Math.ceil(samples.length / maxPoints));
  const data = samples
    .filter((_, i) => i % step === 0)
    .map((s) => ({
      t: Math.round(s.t / 100) / 10,
      front: Math.round((s.frontMm / frontTravelMm) * 1000) / 10,
      rear:
        s.rearMm !== null && rearTravelMm
          ? Math.round((s.rearMm / rearTravelMm) * 1000) / 10
          : null,
    }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -18 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="t" {...axisProps} unit="s" />
        <YAxis domain={[0, 100]} {...axisProps} unit="%" />
        <Tooltip {...tooltipStyle} formatter={(v: number) => `${v}%`} labelFormatter={(l) => `${l} s`} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {/* Bottom-out line, so the reader sees at a glance which hits reached it. */}
        <ReferenceLine y={95} stroke="#f87171" strokeDasharray="4 4" />
        <Line
          type="monotone"
          dataKey="front"
          name="Forcella"
          stroke={FRONT}
          dot={false}
          strokeWidth={1.6}
          isAnimationActive={false}
        />
        {rearTravelMm && (
          <Line
            type="monotone"
            dataKey="rear"
            name="Posteriore"
            stroke={REAR}
            dot={false}
            strokeWidth={1.6}
            isAnimationActive={false}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** How the run distributes across the stroke: the single most telling chart. */
export function TravelHistogramChart({
  front,
  rear,
}: {
  front: ComponentMetrics;
  rear: ComponentMetrics | null;
}) {
  const data = front.histogram.map((bin, i) => ({
    zone: `${bin.fromPct.toFixed(0)}–${bin.toPct.toFixed(0)}`,
    front: Math.round(bin.fraction * 1000) / 10,
    rear: rear ? Math.round(rear.histogram[i].fraction * 1000) / 10 : null,
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -18 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="zone" {...axisProps} interval={0} angle={-35} textAnchor="end" height={52} />
        <YAxis {...axisProps} unit="%" />
        <Tooltip {...tooltipStyle} formatter={(v: number) => `${v}% del tempo`} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="front" name="Forcella" fill={FRONT} radius={[3, 3, 0, 0]} isAnimationActive={false} />
        {rear && <Bar dataKey="rear" name="Posteriore" fill={REAR} radius={[3, 3, 0, 0]} isAnimationActive={false} />}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Compression and rebound speeds side by side. */
export function VelocityChart({
  front,
  rear,
}: {
  front: ComponentMetrics;
  rear: ComponentMetrics | null;
}) {
  const data = [
    { metric: 'Compr. media', front: r(front.velocity.meanCompression), rear: rear ? r(rear.velocity.meanCompression) : null },
    { metric: 'Compr. p95', front: r(front.velocity.p95Compression), rear: rear ? r(rear.velocity.p95Compression) : null },
    { metric: 'Rit. medio', front: r(front.velocity.meanRebound), rear: rear ? r(rear.velocity.meanRebound) : null },
    { metric: 'Rit. p95', front: r(front.velocity.p95Rebound), rear: rear ? r(rear.velocity.p95Rebound) : null },
  ];

  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" {...axisProps} unit=" mm/s" />
        <YAxis type="category" dataKey="metric" {...axisProps} width={90} />
        <Tooltip {...tooltipStyle} formatter={(v: number) => `${v} mm/s`} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="front" name="Forcella" fill={FRONT} radius={[0, 3, 3, 0]} isAnimationActive={false} />
        {rear && <Bar dataKey="rear" name="Posteriore" fill={REAR} radius={[0, 3, 3, 0]} isAnimationActive={false} />}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** A single horizontal bar showing where a value sits inside its target band. */
export function BandMeter({
  label,
  value,
  band,
  unit = '%',
}: {
  label: string;
  value: number;
  band: [number, number];
  unit?: string;
}) {
  const scaleMax = Math.max(100, band[1] * 1.1, value * 1.1);
  const pct = (v: number) => `${Math.min(100, (v / scaleMax) * 100)}%`;
  const inside = value >= band[0] && value <= band[1];

  return (
    <div className="stack stack--2">
      <div className="row row--between text-sm">
        <span className="muted">{label}</span>
        <span className="ds-mono" style={{ color: inside ? 'var(--c-ok)' : 'var(--c-warn)' }}>
          {value.toFixed(1)}
          {unit} {inside ? '✓' : '!'}
        </span>
      </div>
      <div
        style={{ position: 'relative', height: 12, background: 'var(--c-surface-3)', borderRadius: 999 }}
        role="img"
        aria-label={`${label}: ${value.toFixed(1)}${unit}, intervallo consigliato ${band[0]}–${band[1]}${unit}`}
      >
        <div
          style={{
            position: 'absolute',
            left: pct(band[0]),
            width: `calc(${pct(band[1])} - ${pct(band[0])})`,
            top: 0,
            bottom: 0,
            background: 'var(--c-accent-dim)',
            border: '1px solid var(--c-accent)',
            borderRadius: 999,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: pct(value),
            top: -3,
            width: 3,
            height: 18,
            background: inside ? 'var(--c-ok)' : 'var(--c-warn)',
            borderRadius: 2,
          }}
        />
      </div>
    </div>
  );
}

/** Small sparkline of travel, used on history cards. */
export function Sparkline({ samples, travelMm }: { samples: RawSample[]; travelMm: number }) {
  const step = Math.max(1, Math.ceil(samples.length / 120));
  const data = samples
    .filter((_, i) => i % step === 0)
    .map((s, i) => ({ i, v: (s.frontMm / travelMm) * 100 }));

  return (
    <ResponsiveContainer width="100%" height={42}>
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <Area
          type="monotone"
          dataKey="v"
          stroke={FRONT}
          fill={FRONT}
          fillOpacity={0.16}
          strokeWidth={1.2}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Grouped comparison bars used by the run-comparison screen. */
export function ComparisonBars({
  rows,
}: {
  rows: Array<{ label: string; a: number; b: number; better: 'lower' | 'higher' | 'neutral' }>;
}) {
  const data = rows.map((row) => ({ ...row, delta: row.b - row.a }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, rows.length * 46)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" {...axisProps} />
        <YAxis type="category" dataKey="label" {...axisProps} width={130} />
        <Tooltip {...tooltipStyle} formatter={(v: number) => v.toFixed(2)} />
        <ReferenceLine x={0} stroke={AXIS} />
        <Bar dataKey="delta" name="Variazione" radius={[0, 3, 3, 0]} isAnimationActive={false}>
          {data.map((row, i) => (
            <Cell
              key={i}
              fill={
                row.better === 'neutral' || row.delta === 0
                  ? AXIS
                  : (row.delta < 0) === (row.better === 'lower')
                    ? '#4ade80'
                    : '#f87171'
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function r(value: number): number {
  return Math.round(value * 10) / 10;
}
