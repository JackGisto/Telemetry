import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { Session } from '@/types';
import { datasetSession } from '@/data/datasets';
import { createDefaultBike } from '@/data/defaults';
import { analyseSession } from '@/analysis';
import { resetDbForTests } from './db';
import {
  clearAllData,
  deleteSession,
  getBike,
  getCalibration,
  getReport,
  getSession,
  listBikes,
  listSessions,
  loadSettings,
  saveBike,
  saveCalibration,
  saveReport,
  saveSession,
  saveSettings,
  updateSessionMeta,
} from './repository';

/** A fresh database per test, so nothing leaks between cases. */
beforeEach(() => {
  indexedDB = new IDBFactory();
  resetDbForTests();
});

const bike = createDefaultBike({ id: 'bike-1', name: 'Enduro' });

function run(id: string): Session {
  return { ...datasetSession('normal_run', bike), id };
}

describe('persistenza bici', () => {
  it('salva e rilegge una bici', async () => {
    await saveBike(bike);
    const stored = await getBike('bike-1');
    expect(stored?.name).toBe('Enduro');
    expect(await listBikes()).toHaveLength(1);
  });

  it('aggiorna updatedAt a ogni salvataggio', async () => {
    await saveBike({ ...bike, updatedAt: '2020-01-01T00:00:00.000Z' });
    const stored = await getBike('bike-1');
    expect(stored?.updatedAt).not.toBe('2020-01-01T00:00:00.000Z');
  });
});

describe('persistenza run', () => {
  it('salva metadati e campioni e li ricompone alla lettura', async () => {
    const session = run('run-1');
    await saveSession(session);
    const stored = await getSession('run-1');
    expect(stored?.samples).toHaveLength(session.samples.length);
    expect(stored?.samples[10]).toEqual(session.samples[10]);
    expect(stored?.setupSnapshot.id).toBe('bike-1');
  });

  it('elenca le run dalla più recente alla più vecchia', async () => {
    await saveSession({ ...run('vecchia'), startedAt: '2024-01-01T10:00:00.000Z' });
    await saveSession({ ...run('nuova'), startedAt: '2025-01-01T10:00:00.000Z' });
    expect((await listSessions()).map((s) => s.id)).toEqual(['nuova', 'vecchia']);
  });

  it('aggiorna note e trail senza toccare i campioni', async () => {
    await saveSession(run('run-1'));
    await updateSessionMeta('run-1', { notes: '+5 PSI mono', trail: 'Larici' });
    const stored = await getSession('run-1');
    expect(stored?.notes).toBe('+5 PSI mono');
    expect(stored?.trail).toBe('Larici');
    expect(stored?.samples.length).toBeGreaterThan(0);
  });

  it('elimina run, campioni e analisi insieme', async () => {
    const session = run('run-1');
    await saveSession(session);
    await saveReport(analyseSession(session));
    await deleteSession('run-1');

    expect(await getSession('run-1')).toBeUndefined();
    expect(await getReport('run-1')).toBeUndefined();
    expect(await listSessions()).toHaveLength(0);
  });

  it('restituisce undefined per una run inesistente', async () => {
    expect(await getSession('non-esiste')).toBeUndefined();
  });
});

describe('analisi e calibrazione', () => {
  it('conserva il report calcolato', async () => {
    const session = run('run-1');
    await saveSession(session);
    const report = analyseSession(session);
    await saveReport(report);
    expect((await getReport('run-1'))?.scores.overall).toBe(report.scores.overall);
  });

  it('conserva la calibrazione per bici', async () => {
    await saveCalibration('bike-1', {
      ok: true,
      at: '2025-01-01T00:00:00.000Z',
      channels: [{ component: 'front', zeroRaw: 12, noiseStdDev: 1.4 }],
    });
    expect((await getCalibration('bike-1'))?.ok).toBe(true);
    expect(await getCalibration('bike-2')).toBeUndefined();
  });
});

describe('impostazioni', () => {
  it('parte dai valori predefiniti', async () => {
    const settings = await loadSettings();
    expect(settings.mode).toBe('standard');
    expect(settings.onboardingCompleted).toBe(false);
  });

  it('unisce i valori salvati con i predefiniti', async () => {
    await saveSettings({ ...(await loadSettings()), mode: 'expert' });
    const settings = await loadSettings();
    expect(settings.mode).toBe('expert');
    expect(settings.units).toBe('metric');
  });
});

describe('cancellazione totale', () => {
  it('svuota ogni store', async () => {
    await saveBike(bike);
    await saveSession(run('run-1'));
    await saveSettings({ ...(await loadSettings()), onboardingCompleted: true });

    await clearAllData();

    expect(await listBikes()).toHaveLength(0);
    expect(await listSessions()).toHaveLength(0);
    expect((await loadSettings()).onboardingCompleted).toBe(false);
  });
});
