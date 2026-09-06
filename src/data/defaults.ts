import type { BikeConfig } from '@/types';

export function newId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}`;
}

/** A sensible starting point for the bike setup wizard: a 160/145 trail bike. */
export function createDefaultBike(overrides: Partial<BikeConfig> = {}): BikeConfig {
  const now = new Date().toISOString();
  return {
    id: newId('bike'),
    name: 'La mia bici',
    frontSuspension: {
      totalTravelMm: 160,
      springType: 'air',
      pressurePsi: 75,
      rebound: { available: true, clicks: 8, totalClicks: 16 },
      compression: { available: true, clicks: 10, totalClicks: 16 },
    },
    rearSuspension: {
      present: true,
      totalTravelMm: 60,
      springType: 'air',
      pressurePsi: 180,
      rebound: { available: true, clicks: 7, totalClicks: 14 },
      compression: { available: true, clicks: 8, totalClicks: 14 },
    },
    rider: { style: 'balanced', level: 'intermediate' },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/** Hardtail preset: the rear branch is absent everywhere, not just hidden. */
export function createHardtailBike(overrides: Partial<BikeConfig> = {}): BikeConfig {
  return createDefaultBike({
    name: 'Hardtail',
    rearSuspension: { present: false },
    ...overrides,
  });
}
