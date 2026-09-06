import { create } from 'zustand';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type AppSettings } from '@/storage';

interface SettingsState extends AppSettings {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  update: (patch: Partial<AppSettings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULT_SETTINGS,
  hydrated: false,

  hydrate: async () => {
    const stored = await loadSettings();
    set({ ...stored, hydrated: true });
  },

  update: async (patch) => {
    const { hydrated: _h, hydrate: _hy, update: _u, ...current } = get();
    const next = { ...current, ...patch };
    set(patch);
    await saveSettings(next);
  },
}));
