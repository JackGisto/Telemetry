import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IDBFactory } from 'fake-indexeddb';
import type { HealthSample, RiderHealthProfile } from '@/types';
import { ToastProvider } from '@/design-system';
import { getRiderProfile, resetDbForTests, saveRiderProfile } from '@/storage';
import { NativeHealthProvider, hasNativeHealth } from '@/health';
import { applySamples, useAccountStore, useRiderStore } from '@/app/store';
import { ProfilePanel } from './ProfilePanel';
import { AccountPanel } from './AccountPanel';

beforeEach(() => {
  indexedDB = new IDBFactory();
  resetDbForTests();
  useRiderStore.setState({ profile: null, loading: false, importing: null });
  useAccountStore.setState({ account: null, signingIn: null, lastError: null });
  delete window.mtbHealthBridge;
});

const wrap = (ui: React.ReactNode) => render(<ToastProvider>{ui}</ToastProvider>);

const consented = (): RiderHealthProfile => ({
  source: 'manual',
  updatedAt: new Date().toISOString(),
  consentGiven: true,
  consentAt: new Date().toISOString(),
});

describe('consenso ai dati sanitari', () => {
  it('non salva nulla prima del consenso', async () => {
    await expect(saveRiderProfile({ ...consented(), consentGiven: false })).rejects.toThrow(
      /consenso/i,
    );
    expect(await getRiderProfile()).toBeUndefined();
  });

  it('chiede il consenso prima di mostrare i campi', async () => {
    wrap(<ProfilePanel />);
    expect(await screen.findByText(/vuoi salvare i tuoi dati fisici/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/altezza/i)).toBeNull();
  });

  it('mostra i campi dopo il consenso', async () => {
    const user = userEvent.setup();
    wrap(<ProfilePanel />);

    await user.click(await screen.findByRole('button', { name: /acconsento/i }));

    expect(await screen.findByLabelText(/altezza/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/peso/i)).toBeInTheDocument();
  });

  it('la revoca elimina il profilo, non lo nasconde', async () => {
    await act(async () => {
      await useRiderStore.getState().giveConsent();
      await useRiderStore.getState().update({ weightKg: 78 });
    });
    expect((await getRiderProfile())?.weightKg).toBe(78);

    await act(async () => {
      await useRiderStore.getState().withdrawConsent();
    });
    expect(await getRiderProfile()).toBeUndefined();
    expect(useRiderStore.getState().profile).toBeNull();
  });

  it('salva e rilegge i valori inseriti', async () => {
    await act(async () => {
      await useRiderStore.getState().giveConsent();
      await useRiderStore.getState().update({ sex: 'female', heightCm: 172, weightKg: 64 });
    });
    const stored = await getRiderProfile();
    expect(stored).toMatchObject({ sex: 'female', heightCm: 172, weightKg: 64 });
  });
});

