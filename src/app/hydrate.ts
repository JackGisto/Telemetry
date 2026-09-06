import { useBikeStore, useHistoryStore, useSettingsStore } from './store';

/** One-shot load of everything the app needs from IndexedDB at startup. */
export async function hydrateApp(): Promise<void> {
  await useSettingsStore.getState().hydrate();
  await Promise.all([useBikeStore.getState().load(), useHistoryStore.getState().load()]);
}
