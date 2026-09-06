/**
 * Device-facing types.
 *
 * NOTE (firmware TBD): field names here describe what the app needs, not a
 * fixed wire format. The concrete BLE characteristic layout is defined in
 * `src/ble/protocol` and is expected to change once the firmware protocol is
 * frozen. Nothing outside `src/ble` may depend on the wire encoding.
 */

export type TransportKind = 'mock' | 'ble' | 'wifi' | 'usb';

export interface DeviceInfo {
  id: string;
  name: string;
  firmwareVersion: string;
  hardwareRevision: string;
  /** Sensor channels the unit reports. Rear is absent on hardtail installs. */
  channels: Array<'front' | 'rear'>;
  /** Sampling rate the device records at, in Hz. Reported by the device. */
  sampleRateHz: number;
}

export type SensorHealth = 'ok' | 'noisy' | 'disconnected' | 'unknown';

export interface DeviceStatus {
  connected: boolean;
  batteryPercent: number;
  charging: boolean;
  /** 0..1 fraction of on-device storage used. */
  storageUsed: number;
  recording: boolean;
  calibrated: boolean;
  sensors: { front: SensorHealth; rear: SensorHealth | null };
  /** Number of sessions stored on the device and not yet downloaded. */
  pendingSessions: number;
}

export interface CalibrationChannelResult {
  component: 'front' | 'rear';
  /** Raw ADC counts observed at full extension. */
  zeroRaw: number;
  /** Raw ADC counts observed at full compression, when the device knows it. */
  fullRaw?: number;
  /** Standard deviation of the raw samples during the hold, in counts. */
  noiseStdDev: number;
}

export interface CalibrationResult {
  ok: boolean;
  at: string;
  channels: CalibrationChannelResult[];
  /** Populated when `ok` is false. */
  failure?: 'movement-detected' | 'sensor-disconnected' | 'timeout';
}

export interface SessionInfo {
  id: string;
  startedAt: string;
  durationSec: number;
  sampleRateHz: number;
  sizeBytes: number;
  channels: Array<'front' | 'rear'>;
}

export interface TransferProgress {
  sessionId: string;
  receivedBytes: number;
  totalBytes: number;
  /** Increases across resumes; useful for showing "ripresa del trasferimento". */
  chunkIndex: number;
}
