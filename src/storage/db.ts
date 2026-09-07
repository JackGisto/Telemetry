import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { AnalysisReport, BikeConfig, CalibrationResult, Session, SessionMeta } from '@/types';

/**
 * Local-first persistence. Everything the rider owns lives here and nowhere
 * else: there is no account, no server and no sync in V1 (spec section 31).
 * The schema is versioned so a future cloud sync can be added on top without a
 * migration of the rider's existing data.
 */

export interface AppSettings {
  /** Standard is the default; Expert unlocks the charts and raw data. */
  mode: 'standard' | 'expert';
  onboardingCompleted: boolean;
  activeBikeId: string | null;
  preferredTransport: 'wifi' | 'ble' | 'mock';
  /** Address of the acquisition unit on the network. Wi-Fi only. */
  deviceOrigin: string;
  units: 'metric' | 'imperial';
}

export const DEFAULT_SETTINGS: AppSettings = {
  mode: 'standard',
  onboardingCompleted: false,
  activeBikeId: null,
  preferredTransport: 'wifi',
  deviceOrigin: 'http://192.168.4.1',
  units: 'metric',
};

interface TelemetryDB extends DBSchema {
  bikes: { key: string; value: BikeConfig };
  /** Session metadata, without the samples, so lists stay cheap to load. */
  sessions: { key: string; value: SessionMeta; indexes: { 'by-date': string } };
  /** Samples stored separately and loaded only when a run is opened. */
  samples: { key: string; value: { sessionId: string; samples: Session['samples'] } };
  reports: { key: string; value: AnalysisReport };
  calibrations: { key: string; value: CalibrationResult & { bikeId: string } };
  settings: { key: string; value: unknown };
}

const DB_NAME = 'mtb-telemetry';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<TelemetryDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<TelemetryDB>> {
  if (!dbPromise) {
    dbPromise = openDB<TelemetryDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('bikes')) db.createObjectStore('bikes', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('sessions')) {
          const store = db.createObjectStore('sessions', { keyPath: 'id' });
          store.createIndex('by-date', 'startedAt');
        }
        if (!db.objectStoreNames.contains('samples')) {
          db.createObjectStore('samples', { keyPath: 'sessionId' });
        }
        if (!db.objectStoreNames.contains('reports')) {
          db.createObjectStore('reports', { keyPath: 'sessionId' });
        }
        if (!db.objectStoreNames.contains('calibrations')) {
          db.createObjectStore('calibrations', { keyPath: 'bikeId' });
        }
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
      },
    });
  }
  return dbPromise;
}

/** Test hook: drops the cached connection so `fake-indexeddb` can be reset. */
export function resetDbForTests(): void {
  dbPromise = null;
}
