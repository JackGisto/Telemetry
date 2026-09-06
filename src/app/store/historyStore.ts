import { create } from 'zustand';
import type { AnalysisReport, Session, SessionMeta } from '@/types';
import {
  deleteSession,
  getReport,
  getSession,
  listSessions,
  saveReport,
  updateSessionMeta,
} from '@/storage';
import { analyseSession } from '@/analysis';

interface HistoryState {
  sessions: SessionMeta[];
  reports: Record<string, AnalysisReport>;
  loading: boolean;

  load: () => Promise<void>;
  /** Loads the run, analysing it on first open and caching the report. */
  open: (id: string) => Promise<{ session: Session; report: AnalysisReport } | null>;
  /** Recomputes the report, e.g. after the riding style changed. */
  reanalyse: (id: string) => Promise<AnalysisReport | null>;
  updateMeta: (id: string, patch: Partial<Pick<SessionMeta, 'notes' | 'trail'>>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  sessions: [],
  reports: {},
  loading: true,

  load: async () => {
    set({ loading: true });
    set({ sessions: await listSessions(), loading: false });
  },

  open: async (id) => {
    const session = await getSession(id);
    if (!session) return null;

    const cached = get().reports[id] ?? (await getReport(id));
    if (cached) {
      set((s) => ({ reports: { ...s.reports, [id]: cached } }));
      return { session, report: cached };
    }

    const report = analyseSession(session);
    await saveReport(report);
    set((s) => ({ reports: { ...s.reports, [id]: report } }));
    return { session, report };
  },

  reanalyse: async (id) => {
    const session = await getSession(id);
    if (!session) return null;
    const report = analyseSession(session);
    await saveReport(report);
    set((s) => ({ reports: { ...s.reports, [id]: report } }));
    return report;
  },

  updateMeta: async (id, patch) => {
    await updateSessionMeta(id, patch);
    set({ sessions: await listSessions() });
  },

  remove: async (id) => {
    await deleteSession(id);
    const { [id]: _removed, ...reports } = get().reports;
    set({ sessions: await listSessions(), reports });
  },
}));
