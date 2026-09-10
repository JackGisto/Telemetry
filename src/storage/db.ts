import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  AnalysisReport,
  BikeConfig,
  CalibrationResult,
  RiderHealthProfile,
  SagMeasurement,
  Session,
  SessionMeta,
} from '@/types';
import type { Account } from '@/auth';

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
  /** Latest static sag measurement per bike. */
  sag: { key: string; value: SagMeasurement };
  /**
   * The rider's own profile. Health data, so a single record guarded by
   * explicit consent rather than something scattered across other stores.
   */
  rider: { key: string; value: RiderHealthProfile };
  /** The signed-in account, or the local identity. One record. */
  account: { key: string; value: Account };
  settings: { key: string; value: unknown };
}

const DB_NAME = 'mtb-telemetry';
const DB_VERSION = 4;

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
        // Added in version 2; existing databases gain the store on upgrade
        // without touching anything the rider already has.
        if (!db.objectStoreNames.contains('sag')) {
          db.createObjectStore('sag', { keyPath: 'bikeId' });
        }
        // Added in version 3.
        if (!db.objectStoreNames.contains('rider')) db.createObjectStore('rider');
        // Added in version 4.
        if (!db.objectStoreNames.contains('account')) db.createObjectStore('account');
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
