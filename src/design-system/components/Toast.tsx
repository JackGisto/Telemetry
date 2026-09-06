import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Tone } from './primitives';

export interface Toast {
  id: number;
  tone: Tone;
  title: string;
  body?: string;
}

interface ToastApi {
  push: (toast: Omit<Toast, 'id'>) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const GLYPH: Record<Tone, string> = { ok: '✓', warn: '!', danger: '✕', info: 'i', neutral: '–' };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = Date.now() + Math.random();
      setToasts((current) => [...current, { ...toast, id }]);
      // Errors stay until dismissed; everything else clears itself.
      if (toast.tone !== 'danger') setTimeout(() => dismiss(id), 4500);
    },
    [dismiss],
  );

  const api = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.tone}`}>
            <span aria-hidden="true" style={{ fontWeight: 700 }}>
              {GLYPH[toast.tone]}
            </span>
            <div className="grow">
              <strong>{toast.title}</strong>
              {toast.body && <div className="muted text-sm">{toast.body}</div>}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Chiudi notifica"
              style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--c-text-faint)' }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast deve essere usato dentro <ToastProvider>');
  return ctx;
}
