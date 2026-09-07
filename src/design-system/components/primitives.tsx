import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

/** Reusable primitives. These are the only building blocks the screens use. */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg' | 'hero';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  loading?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  block,
  loading,
  disabled,
  children,
  className = '',
  ...rest
}: ButtonProps) {
  const classes = [
    'btn',
    variant !== 'secondary' ? `btn--${variant}` : '',
    size !== 'md' ? `btn--${size}` : '',
    block ? 'btn--block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classes} disabled={disabled || loading} aria-busy={loading} {...rest}>
      {loading && <span className="spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function Card({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`card ${className}`} {...rest} />;
}

export type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral';

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

/**
 * Status indicator. The glyph is not decorative: it carries the same
 * information as the colour, so the state survives a colour-blind reader and
 * a washed-out screen in the sun.
 */
const STATUS_GLYPH: Record<'ok' | 'warn' | 'danger' | 'neutral', string> = {
  ok: '✓',
  warn: '!',
  danger: '✕',
  neutral: '–',
};

export function StatusIndicator({
  tone,
  label,
  live,
}: {
  tone: 'ok' | 'warn' | 'danger' | 'neutral';
  label: string;
  live?: boolean;
}) {
  return (
    <span className={`status status--${tone}${live ? ' status--live' : ''}`}>
      <span className="status__dot" aria-hidden="true" />
      <span className="status__glyph" aria-hidden="true">
        {live ? '●' : STATUS_GLYPH[tone]}
      </span>
      <span>{label}</span>
    </span>
  );
}

export function Progress({
  value,
  max = 100,
  label,
  indeterminate,
}: {
  value?: number;
  max?: number;
  label?: string;
  indeterminate?: boolean;
}) {
  const pct = indeterminate ? 0 : Math.round(((value ?? 0) / max) * 100);
  return (
    <div
      className={`progress${indeterminate ? ' progress--indeterminate' : ''}`}
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="progress__bar" style={indeterminate ? undefined : { width: `${pct}%` }} />
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  info,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  /** Optional explanation control rendered next to the label. */
  info?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <span className="info-label">
        <label className="field__label" htmlFor={htmlFor}>
          {label}
        </label>
        {info}
      </span>
      {children}
      {error ? (
        <span className="field__error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="field__hint">{hint}</span>
      ) : null}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="segmented__option"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Choice({
  selected,
  title,
  description,
  onClick,
}: {
  selected: boolean;
  title: string;
  description?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="choice" aria-pressed={selected} onClick={onClick}>
      <span className="choice__title">{title}</span>
      {description && <span className="choice__desc">{description}</span>}
    </button>
  );
}

export function EmptyState({
  glyph = '○',
  title,
  body,
  action,
}: {
  glyph?: string;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="state">
      <span className="state__glyph" aria-hidden="true">
        {glyph}
      </span>
      <h3 className="state__title">{title}</h3>
      {body && <p className="state__body">{body}</p>}
      {action}
    </div>
  );
}

export function ErrorState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="state" role="alert">
      <span className="state__glyph" style={{ color: 'var(--c-danger)' }} aria-hidden="true">
        ⚠
      </span>
      <h3 className="state__title">{title}</h3>
      {body && <p className="state__body">{body}</p>}
      {action}
    </div>
  );
}

export function LoadingState({ label = 'Caricamento…' }: { label?: string }) {
  return (
    <div className="state" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <p className="state__body">{label}</p>
    </div>
  );
}

export function Skeleton({ height = 20, width = '100%' }: { height?: number; width?: string }) {
  return <div className="skeleton" style={{ height, width }} aria-hidden="true" />;
}
