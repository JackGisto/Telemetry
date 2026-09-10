import type {
  CalibrationResult,
  DeviceInfo,
  DeviceStatus,
  PositionReading,
  SessionInfo,
  TransferProgress,
  TransportKind,
} from '@/types';

/**
 * The single contract between the app and any telemetry device.
 *
 * Mock, BLE, Wi-Fi, USB and a future native bridge all implement this. No code
 * above `src/ble` may import a concrete transport: use `createTransport`.
 */
export interface TelemetryTransport {
  readonly kind: TransportKind;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getDeviceInfo(): Promise<DeviceInfo>;
  getStatus(): Promise<DeviceStatus>;
  startRun(): Promise<void>;
  stopRun(): Promise<void>;
  calibrate(): Promise<CalibrationResult>;
  listSessions(): Promise<SessionInfo[]>;
  /**
   * Download one session. Implementations transfer in chunks and may resume
   * after a drop; `onProgress` reports both, so the UI can show a progress bar
   * and a "ripresa del trasferimento" state.
   */
  downloadSession(id: string, onProgress?: (p: TransferProgress) => void): Promise<ArrayBuffer>;
  /** Free space on the device once a session has been stored locally. */
  deleteSession?(id: string): Promise<void>;

  /**
   * Instantaneous suspension position, in mm of travel used.
   *
   * Optional because it is an extension beyond the original transport contract:
   * the static sag procedure needs it, run recording does not. A transport that
   * does not implement it makes the sag screen unavailable rather than wrong.
   */
  readPosition?(): Promise<PositionReading>;

  /** Fires on unsolicited status changes, including the device's own button. */
  onStatusChange(listener: (status: DeviceStatus) => void): () => void;
  /** Fires when the link drops without `disconnect()` being called. */
  onConnectionLost(listener: () => void): () => void;
}

export type TransportErrorCode =
  | 'device-not-found'
  | 'bluetooth-unavailable'
  | 'bluetooth-disabled'
  | 'permission-denied'
  | 'connection-lost'
  | 'device-busy'
  | 'storage-full'
  | 'battery-low'
  | 'calibration-failed'
  | 'transfer-failed'
  | 'corrupt-data'
  | 'not-supported';

/**
 * A transport failure with a code the UI maps to human wording.
 * Never show `message` directly to the rider; use `errorMessage(code)`.
 */
export class TransportError extends Error {
  constructor(
    readonly code: TransportErrorCode,
    message?: string,
    readonly cause?: unknown,
  ) {
    super(message ?? code);
    this.name = 'TransportError';
  }
}
