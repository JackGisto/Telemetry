import { create } from 'zustand';
import type { BikeConfig } from '@/types';
import { deleteBike, listBikes, saveBike } from '@/storage';
import { useSettingsStore } from './settingsStore';

interface BikeState {
  bikes: BikeConfig[];
  loading: boolean;
  load: () => Promise<void>;
  upsert: (bike: BikeConfig) => Promise<void>;
  remove: (id: string) => Promise<void>;
  activeBike: () => BikeConfig | null;
  setActive: (id: string) => Promise<void>;
}

export const useBikeStore = create<BikeState>((set, get) => ({
  bikes: [],
  loading: true,

  load: async () => {
    set({ loading: true });
    set({ bikes: await listBikes(), loading: false });
  },

  upsert: async (bike) => {
    await saveBike(bike);
    set({ bikes: await listBikes() });
    // The first bike created becomes the active one automatically.
    if (!useSettingsStore.getState().activeBikeId) {
      await useSettingsStore.getState().update({ activeBikeId: bike.id });
    }
  },

  remove: async (id) => {
    await deleteBike(id);
    const bikes = await listBikes();
    set({ bikes });
    if (useSettingsStore.getState().activeBikeId === id) {
      await useSettingsStore.getState().update({ activeBikeId: bikes[0]?.id ?? null });
    }
  },

  activeBike: () => {
    const activeId = useSettingsStore.getState().activeBikeId;
    return get().bikes.find((b) => b.id === activeId) ?? get().bikes[0] ?? null;
  },

  setActive: async (id) => {
    await useSettingsStore.getState().update({ activeBikeId: id });
  },
}));
