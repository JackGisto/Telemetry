import { beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { IDBFactory } from 'fake-indexeddb';
import { resetDbForTests } from '@/storage';
import { MockTelemetryTransport } from '@/transport';
import { AppRoutes } from './routes';
import {
  useAccountStore,
  useBikeStore,
  useDeviceStore,
  useHistoryStore,
  useRiderStore,
  useSettingsStore,
} from './store';
import { injectMockTransport } from './store/deviceStore';

/**
 * End-to-end user flow, run against the mock device:
 * onboarding -> connect -> bike setup -> calibration -> run -> download ->
 * analysis -> recommendation -> history -> comparison.
 */

beforeEach(() => {
  indexedDB = new IDBFactory();
  resetDbForTests();
  useSettingsStore.setState({ onboardingCompleted: false, activeBikeId: null, mode: 'standard' });
  useBikeStore.setState({ bikes: [], loading: false });
  useHistoryStore.setState({ sessions: [], reports: {}, loading: false });
  useRiderStore.setState({ profile: null, loading: false, importing: null });
  useAccountStore.setState({ account: null, signingIn: null, lastError: null });
  useDeviceStore.setState({
    transport: null,
    kind: null,
    connection: 'idle',
    info: null,
    status: null,
    calibration: null,
    sessions: [],
    transfer: null,
    resumable: null,
    lastError: null,
  });
});

function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe('landing page', () => {
  it('presenta la proposta di valore e porta all’app', async () => {
    renderApp('/');
    await screen.findByRole('heading', { name: /misura\.\s*analizza\.\s*regola\./i });
    expect(screen.getAllByRole('link', { name: /apri l’app|scarica l’app/i }).length).toBeGreaterThan(0);
  });
});

describe('onboarding', () => {
  it('richiede l’onboarding al primo avvio', async () => {
    renderApp('/app');
    await screen.findByRole('heading', { name: /misura come lavorano davvero/i });
  });

  it('offre di proseguire senza account, senza imporre la registrazione', async () => {
    const user = userEvent.setup();
    renderApp('/onboarding');

    await user.click(await screen.findByRole('button', { name: /iniziamo/i }));
    await screen.findByRole('heading', { name: /vuoi un account\?/i });

    // The product's promise is that it works with no account at all, so the
    // no-account path must be present and must not be a dead end.
    expect(screen.getByRole('button', { name: /continua senza account/i })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: /continua senza account/i }));
    await screen.findByRole('heading', { name: /collega il dispositivo/i });
  });

  it('porta dal benvenuto alla connessione del dispositivo simulato', async () => {
    const user = userEvent.setup();
    renderApp('/onboarding');

    await user.click(await screen.findByRole('button', { name: /iniziamo/i }));
    await user.click(await screen.findByRole('button', { name: /decido dopo/i }));
    await screen.findByRole('heading', { name: /collega il dispositivo/i });

    // Web Bluetooth is unavailable under jsdom, so the app must say so plainly
    // rather than offering a button that cannot work.
    expect(screen.getByText(/non supporta il bluetooth web/i)).toBeInTheDocument();

    const simulated = screen.getByText('Dispositivo simulato').closest('.card')!;
    await user.click(within(simulated as HTMLElement).getByRole('button', { name: /collega/i }));

    await screen.findByRole('heading', { name: /configura la bici/i });
  });
});

