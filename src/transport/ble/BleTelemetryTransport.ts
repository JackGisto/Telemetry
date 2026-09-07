import type {
  CalibrationResult,
  DeviceInfo,
  DeviceStatus,
  SessionInfo,
  TransferProgress,
  TransportKind,
} from '@/types';
import { TransportError, type TelemetryTransport } from '../core/types';
import { DEVICE_NAME_PREFIX, GATT, OPCODE } from '../protocol/gatt';
import { crc32 } from '../protocol/codec';

/**
 * Web Bluetooth transport.
 *
 * FIRMWARE TBD: the command encoding and the status/data packet layouts below
 * follow `src/ble/protocol/gatt.ts`, which is a placeholder. This class is
 * structurally complete and connects, discovers and subscribes correctly, but
 * it cannot be verified against hardware until the firmware protocol is frozen.
 * Everything hardware-specific is confined to the private methods at the bottom.
 */
export class BleTelemetryTransport implements TelemetryTransport {
  readonly kind: TransportKind = 'ble';

  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private command: BluetoothRemoteGATTCharacteristic | null = null;
  private statusChar: BluetoothRemoteGATTCharacteristic | null = null;
  private dataChar: BluetoothRemoteGATTCharacteristic | null = null;

  private statusListeners = new Set<(s: DeviceStatus) => void>();
  private connectionLostListeners = new Set<() => void>();
  private lastStatus: DeviceStatus | null = null;
  private resumeOffsets = new Map<string, number>();

