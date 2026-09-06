import type { BalanceVerdict, Recommendation, Severity, Verdict } from '@/types';
import type { Tone } from '@/design-system';

/**
 * UX writing for analysis results.
 *
 * All rider-facing wording lives here, not in components: Standard mode's whole
 * value is that these few words are right, so they are worth keeping together
 * and reviewing as a set.
 */

export const VERDICT_LABEL: Record<Verdict, string> = {
  'too-soft': 'Troppo morbida',
  'slightly-soft': 'Leggermente morbida',
  correct: 'Corretto',
  'slightly-stiff': 'Leggermente rigida',
  'too-stiff': 'Troppo rigida',
  unknown: 'Dati insufficienti',
};

export const VERDICT_TONE: Record<Verdict, Tone> = {
  'too-soft': 'danger',
  'slightly-soft': 'warn',
  correct: 'ok',
  'slightly-stiff': 'warn',
  'too-stiff': 'danger',
  unknown: 'neutral',
};

export const BALANCE_LABEL: Record<BalanceVerdict, string> = {
  'front-soft': 'Avantreno leggermente cedevole',
  'rear-soft': 'Retrotreno leggermente cedevole',
  balanced: 'Equilibrato',
  unknown: 'Dati insufficienti',
};

export const BALANCE_TONE: Record<BalanceVerdict, Tone> = {
  'front-soft': 'warn',
  'rear-soft': 'warn',
  balanced: 'ok',
  unknown: 'neutral',
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  info: 'Nota',
  minor: 'Lieve',
  moderate: 'Media',
  major: 'Importante',
};

export const SEVERITY_TONE: Record<Severity, Tone> = {
  info: 'info',
  minor: 'info',
  moderate: 'warn',
  major: 'danger',
};

export function scoreTone(score: number): Tone {
  if (score >= 80) return 'ok';
  if (score >= 60) return 'warn';
  return 'danger';
}

export function scoreLabel(score: number): string {
  if (score >= 90) return 'Ottimo';
  if (score >= 80) return 'Buono';
  if (score >= 60) return 'Migliorabile';
  if (score >= 40) return 'Da sistemare';
  return 'Fuori assetto';
}

/** Short, imperative summary of a recommendation's mechanical effect. */
export function actionSummary(rec: Recommendation): string {
  const where = 'component' in rec.action
    ? rec.action.component === 'front'
      ? 'Forcella'
      : 'Posteriore'
    : 'Sistema';
  switch (rec.action.kind) {
    case 'pressure':
      return `${where} · ${rec.action.deltaPsi > 0 ? '+' : ''}${rec.action.deltaPsi} PSI`;
    case 'rebound':
      return `${where} · rebound ${rec.action.deltaClicks > 0 ? '+' : ''}${rec.action.deltaClicks} click`;
    case 'compression':
      return `${where} · compressione ${rec.action.deltaClicks > 0 ? '+' : ''}${rec.action.deltaClicks} click`;
    case 'preload':
      return `${where} · precarico ${rec.action.deltaTurns > 0 ? '+' : ''}${rec.action.deltaTurns} giri`;
    case 'spring-rate':
      return `${where} · molla più ${rec.action.direction === 'stiffer' ? 'dura' : 'morbida'}`;
    case 'explain':
      return `${where} · nessuna regolazione disponibile`;
  }
}

export function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return `${formatDate(iso)} · ${date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
}
