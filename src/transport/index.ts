import type { TransportKind } from '@/types';
import { MockTelemetryTransport } from './mock/MockTelemetryTransport';
import { BleTelemetryTransport, bleAvailability } from './ble/BleTelemetryTransport';
import { WifiTelemetryTransport, wifiAvailability } from './wifi/WifiTelemetryTransport';
import { DEFAULT_DEVICE_ORIGIN } from './wifi/protocol';
import { TransportError, type TelemetryTransport } from './core/types';

export * from './core/types';
export * from './core/messages';
export { MockTelemetryDevice } from './mock/MockTelemetryDevice';
export type { MockDeviceOptions } from './mock/MockTelemetryDevice';
export { MockTelemetryTransport } from './mock/MockTelemetryTransport';
export { WifiTelemetryTransport, wifiAvailability } from './wifi/WifiTelemetryTransport';
export { DEFAULT_DEVICE_ORIGIN, ROUTES as WIFI_ROUTES } from './wifi/protocol';
export { BleTelemetryTransport, bleAvailability } from './ble/BleTelemetryTransport';
export * from './protocol/codec';
export { GATT, OPCODE, DEVICE_NAME_PREFIX } from './protocol/gatt';

export interface TransportOptions {
  /** Address of the unit on the network. Wi-Fi only. */
  origin?: string;
}

/**
 * The only place the app chooses a concrete transport.
 *
 * Wi-Fi is the primary channel: it is the one that works on every browser and
 * every phone. Bluetooth remains available where the unit and the browser both
 * support it, and USB is a future channel that is not implemented.
 */
export function createTransport(
  kind: TransportKind,
  options: TransportOptions = {},
): TelemetryTransport {
  switch (kind) {
    case 'wifi':
      return new WifiTelemetryTransport(options.origin ?? DEFAULT_DEVICE_ORIGIN);
    case 'mock':
      return new MockTelemetryTransport();
    case 'ble':
      return new BleTelemetryTransport();
    case 'usb':
      throw new TransportError('not-supported', `Trasporto "${kind}" non ancora implementato`);
  }
}

export interface TransportOption {
  kind: TransportKind;
  label: string;
  description: string;
  available: boolean;
  note?: string;
  /** Shown first and pre-selected. */
  primary?: boolean;
}

/** What this browser can actually do, for the connection screen. */
export function availableTransports(origin: string = DEFAULT_DEVICE_ORIGIN): TransportOption[] {
  const wifi = wifiAvailability(origin);
  const ble = bleAvailability();

  return [
    {
      kind: 'wifi',
      label: 'Wi-Fi',
      description: 'Collegati alla rete del dispositivo e apri il collegamento.',
      available: wifi.usable,
      primary: true,
      note: wifi.usable
        ? undefined
        : 'Questa pagina è servita in HTTPS e il dispositivo risponde in HTTP, quindi il browser blocca la connessione. Apri l’app dalla versione locale indicata nella documentazione.',
    },
    {
      kind: 'ble',
      label: 'Bluetooth',
      description: 'Canale alternativo, dove browser e dispositivo lo supportano.',
      available: ble.usable,
      note: ble.usable
        ? undefined
        : ble.reason === 'insecure-context'
          ? 'Il Bluetooth richiede una connessione sicura (HTTPS).'
          : 'Questo browser non supporta il Bluetooth web. Su iPhone usa il Wi-Fi.',
    },
    {
      kind: 'mock',
      label: 'Dispositivo simulato',
      description: 'Prova tutta l’app senza hardware.',
      available: true,
    },
  ];
}