describe('flusso completo con dispositivo simulato', () => {
  /** Onboard a full-suspension bike, leaving the app on the Home screen. */
  async function setUpBike(user: ReturnType<typeof userEvent.setup>) {
    renderApp('/onboarding');
    await user.click(await screen.findByRole('button', { name: /iniziamo/i }));
    await user.click(await screen.findByRole('button', { name: /decido dopo/i }));
    await user.click(await screen.findByRole('button', { name: /salta per ora/i }));
    await screen.findByRole('heading', { name: /configura la bici/i });

    // Step 1: bike (full suspension is preselected), then fork, shock, rider.
    await user.click(screen.getByRole('button', { name: /continua/i }));
    await screen.findByRole('heading', { name: 'Forcella' });
    await user.click(screen.getByRole('button', { name: /continua/i }));
    await screen.findByRole('heading', { name: /ammortizzatore posteriore/i });
    await user.click(screen.getByRole('button', { name: /continua/i }));
    await user.click(await screen.findByRole('button', { name: /salva bici/i }));

    await screen.findByRole('heading', { name: /telemetria mtb/i });
    // Home loads the last report from IndexedDB asynchronously; let that settle
    // so the state update does not land outside act() during the next step.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  it('registra, scarica e analizza una run producendo un consiglio concreto', async () => {
    const user = userEvent.setup();
    await setUpBike(user);

    // The device already holds a run with a clearly soft shock.
    injectMockTransport(
      MockTelemetryTransport.withOptions({
        speed: 0,
        startCalibrated: true,
        preloadedDatasetIds: ['soft_shock'],
      }),
    );
    await act(async () => {
      await useDeviceStore.getState().connect('mock');
    });

    await user.click(screen.getByRole('link', { name: /^run$/i }));
    await screen.findByRole('heading', { name: 'Run' });

    // Readiness is stated before anything else: can I start?
    await screen.findByText(/pronto/i);

    const download = await screen.findByRole('button', { name: /scarica dati/i });
    await user.click(download);

    // Analysis opens automatically once the transfer completes.
    await screen.findByRole('heading', { name: 'Analisi' }, { timeout: 5000 });
    await screen.findByText(/azione consigliata/i);

    // Standard mode: a verdict per component and an actionable instruction.
    expect(screen.getByText('Forcella')).toBeInTheDocument();
    expect(screen.getByText('Posteriore')).toBeInTheDocument();
    expect(screen.getByText(/aggiungi \d+ psi al posteriore/i)).toBeInTheDocument();

    // At most three recommendations in Standard mode.
    expect(screen.getAllByRole('listitem').length).toBeLessThanOrEqual(3);
  }, 20000);

  it('salva la run nello storico e ne permette il confronto', async () => {
    const user = userEvent.setup();
    await setUpBike(user);

    injectMockTransport(
      MockTelemetryTransport.withOptions({
        speed: 0,
        startCalibrated: true,
        preloadedDatasetIds: ['soft_shock', 'normal_run'],
      }),
    );
    // Download both runs straight through the store: the UI path is covered above.
    await act(async () => {
      await useDeviceStore.getState().connect('mock');
      const [first, second] = useDeviceStore.getState().sessions;
      await useDeviceStore.getState().downloadSession(first.id);
      await useDeviceStore.getState().downloadSession(second.id);
      await useHistoryStore.getState().load();
    });

    await user.click(screen.getByRole('link', { name: /storico/i }));
    await screen.findByRole('heading', { name: 'Storico' });
    expect(await screen.findByText('Run #2')).toBeInTheDocument();
    expect(screen.getByText('Run #1')).toBeInTheDocument();

    const compareButtons = screen.getAllByRole('button', { name: /^confronta$/i });
    await user.click(compareButtons[0]);
    await user.click(screen.getAllByRole('button', { name: /^confronta$/i })[0]);

    await user.click(await screen.findByRole('button', { name: /^confronta$/i }));
    await screen.findByRole('heading', { name: 'Confronto' }, { timeout: 5000 });
    await screen.findByText(/modifiche al setup/i);
  }, 25000);
});

describe('hardtail', () => {
  it('nasconde ogni impostazione del posteriore quando la bici non ha il mono', async () => {
    const user = userEvent.setup();
    renderApp('/onboarding');

    await user.click(await screen.findByRole('button', { name: /iniziamo/i }));
    await user.click(await screen.findByRole('button', { name: /decido dopo/i }));
    await user.click(await screen.findByRole('button', { name: /salta per ora/i }));
    await screen.findByRole('heading', { name: /configura la bici/i });

    await user.click(screen.getByRole('button', { name: /no, hardtail/i }));
    await user.click(screen.getByRole('button', { name: /continua/i }));
    await screen.findByRole('heading', { name: 'Forcella' });

    // The wizard skips the rear step entirely rather than showing a disabled one.
    await user.click(screen.getByRole('button', { name: /continua/i }));
    expect(screen.queryByRole('heading', { name: /ammortizzatore posteriore/i })).toBeNull();
    await screen.findByText(/stile di guida/i);

    await user.click(screen.getByRole('button', { name: /salva bici/i }));
    await waitFor(() => {
      expect(useBikeStore.getState().bikes[0]?.rearSuspension.present).toBe(false);
    });
  }, 20000);
});
