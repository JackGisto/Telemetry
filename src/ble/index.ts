import type { TransportKind } from '@/types';
import { MockTelemetryTransport } from './mock/MockTelemetryTransport';
import { BleTelemetryTransport, bleAvailability } from './web/BleTelemetryTransport';
import { TransportError, type TelemetryTransport } from './transport/types';

export * from './transport/types';
export * from './transport/messages';
export { MockTelemetryDevice } from './mock/MockTelemetryDevice';
export type { MockDeviceOptions } from './mock/MockTelemetryDevice';
export { MockTelemetryTransport } from './mock/MockTelemetryTransport';
export { BleTelemetryTransport, bleAvailability } from './web/BleTelemetryTransport';
export * from './protocol/codec';
export { GATT, OPCODE, DEVICE_NAME_PREFIX } from './protocol/gatt';

/**
 * The only place the app chooses a concrete transport.
 *
 * Wi-Fi and USB are declared in `TransportKind` but not implemented: they are
 * future channels, and pretending otherwise would be worse than a clear error.
 */
export function createTransport(kind: TransportKind): TelemetryTransport {
  switch (kind) {
    case 'mock':
      return new MockTelemetryTransport();
    case 'ble':
      return new BleTelemetryTransport();
    case 'wifi':
    case 'usb':
      throw new TransportError('not-supported', `Trasporto "${kind}" non ancora implementato`);
  }
}

export interface TransportOption {
  kind: TransportKind;
  label: string;
  available: boolean;
  note?: string;
}

/** What this browser can actually do, for the connection screen. */
export function availableTransports(): TransportOption[] {
  const ble = bleAvailability();
  return [
    {
      kind: 'ble',
      label: 'Dispositivo Bluetooth',
      available: ble.usable,
      note: ble.usable
        ? undefined
        : ble.reason === 'insecure-context'
          ? 'Il Bluetooth richiede una connessione sicura (HTTPS).'
          : 'Questo browser non supporta il Bluetooth web. Usa Chrome su Android o desktop.',
    },
    {
      kind: 'mock',
      label: 'Dispositivo simulato',
      available: true,
      note: 'Permette di provare tutta l’app senza hardware.',
    },
  ];
}