describe('import dalle app di salute', () => {
  it('dichiara Apple Health non disponibile in un browser', () => {
    const provider = new NativeHealthProvider('apple-health', 'Salute di Apple');
    expect(hasNativeHealth()).toBe(false);
    expect(provider.isAvailable()).toBe(false);
    expect(provider.unavailableReason()).toMatch(/solo dall’app installata/i);
  });

  it('diventa disponibile quando esiste il ponte nativo', () => {
    window.mtbHealthBridge = {
      platform: 'apple-health',
      requestPermission: async () => true,
      readProfile: async () => [],
    };
    expect(new NativeHealthProvider('apple-health', 'Salute di Apple').isAvailable()).toBe(true);
    // A bridge for one platform must not answer for the other.
    expect(new NativeHealthProvider('health-connect', 'Health Connect').isAvailable()).toBe(false);
  });

  it('legge i valori dal ponte nativo e li unisce al profilo', async () => {
    const samples: HealthSample[] = [
      { field: 'weightKg', value: 81.5 },
      { field: 'heightCm', value: 183 },
      { field: 'sex', value: 'male' },
    ];
    window.mtbHealthBridge = {
      platform: 'health-connect',
      requestPermission: async () => true,
      readProfile: async () => samples,
    };

    await act(async () => {
      await useRiderStore.getState().giveConsent();
      await useRiderStore
        .getState()
        .importFrom(new NativeHealthProvider('health-connect', 'Health Connect'));
    });

    expect(useRiderStore.getState().profile).toMatchObject({
      weightKg: 81.5,
      heightCm: 183,
      sex: 'male',
      source: 'health-connect',
    });
  });

  it('segnala il permesso negato senza scrivere nulla', async () => {
    window.mtbHealthBridge = {
      platform: 'apple-health',
      requestPermission: async () => false,
      readProfile: async () => [{ field: 'weightKg', value: 99 }],
    };
    await act(async () => {
      await useRiderStore.getState().giveConsent();
    });

    await expect(
      useRiderStore
        .getState()
        .importFrom(new NativeHealthProvider('apple-health', 'Salute di Apple')),
    ).rejects.toMatchObject({ code: 'permission-denied' });
    expect(useRiderStore.getState().profile?.weightKg).toBeUndefined();
  });

  it('scarta i valori non validi che un’app di salute può restituire', () => {
    const merged = applySamples(
      consented(),
      [
        { field: 'weightKg', value: 0 },
        { field: 'heightCm', value: 'non un numero' },
        { field: 'birthYear', value: 1988 },
      ],
      'apple-health',
    );
    expect(merged.weightKg).toBeUndefined();
    expect(merged.heightCm).toBeUndefined();
    expect(merged.birthYear).toBe(1988);
  });

  it('non importa senza consenso', async () => {
    window.mtbHealthBridge = {
      platform: 'apple-health',
      requestPermission: async () => true,
      readProfile: async () => [{ field: 'weightKg', value: 70 }],
    };
    await expect(
      useRiderStore
        .getState()
        .importFrom(new NativeHealthProvider('apple-health', 'Salute di Apple')),
    ).rejects.toThrow(/consenso/i);
  });
});

describe('accesso', () => {
  it('propone di continuare senza account, ed è la via consigliata', async () => {
    wrap(<AccountPanel />);
    const local = await screen.findByRole('button', { name: /continua senza account/i });
    expect(local).toBeEnabled();
    expect(screen.getByText('Consigliato')).toBeInTheDocument();
  });

  it('spiega perché Google non è disponibile invece di offrire un pulsante morto', async () => {
    wrap(<AccountPanel />);
    // No client ID is configured in a test build.
    expect(await screen.findByText(/non configurato/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /accedi con google/i })).toBeDisabled();
  });

  it('crea un’identità locale e la conserva', async () => {
    const user = userEvent.setup();
    wrap(<AccountPanel />);

    await user.click(await screen.findByRole('button', { name: /continua senza account/i }));

    // Sign-in writes to IndexedDB before updating the store, so the assertion
    // has to wait for it. Reading the store straight after the click passed on
    // a fast machine and failed in CI.
    await waitFor(() => {
      expect(useAccountStore.getState().account?.provider).toBe('local');
    });
    expect(await screen.findByText(/account locale/i)).toBeInTheDocument();
  });

  it('uscire non elimina i dati del rider', async () => {
    await act(async () => {
      await useRiderStore.getState().giveConsent();
      await useRiderStore.getState().update({ weightKg: 75 });
      await useAccountStore.getState().signIn('local');
      await useAccountStore.getState().signOut();
    });

    expect(useAccountStore.getState().account).toBeNull();
    expect((await getRiderProfile())?.weightKg).toBe(75);
  });

  it('non scrive il nome dell’account nel profilo senza consenso', async () => {
    // Signing in is not consent to store health data.
    const spy = vi.spyOn(useRiderStore.getState(), 'update');
    await act(async () => {
      await useAccountStore.getState().signIn('local');
    });
    expect(spy).not.toHaveBeenCalled();
    expect(await getRiderProfile()).toBeUndefined();
  });
});
