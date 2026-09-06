/**
 * BLE GATT map.
 *
 * FIRMWARE TBD — every UUID and opcode below is a placeholder. The firmware
 * team owns this file's values; the app only relies on the *shape* (one command
 * characteristic, one notifying status characteristic, one notifying data
 * characteristic). When the real protocol lands, change the constants here and
 * `BleTelemetryTransport` keeps working unmodified.
 *
 * These placeholders are deliberately not derived from any published BYB or
 * third-party protocol: no such specification was provided.
 */
export const GATT = {
  serviceUuid: '0000fe80-0000-1000-8000-00805f9b34fb',
  /** Write: opcode + little-endian arguments. */
  commandCharacteristic: '0000fe81-0000-1000-8000-00805f9b34fb',
  /** Notify: packed device status. */
  statusCharacteristic: '0000fe82-0000-1000-8000-00805f9b34fb',
  /** Notify: session data chunks during a download. */
  dataCharacteristic: '0000fe83-0000-1000-8000-00805f9b34fb',
  /** Read: device info JSON. */
  infoCharacteristic: '0000fe84-0000-1000-8000-00805f9b34fb',
} as const;

export const OPCODE = {
  startRun: 0x01,
  stopRun: 0x02,
  calibrate: 0x03,
  listSessions: 0x04,
  /** Followed by the session id and the byte offset to resume from. */
  downloadSession: 0x05,
  deleteSession: 0x06,
} as const;

/** Conservative default; the real MTU is negotiated at connection time. */
export const DEFAULT_CHUNK_BYTES = 180;

/** Advertised name prefix used to filter the device picker. FIRMWARE TBD. */
export const DEVICE_NAME_PREFIX = 'MTBTelem';
