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
/** Muted variants marking the high-speed end of the velocity distribution. */
const FRONT_HS = '#15564f';
const REAR_HS = '#3f3272';
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
        <XAxis
          dataKey="t"
          {...axisProps}
          unit="s"
          interval="preserveStartEnd"
          minTickGap={40}
          tickFormatter={(v: number) => String(Math.round(v))}
        />
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

/**
 * Shaft-velocity distribution: rebound to the left of zero, compression to the
 * right, with the low/high speed split marked.
 *
 * The shape is what matters here, not any single bar, so the bars are drawn
 * plain and the two reference lines carry the reading: everything outside them
 * is high-speed motion.
 */
export function VelocityHistogramChart({
  front,
  rear,
  splitMmS,
}: {
  front: ComponentMetrics;
  rear: ComponentMetrics | null;
  splitMmS: number;
}) {
  // Trim the empty tails so the occupied range fills the width.
  const occupied = front.velocity.histogram
    .map((bin, i) => ({ bin, i, rearBin: rear?.velocity.histogram[i] }))
    .filter(({ bin, rearBin }) => bin.fraction > 0.0005 || (rearBin?.fraction ?? 0) > 0.0005);

  if (occupied.length === 0) return null;

  const data = occupied.map(({ bin, rearBin }) => {
    const centre = Math.round((bin.fromMmS + bin.toMmS) / 2);
    return {
      centre,
      highSpeed: Math.abs(centre) >= splitMmS,
      front: Math.round(bin.fraction * 1000) / 10,
      rear: rearBin ? Math.round(rearBin.fraction * 1000) / 10 : null,
    };
  });

  // The speed split is drawn into the bars themselves rather than as reference
  // lines: the x axis is categorical, so a line at +/-200 would land on no
  // category and silently never render.
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 18, left: -18 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="centre"
          {...axisProps}
          unit=" mm/s"
          interval="preserveStartEnd"
          minTickGap={26}
        />
        <YAxis {...axisProps} unit="%" />
        <Tooltip
          {...tooltipStyle}
          formatter={(v: number) => `${v}% dei campioni`}
          labelFormatter={(l: number) =>
            `${Number(l) > 0 ? 'Compressione' : 'Ritorno'} ${Math.abs(Number(l))} mm/s${
              Math.abs(Number(l)) >= splitMmS ? ' · alta velocità' : ''
            }`
          }
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="front" name="Forcella" fill={FRONT} isAnimationActive={false}>
          {data.map((row) => (
            <Cell key={`f${row.centre}`} fill={row.highSpeed ? FRONT_HS : FRONT} />
          ))}
        </Bar>
        {rear && (
          <Bar dataKey="rear" name="Posteriore" fill={REAR} isAnimationActive={false}>
            {data.map((row) => (
              <Cell key={`r${row.centre}`} fill={row.highSpeed ? REAR_HS : REAR} />
            ))}
          </Bar>
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Share of shaft motion in each speed band, as a single stacked bar. */
export function SpeedBandBar({ metrics }: { metrics: ComponentMetrics }) {
  const v = metrics.velocity;
  const segments = [
    { key: 'hsr', label: 'Ritorno veloce', value: v.highSpeedRebound.fraction, color: '#7c6cd6' },
    { key: 'lsr', label: 'Ritorno lento', value: v.lowSpeedRebound.fraction, color: REAR },
    { key: 'lsc', label: 'Compr. lenta', value: v.lowSpeedCompression.fraction, color: FRONT },
    { key: 'hsc', label: 'Compr. veloce', value: v.highSpeedCompression.fraction, color: '#2c8ea8' },
  ];
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) return null;

  return (
    <div className="stack stack--2">
      <div style={{ display: 'flex', height: 26, borderRadius: 6, overflow: 'hidden' }}>
        {segments.map((segment) => (
          <div
            key={segment.key}
            style={{
              width: `${(segment.value / total) * 100}%`,
              background: segment.color,
            }}
            role="img"
            aria-label={`${segment.label}: ${Math.round((segment.value / total) * 100)}%`}
          />
        ))}
      </div>
      <div className="row row--wrap" style={{ gap: 'var(--s-3)' }}>
        {segments.map((segment) => (
          <span key={segment.key} className="row text-xs" style={{ gap: 6 }}>
            <span
              aria-hidden="true"
              style={{
                width: 9,
                height: 9,
                borderRadius: 2,
                background: segment.color,
                flex: 'none',
              }}
            />
            <span className="muted">{segment.label}</span>
            <span className="ds-mono">{Math.round((segment.value / total) * 100)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** A single horizontal bar showing where a value sits inside its target band. */
export function BandMeter({
  label,
  value,
  band,
  unit = '%',
  info,
  scaleMax: scaleMaxOverride,
}: {
  label: string;
  value: number;
  band: [number, number];
  unit?: string;
  /** Optional explanation control rendered next to the label. */
  info?: React.ReactNode;
  /**
   * Upper end of the scale. Worth setting when the target band is narrow
   * relative to the natural 0-100 range: sag sits in a 5-point window, which
   * would otherwise be drawn as an invisible sliver.
   */
  scaleMax?: number;
}) {
  const scaleMax = scaleMaxOverride ?? Math.max(100, band[1] * 1.1, value * 1.1);
  const pct = (v: number) => `${Math.min(100, (v / scaleMax) * 100)}%`;
  const inside = value >= band[0] && value <= band[1];

  return (
    <div className="stack stack--2">
      <div className="row row--between text-sm">
        <span className="info-label muted">
          <span>{label}</span>
          {info}
        </span>
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
