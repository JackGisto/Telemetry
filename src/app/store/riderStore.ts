import { create } from 'zustand';
import type { HealthSample, HealthSource, RiderHealthProfile } from '@/types';
import { HealthProviderError, healthProviders, type HealthProvider } from '@/health';
import { deleteRiderProfile, getRiderProfile, saveRiderProfile } from '@/storage';

interface RiderState {
  profile: RiderHealthProfile | null;
  loading: boolean;
  importing: HealthSource | null;

  load: () => Promise<void>;
  /** Records consent and creates an empty profile. Nothing is stored before this. */
  giveConsent: () => Promise<void>;
  /** Deletes the profile and the consent along with it. */
  withdrawConsent: () => Promise<void>;
  update: (patch: Partial<RiderHealthProfile>) => Promise<void>;
  /** Pulls what a provider offers and merges it into the profile. */
  importFrom: (provider: HealthProvider) => Promise<HealthSample[]>;
  providers: () => HealthProvider[];
}

function emptyProfile(): RiderHealthProfile {
  const now = new Date().toISOString();
  return { source: 'manual', updatedAt: now, consentGiven: true, consentAt: now };
}

/** Apply imported samples onto a profile, ignoring anything unrecognised. */
export function applySamples(
  profile: RiderHealthProfile,
  samples: HealthSample[],
  source: HealthSource,
): RiderHealthProfile {
  const next: RiderHealthProfile = { ...profile, source };
  for (const sample of samples) {
    switch (sample.field) {
      case 'sex':
        if (typeof sample.value === 'string') {
          next.sex = sample.value as RiderHealthProfile['sex'];
        }
        break;
      case 'heightCm':
      case 'weightKg':
      case 'birthYear': {
        const value = Number(sample.value);
        // A health app can hand back a blank or nonsensical entry; drop it
        // rather than writing a zero the rider never typed.
        if (Number.isFinite(value) && value > 0) next[sample.field] = value;
        break;
      }
    }
  }
  return next;
}

export const useRiderStore = create<RiderState>((set, get) => ({
  profile: null,
  loading: true,
  importing: null,

  load: async () => {
    set({ loading: true });
    set({ profile: (await getRiderProfile()) ?? null, loading: false });
  },

  giveConsent: async () => {
    const profile = emptyProfile();
    await saveRiderProfile(profile);
    set({ profile });
  },

  withdrawConsent: async () => {
    await deleteRiderProfile();
    set({ profile: null });
  },

  update: async (patch) => {
    const current = get().profile;
    if (!current) throw new Error('Nessun consenso registrato.');
    const next = { ...current, ...patch };
    await saveRiderProfile(next);
    set({ profile: next });
  },

  importFrom: async (provider) => {
    const current = get().profile;
    if (!current) throw new Error('Nessun consenso registrato.');
    if (!provider.isAvailable()) throw new HealthProviderError('not-available');

    set({ importing: provider.source });
    try {
      const result = await provider.read();
      const next = applySamples(current, result.samples, result.source);
      await saveRiderProfile(next);
      set({ profile: next, importing: null });
      return result.samples;
    } catch (error) {
      set({ importing: null });
      throw error;
    }
  },

  providers: () => healthProviders(),
}));
