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
import { analyseSession, learnFromHistory, type SetupLearning } from '@/analysis';

interface HistoryState {
  sessions: SessionMeta[];
  reports: Record<string, AnalysisReport>;
  loading: boolean;
  /** What the rider's own history says about how their bike responds. */
  learning: SetupLearning;

  load: () => Promise<void>;
  /** Loads the run, analysing it on first open and caching the report. */
  open: (id: string) => Promise<{ session: Session; report: AnalysisReport } | null>;
  /** Recompute the learned response rates from the stored reports. */
  relearn: () => Promise<void>;
  /** Recomputes the report, e.g. after the riding style changed. */
  reanalyse: (id: string) => Promise<AnalysisReport | null>;
  updateMeta: (id: string, patch: Partial<Pick<SessionMeta, 'notes' | 'trail'>>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  sessions: [],
  reports: {},
  loading: true,
  learning: { observations: [], sensitivities: [] },

  load: async () => {
    set({ loading: true });
    const sessions = await listSessions();
    set({ sessions, loading: false });
    await get().relearn();
  },

  /**
   * Recompute the response rates from every analysed run.
   *
   * Only runs that already have a stored report take part: analysing the whole
   * history here would make opening the app proportional to how long the rider
   * has owned it, for a number that changes only when a run is added.
   */
  relearn: async () => {
    const sessions = get().sessions;
    const reports = await Promise.all(sessions.map((s) => getReport(s.id)));
    const runs = sessions
      .map((session, i) => ({ session, report: reports[i] }))
      .filter((entry): entry is { session: SessionMeta; report: AnalysisReport } =>
        Boolean(entry.report),
      );
    set({ learning: learnFromHistory(runs) });
  },

  open: async (id) => {
    const session = await getSession(id);
    if (!session) return null;

    const cached = get().reports[id] ?? (await getReport(id));
    if (cached) {
      set((s) => ({ reports: { ...s.reports, [id]: cached } }));
      return { session, report: cached };
    }

    const report = analyseSession(session, {
      sensitivities: get().learning.sensitivities,
    });
    await saveReport(report);
    set((s) => ({ reports: { ...s.reports, [id]: report } }));
    await get().relearn();
    return { session, report };
  },

  reanalyse: async (id) => {
    const session = await getSession(id);
    if (!session) return null;
    const report = analyseSession(session, {
      sensitivities: get().learning.sensitivities,
    });
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