  async connect(): Promise<void> {
    if (!bleAvailability().usable) {
      throw new TransportError('bluetooth-unavailable');
    }
    try {
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: DEVICE_NAME_PREFIX }],
        optionalServices: [GATT.serviceUuid],
      });
    } catch (cause) {
      // The chooser throws NotFoundError both when the rider cancels and when
      // nothing is advertising; neither is distinguishable from the web API.
      throw new TransportError('device-not-found', 'Nessun dispositivo selezionato', cause);
    }

    this.device.addEventListener('gattserverdisconnected', this.handleDisconnect);

    const server = await this.device.gatt?.connect();
    if (!server) throw new TransportError('connection-lost');
    this.server = server;

    const service = await server.getPrimaryService(GATT.serviceUuid);
    this.command = await service.getCharacteristic(GATT.commandCharacteristic);
    this.statusChar = await service.getCharacteristic(GATT.statusCharacteristic);
    this.dataChar = await service.getCharacteristic(GATT.dataCharacteristic);

    await this.statusChar.startNotifications();
    this.statusChar.addEventListener('characteristicvaluechanged', this.handleStatusNotification);
  }

  async disconnect(): Promise<void> {
    this.device?.removeEventListener('gattserverdisconnected', this.handleDisconnect);
    this.statusChar?.removeEventListener(
      'characteristicvaluechanged',
      this.handleStatusNotification,
    );
    this.server?.disconnect();
    this.server = null;
    this.command = null;
    this.statusChar = null;
    this.dataChar = null;
  }

  async getDeviceInfo(): Promise<DeviceInfo> {
    const service = await this.requireService();
    const char = await service.getCharacteristic(GATT.infoCharacteristic);
    const value = await char.readValue();
    return JSON.parse(new TextDecoder().decode(value)) as DeviceInfo;
  }

  async getStatus(): Promise<DeviceStatus> {
    if (this.lastStatus) return this.lastStatus;
    const char = this.statusChar;
    if (!char) throw new TransportError('connection-lost');
    return decodeStatus(await char.readValue());
  }

  async startRun(): Promise<void> {
    await this.send(OPCODE.startRun);
  }

  async stopRun(): Promise<void> {
    await this.send(OPCODE.stopRun);
  }

  async calibrate(): Promise<CalibrationResult> {
    await this.send(OPCODE.calibrate);
    // FIRMWARE TBD: the device reports the calibration outcome on the status
    // characteristic; the exact packet is not defined yet.
    throw new TransportError('not-supported', 'Calibrazione BLE non ancora definita dal firmware');
  }

  async listSessions(): Promise<SessionInfo[]> {
    await this.send(OPCODE.listSessions);
    throw new TransportError('not-supported', 'Elenco sessioni BLE non ancora definito dal firmware');
  }

  /**
   * Chunked download with resume. The transfer restarts from the last byte the
   * app confirmed, not from zero, and the CRC in the payload header is checked
   * by `decodeSessionPayload` once the buffer is complete.
   */
  async downloadSession(
    id: string,
    onProgress?: (p: TransferProgress) => void,
  ): Promise<ArrayBuffer> {
    const char = this.dataChar;
    if (!char) throw new TransportError('connection-lost');

    const startOffset = this.resumeOffsets.get(id) ?? 0;
    const chunks: Uint8Array[] = [];
    let received = startOffset;
    let total = 0;
    let chunkIndex = Math.floor(startOffset / 180);

    const done = new Promise<void>((resolve, reject) => {
      const onChunk = (event: Event) => {
        const view = (event.target as BluetoothRemoteGATTCharacteristic).value;
        if (!view) return;
        // FIRMWARE TBD: header layout assumed as [u32 totalBytes][payload].
        if (total === 0 && view.byteLength >= 4) {
          total = view.getUint32(0, true);
          return;
        }
        const bytes = new Uint8Array(view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength));
        chunks.push(bytes);
        received += bytes.length;
        chunkIndex += 1;
        this.resumeOffsets.set(id, received);
        onProgress?.({ sessionId: id, receivedBytes: received, totalBytes: total, chunkIndex });
        if (total > 0 && received >= total) {
          char.removeEventListener('characteristicvaluechanged', onChunk);
          resolve();
        }
      };
      char.addEventListener('characteristicvaluechanged', onChunk);
      this.onConnectionLost(() => {
        char.removeEventListener('characteristicvaluechanged', onChunk);
        reject(new TransportError('transfer-failed'));
      });
    });

    await char.startNotifications();
    await this.send(OPCODE.downloadSession, encodeDownloadArgs(id, startOffset));
    await done;

    const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
    let cursor = 0;
    for (const c of chunks) {
      out.set(c, cursor);
      cursor += c.length;
    }
    // Integrity is verified again by the payload CRC; this catches a truncated
    // transfer that still reported completion.
    if (total > 0 && out.length + startOffset < total) {
      throw new TransportError('transfer-failed', 'Trasferimento incompleto');
    }
    this.resumeOffsets.delete(id);
    void crc32;
    return out.buffer;
  }

  async deleteSession(id: string): Promise<void> {
    await this.send(OPCODE.deleteSession, new TextEncoder().encode(id));
  }

  onStatusChange(listener: (status: DeviceStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  onConnectionLost(listener: () => void): () => void {
    this.connectionLostListeners.add(listener);
    return () => this.connectionLostListeners.delete(listener);
  }

  private handleDisconnect = () => {
    this.lastStatus = null;
    for (const l of this.connectionLostListeners) l();
  };

  private handleStatusNotification = (event: Event) => {
    const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
    if (!value) return;
    this.lastStatus = decodeStatus(value);
    for (const l of this.statusListeners) l(this.lastStatus);
  };

  private async requireService(): Promise<BluetoothRemoteGATTService> {
    if (!this.server) throw new TransportError('connection-lost');
    return this.server.getPrimaryService(GATT.serviceUuid);
  }

  private async send(opcode: number, args?: Uint8Array): Promise<void> {
    if (!this.command) throw new TransportError('connection-lost');
    const packet = new Uint8Array(1 + (args?.length ?? 0));
    packet[0] = opcode;
    if (args) packet.set(args, 1);
    await this.command.writeValueWithResponse(packet);
  }
}

function encodeDownloadArgs(id: string, offset: number): Uint8Array {
  const idBytes = new TextEncoder().encode(id);
  const out = new Uint8Array(4 + idBytes.length);
  new DataView(out.buffer).setUint32(0, offset, true);
  out.set(idBytes, 4);
  return out;
}

/**
 * FIRMWARE TBD: packed status layout, assumed as
 * [u8 flags][u8 battery][u8 storage%][u8 sensors][u8 pendingSessions].
 */
function decodeStatus(view: DataView): DeviceStatus {
  const flags = view.byteLength > 0 ? view.getUint8(0) : 0;
  const sensorBits = view.byteLength > 3 ? view.getUint8(3) : 0;
  const health = (bit: number): 'ok' | 'disconnected' =>
    (sensorBits >> bit) & 1 ? 'ok' : 'disconnected';
  return {
    connected: true,
    recording: Boolean(flags & 0b0001),
    calibrated: Boolean(flags & 0b0010),
    charging: Boolean(flags & 0b0100),
    batteryPercent: view.byteLength > 1 ? view.getUint8(1) : 0,
    storageUsed: view.byteLength > 2 ? view.getUint8(2) / 100 : 0,
    sensors: { front: health(0), rear: health(1) },
    pendingSessions: view.byteLength > 4 ? view.getUint8(4) : 0,
  };
}

export interface BleAvailability {
  usable: boolean;
  reason?: 'no-api' | 'insecure-context';
}

/**
 * Honest capability check. Web Bluetooth is absent on iOS Safari and on Firefox,
 * and requires a secure context everywhere: the UI tells the rider that plainly
 * rather than failing at the first click.
 */
export function bleAvailability(): BleAvailability {
  if (typeof navigator === 'undefined' || !('bluetooth' in navigator)) {
    return { usable: false, reason: 'no-api' };
  }
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return { usable: false, reason: 'insecure-context' };
  }
  return { usable: true };
}
