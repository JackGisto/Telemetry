import type { BikeConfig, DiagnosisId, RawSample, Session } from '@/types';
import { generateRun, type RunProfile } from './synth';
import normalRun from './fixtures/normal_run.json';
import stiffFork from './fixtures/stiff_fork.json';
import softShock from './fixtures/soft_shock.json';
import fastRebound from './fixtures/fast_rebound.json';
import slowRebound from './fixtures/slow_rebound.json';
import frontRearImbalance from './fixtures/front_rear_imbalance.json';

export interface Dataset {
  id: string;
  label: string;
  description: string;
  expectedDiagnoses: DiagnosisId[];
  profile: RunProfile;
}

export const DATASETS: Dataset[] = [
  normalRun,
  stiffFork,
  softShock,
  fastRebound,
  slowRebound,
  frontRearImbalance,
] as unknown as Dataset[];

export function getDataset(id: string): Dataset {
  const found = DATASETS.find((d) => d.id === id);
  if (!found) throw new Error(`Dataset sconosciuto: ${id}`);
  return found;
}

export function datasetSamples(id: string): RawSample[] {
  return generateRun(getDataset(id).profile);
}

/** Build a full in-memory session from a dataset, for tests and demo mode. */
export function datasetSession(id: string, bike: BikeConfig, startedAt = new Date(0)): Session {
  const dataset = getDataset(id);
  return {
    id: `demo-${id}`,
    bikeId: bike.id,
    startedAt: startedAt.toISOString(),
    durationSec: dataset.profile.durationSec,
    sampleRateHz: dataset.profile.sampleRateHz,
    trail: dataset.label,
    setupSnapshot: bike,
    source: 'demo',
    samples: generateRun(dataset.profile),
  };
}
