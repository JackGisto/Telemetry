import { create } from 'zustand';
import type { PositionReading, SagMeasurement } from '@/types';
import { SagUnstableError, computeSag, DEFAULT_TUNABLES } from '@/analysis';
import { getSag, saveSag } from '@/storage';
import { TransportError } from '@/transport';
import { useBikeStore } from './bikeStore';
import { useDeviceStore } from './deviceStore';

interface SagState {
  measurement: SagMeasurement | null;
  measuring: boolean;
  /** Set when the last attempt failed because the rider moved. */
  unstableMm: number | null;

  load: (bikeId: string) => Promise<void>;
  measure: () => Promise<SagMeasurement>;
}

/** Time between position samples during the hold, in milliseconds. */
const SAMPLE_INTERVAL_MS = 150;

export const useSagStore = create<SagState>((set) => ({
  measurement: null,
  measuring: false,
  unstableMm: null,

  load: async (bikeId) => {
    set({ measurement: (await getSag(bikeId)) ?? null });
  },

  /**
   * Collect a short burst of position readings while the rider holds still,
   * then hand them to the engine. The device is polled rather than streamed
   * because a single reading cannot tell a settled bike from a moving one.
   */
  measure: async () => {
    const transport = useDeviceStore.getState().transport;
    const bike = useBikeStore.getState().activeBike();
    if (!transport) throw new TransportError('connection-lost');
    if (!transport.readPosition) {
      throw new TransportError('not-supported', 'Questo canale non legge la posizione');
    }
    if (!bike) throw new Error('Nessuna bici configurata.');

    set({ measuring: true, unstableMm: null });
    try {
      const readings: PositionReading[] = [];
      for (let i = 0; i < DEFAULT_TUNABLES.sagSampleCount; i++) {
        readings.push(await transport.readPosition());
        if (i < DEFAULT_TUNABLES.sagSampleCount - 1) {
          await new Promise((resolve) => setTimeout(resolve, SAMPLE_INTERVAL_MS));
        }
      }

      const measurement = computeSag(readings, bike);
      await saveSag(measurement);
      set({ measurement, measuring: false });
      return measurement;
    } catch (error) {
      set({
        measuring: false,
        unstableMm: error instanceof SagUnstableError ? error.spreadMm : null,
      });
      throw error;
    }
  },
}));
