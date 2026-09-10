import { beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IDBFactory } from 'fake-indexeddb';
import { ToastProvider } from '@/design-system';
import { MockTelemetryTransport, type TelemetryTransport } from '@/transport';
import { getSag, resetDbForTests, saveBike } from '@/storage';
import { createDefaultBike } from '@/data/defaults';
import { useBikeStore, useDeviceStore, useSagStore, useSettingsStore } from '@/app/store';
import { injectMockTransport } from '@/app/store/deviceStore';
import { SagPanel } from './SagPanel';

const bike = createDefaultBike({ id: 'bike-sag' });

beforeEach(async () => {
  indexedDB = new IDBFactory();
  resetDbForTests();
  await saveBike(bike);
  useSettingsStore.setState({ activeBikeId: bike.id });
  useBikeStore.setState({ bikes: [bike], loading: false });
  useSagStore.setState({ measurement: null, measuring: false, unstableMm: null });
  useDeviceStore.setState({ transport: null, connection: 'idle', status: null, info: null });
});

function renderPanel() {
  return render(
    <ToastProvider>
      <SagPanel />
    </ToastProvider>,
  );
}

/** Connect a mock device whose simulated bike sits at the given sag. */
async function connect(options: Parameters<typeof MockTelemetryTransport.withOptions>[0]) {
  injectMockTransport(MockTelemetryTransport.withOptions({ speed: 0, ...options }));
  await act(async () => {
    await useDeviceStore.getState().connect('mock');
  });
}

describe('flusso di misura del sag', () => {
  it('chiede di collegare il dispositivo quando non c’è', async () => {
    renderPanel();
    expect(await screen.findByText(/collega il dispositivo per misurare/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /misura il sag/i })).toBeDisabled();
  });

  it('misura un sag corretto e non propone modifiche', async () => {
    const user = userEvent.setup();
    await connect({ sag: { front: 0.17, rear: 0.27 } });
    renderPanel();

    await user.click(screen.getByRole('button', { name: /misura il sag/i }));

    expect(await screen.findByText(/il sag è corretto/i, {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.queryByText(/azione consigliata/i)).toBeNull();
  }, 15000);

  it('misura un sag eccessivo e dice di quanto cambiare la pressione', async () => {
    const user = userEvent.setup();
    await connect({ sag: { front: 0.32, rear: 0.27 } });
    renderPanel();

    await user.click(screen.getByRole('button', { name: /misura il sag/i }));

    await screen.findByText(/azione consigliata/i, {}, { timeout: 5000 });
    // Too much sag means the fork needs more pressure, stated as a number.
    expect(screen.getByText(/aggiungi \d+ psi alla forcella/i)).toBeInTheDocument();
  }, 15000);

  it('rifiuta la misura se il rider si muove e lo spiega', async () => {
    const user = userEvent.setup();
    await connect({ sag: { front: 0.18, rear: 0.27 }, unstableSag: true });
    renderPanel();

    await user.click(screen.getByRole('button', { name: /misura il sag/i }));

    const alert = await screen.findByRole('alert', {}, { timeout: 5000 });
    expect(alert).toHaveTextContent(/movimento rilevato/i);
    expect(screen.queryByText(/azione consigliata/i)).toBeNull();
  }, 15000);

  it('salva la misura, così sopravvive alla chiusura dell’app', async () => {
    const user = userEvent.setup();
    await connect({ sag: { front: 0.17, rear: 0.27 } });
    renderPanel();

    await user.click(screen.getByRole('button', { name: /misura il sag/i }));
    await screen.findByText(/il sag è corretto/i, {}, { timeout: 5000 });

    const stored = await getSag(bike.id);
    expect(stored?.bikeId).toBe(bike.id);
    expect(stored?.channels).toHaveLength(2);
  }, 15000);

  it('avvisa quando il canale di collegamento non legge la posizione', async () => {
    // A transport without readPosition stands in for the Bluetooth channel,
    // where the firmware has not defined the command yet.
    const transport = MockTelemetryTransport.withOptions({ speed: 0 });
    const limited: TelemetryTransport = {
      ...transport,
      kind: transport.kind,
      connect: () => transport.connect(),
      disconnect: () => transport.disconnect(),
      getDeviceInfo: () => transport.getDeviceInfo(),
      getStatus: () => transport.getStatus(),
      startRun: () => transport.startRun(),
      stopRun: () => transport.stopRun(),
      calibrate: () => transport.calibrate(),
      listSessions: () => transport.listSessions(),
      downloadSession: (id, onProgress) => transport.downloadSession(id, onProgress),
      onStatusChange: (l) => transport.onStatusChange(l),
      onConnectionLost: (l) => transport.onConnectionLost(l),
      // readPosition deliberately absent.
    };

    injectMockTransport(limited as unknown as MockTelemetryTransport);
    await act(async () => {
      await useDeviceStore.getState().connect('mock');
    });
    renderPanel();

    expect(await screen.findByText(/non permette di leggere la posizione/i)).toBeInTheDocument();
  }, 15000);
});
