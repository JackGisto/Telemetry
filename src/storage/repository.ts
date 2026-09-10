import type { Account } from '@/auth';
import type {
  AnalysisReport,
  BikeConfig,
  CalibrationResult,
  RiderHealthProfile,
  SagMeasurement,
  Session,
  SessionMeta,
} from '@/types';
import { DEFAULT_SETTINGS, getDb, type AppSettings } from './db';

/** Every read and write the app performs. Nothing else touches IndexedDB. */

export async function saveBike(bike: BikeConfig): Promise<void> {
  const db = await getDb();
  await db.put('bikes', { ...bike, updatedAt: new Date().toISOString() });
}

export async function listBikes(): Promise<BikeConfig[]> {
  const db = await getDb();
  return db.getAll('bikes');
}

export async function getBike(id: string): Promise<BikeConfig | undefined> {
  const db = await getDb();
  return db.get('bikes', id);
}

export async function deleteBike(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('bikes', id);
}

/** Stores metadata and samples in one transaction, so a run is never half-saved. */
export async function saveSession(session: Session): Promise<void> {
  const { samples, ...meta } = session;
  const db = await getDb();
  const tx = db.transaction(['sessions', 'samples'], 'readwrite');
  await Promise.all([
    tx.objectStore('sessions').put(meta),
    tx.objectStore('samples').put({ sessionId: session.id, samples }),
    tx.done,
  ]);
}

export async function listSessions(): Promise<SessionMeta[]> {
  const db = await getDb();
  const all = await db.getAll('sessions');
  return all.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export async function getSession(id: string): Promise<Session | undefined> {
  const db = await getDb();
  const meta = await db.get('sessions', id);
  if (!meta) return undefined;
  const stored = await db.get('samples', id);
  return { ...meta, samples: stored?.samples ?? [] };
}

export async function updateSessionMeta(
  id: string,
  patch: Partial<Pick<SessionMeta, 'notes' | 'trail'>>,
): Promise<void> {
  const db = await getDb();
  const meta = await db.get('sessions', id);
  if (!meta) return;
  await db.put('sessions', { ...meta, ...patch });
}

/** Deletes the run and everything derived from it. */
export async function deleteSession(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['sessions', 'samples', 'reports'], 'readwrite');
  await Promise.all([
    tx.objectStore('sessions').delete(id),
    tx.objectStore('samples').delete(id),
    tx.objectStore('reports').delete(id),
    tx.done,
  ]);
}

export async function saveReport(report: AnalysisReport): Promise<void> {
  const db = await getDb();
  await db.put('reports', report);
}

export async function getReport(sessionId: string): Promise<AnalysisReport | undefined> {
  const db = await getDb();
  return db.get('reports', sessionId);
}

export async function saveCalibration(
  bikeId: string,
  calibration: CalibrationResult,
): Promise<void> {
  const db = await getDb();
  await db.put('calibrations', { ...calibration, bikeId });
}

export async function getCalibration(bikeId: string): Promise<CalibrationResult | undefined> {
  const db = await getDb();
  return db.get('calibrations', bikeId);
}

export async function saveSag(measurement: SagMeasurement): Promise<void> {
  const db = await getDb();
  await db.put('sag', measurement);
}

export async function getSag(bikeId: string): Promise<SagMeasurement | undefined> {
  const db = await getDb();
  return db.get('sag', bikeId);
}

/**
 * Writes the rider profile.
 *
 * Refuses without consent: health data must not reach storage on the strength
 * of a half-filled form. The caller records consent first, or nothing is saved.
 */
export async function saveRiderProfile(profile: RiderHealthProfile): Promise<void> {
  if (!profile.consentGiven) {
    throw new Error('Consenso mancante: il profilo non viene salvato.');
  }
  const db = await getDb();
  await db.put('rider', { ...profile, updatedAt: new Date().toISOString() }, 'me');
}

export async function getRiderProfile(): Promise<RiderHealthProfile | undefined> {
  const db = await getDb();
  return db.get('rider', 'me');
}

/** Withdrawing consent deletes the data, it does not merely hide it. */
export async function deleteRiderProfile(): Promise<void> {
  const db = await getDb();
  await db.delete('rider', 'me');
}

export async function saveAccount(account: Account): Promise<void> {
  const db = await getDb();
  await db.put('account', account, 'me');
}

export async function getAccount(): Promise<Account | undefined> {
  const db = await getDb();
  return db.get('account', 'me');
}

export async function deleteAccount(): Promise<void> {
  const db = await getDb();
  await db.delete('account', 'me');
}

export async function loadSettings(): Promise<AppSettings> {
  const db = await getDb();
  const stored = (await db.get('settings', 'app')) as Partial<AppSettings> | undefined;
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await getDb();
  await db.put('settings', settings, 'app');
}

/** Full local wipe, offered in Settings. */
export async function clearAllData(): Promise<void> {
  const db = await getDb();
  const stores = [
    'bikes',
    'sessions',
    'samples',
    'reports',
    'calibrations',
    'sag',
    'rider',
    'account',
    'settings',
  ] as const;
  const tx = db.transaction(stores, 'readwrite');
  await Promise.all([...stores.map((s) => tx.objectStore(s).clear()), tx.done]);
}
