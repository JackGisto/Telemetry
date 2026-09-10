import { create } from 'zustand';
import type {
  CalibrationResult,
  DeviceInfo,
  DeviceStatus,
  SessionInfo,
  TransferProgress,
  TransportKind,
} from '@/types';
import {
  MockTelemetryTransport,
  TransportError,
  createTransport,
  decodeSessionPayload,
  type TelemetryTransport,
  type TransportErrorCode,
} from '@/transport';
import { getCalibration, saveCalibration, saveSession } from '@/storage';
import { newId } from '@/data/defaults';
import { useBikeStore } from './bikeStore';
import { useRiderStore } from './riderStore';

export type ConnectionState = 'idle' | 'scanning' | 'connecting' | 'connected' | 'lost';

interface DeviceState {
  transport: TelemetryTransport | null;
  kind: TransportKind | null;
  connection: ConnectionState;
  info: DeviceInfo | null;
  status: DeviceStatus | null;
  calibration: CalibrationResult | null;
  sessions: SessionInfo[];
  transfer: TransferProgress | null;
  /** Set when the last transfer failed and can be resumed. */
  resumable: string | null;
  lastError: TransportErrorCode | null;

  connect: (kind: TransportKind, origin?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  refreshSessions: () => Promise<void>;
  calibrate: () => Promise<CalibrationResult>;
  loadStoredCalibration: (bikeId: string) => Promise<void>;
  startRun: () => Promise<void>;
  stopRun: () => Promise<void>;
  /** Downloads, decodes, analyses nothing — just stores the run. Returns its id. */
  downloadSession: (deviceSessionId: string) => Promise<string>;
}

/** Normalise anything thrown by a transport into a code the UI can render. */
function toCode(error: unknown): TransportErrorCode {
  if (error instanceof TransportError) return error.code;
  return 'not-supported';
}

export const useDeviceStore = create<DeviceState>((set, get) => ({
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

  connect: async (kind, origin) => {
    set({ connection: kind === 'ble' ? 'scanning' : 'connecting', lastError: null });
    // A Wi-Fi transport is rebuilt whenever the address changes, so editing it
    // in the UI actually takes effect on the next attempt.
    const reusable = get().transport?.kind === kind && !(kind === 'wifi' && origin);
    const transport = reusable ? get().transport! : createTransport(kind, { origin });
    try {
      await transport.connect();
      const [info, status] = await Promise.all([
        transport.getDeviceInfo(),
        transport.getStatus(),
      ]);

      // The device drives the app's state, not the other way round: the
      // physical Start/Stop button shows up here as a status change.
      transport.onStatusChange((next) => set({ status: next }));
      transport.onConnectionLost(() => set({ connection: 'lost', status: null }));

      set({ transport, kind, connection: 'connected', info, status });
      await get().refreshSessions();
    } catch (error) {
      set({ connection: 'idle', lastError: toCode(error) });
      throw error;
    }
  },

  disconnect: async () => {
    await get().transport?.disconnect();
    set({ connection: 'idle', status: null, info: null, sessions: [] });
  },

  refreshStatus: async () => {
    const transport = get().transport;
    if (!transport) return;
    try {
      set({ status: await transport.getStatus() });
    } catch (error) {
      set({ lastError: toCode(error) });
    }
  },

  refreshSessions: async () => {
    const transport = get().transport;
    if (!transport) return;
    try {
      set({ sessions: await transport.listSessions() });
    } catch (error) {
      set({ lastError: toCode(error) });
    }
  },

  calibrate: async () => {
    const transport = get().transport;
    if (!transport) throw new TransportError('connection-lost');
    const result = await transport.calibrate();
    if (result.ok) {
      const bike = useBikeStore.getState().activeBike();
      if (bike) await saveCalibration(bike.id, result);
      set({ calibration: result });
    }
    await get().refreshStatus();
    return result;
  },

  loadStoredCalibration: async (bikeId) => {
    set({ calibration: (await getCalibration(bikeId)) ?? null });
  },

  startRun: async () => {
    const transport = get().transport;
    if (!transport) throw new TransportError('connection-lost');
    try {
      await transport.startRun();
      await get().refreshStatus();
    } catch (error) {
      set({ lastError: toCode(error) });
      throw error;
    }
  },

  stopRun: async () => {
    const transport = get().transport;
    if (!transport) throw new TransportError('connection-lost');
    await transport.stopRun();
    await get().refreshStatus();
    await get().refreshSessions();
  },

  downloadSession: async (deviceSessionId) => {
    const transport = get().transport;
    const bike = useBikeStore.getState().activeBike();
    if (!transport) throw new TransportError('connection-lost');
    if (!bike) throw new Error('Nessuna bici configurata.');

    set({ lastError: null });
    try {
      const buffer = await transport.downloadSession(deviceSessionId, (progress) =>
        set({ transfer: progress }),
      );
      const payload = decodeSessionPayload(buffer);
      const localId = newId('run');

      // Snapshot the rider's weight with the run: retuning the engine later
      // needs to know the mass each run was ridden at.
      const weightKg = useRiderStore.getState().profile?.weightKg;
      const snapshot = weightKg
        ? { ...bike, rider: { ...bike.rider, weightKg } }
        : bike;

      await saveSession({
        id: localId,
        bikeId: bike.id,
        startedAt: payload.startedAt,
        durationSec:
          payload.samples.length > 1
            ? (payload.samples[payload.samples.length - 1].t - payload.samples[0].t) / 1000
            : 0,
        sampleRateHz: payload.sampleRateHz,
        setupSnapshot: snapshot,
        source: 'device',
        samples: payload.samples,
      });

      // The run is safe locally, so it can leave the device.
      await transport.deleteSession?.(deviceSessionId);
      set({ transfer: null, resumable: null });
      await get().refreshSessions();
      await get().refreshStatus();
      return localId;
    } catch (error) {
      const code = toCode(error);
      // A dropped transfer is recoverable: the device still holds the run.
      set({
        lastError: code,
        resumable: code === 'transfer-failed' ? deviceSessionId : null,
        connection: code === 'transfer-failed' ? 'lost' : get().connection,
      });
      throw error;
    }
  },
}));

/** Test/demo helper: swap in a preconfigured mock device. */
export function injectMockTransport(transport: MockTelemetryTransport): void {
  useDeviceStore.setState({ transport, kind: 'mock' });
}
