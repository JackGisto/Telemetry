import type {
  CalibrationResult,
  DeviceInfo,
  DeviceStatus,
  PositionReading,
  SessionInfo,
  TransferProgress,
  TransportKind,
} from '@/types';
import { TransportError, type TelemetryTransport } from '../core/types';
import { DEFAULT_CHUNK_BYTES } from '../protocol/gatt';
import { MockTelemetryDevice, type MockDeviceOptions } from './MockTelemetryDevice';

/**
 * Transport in front of `MockTelemetryDevice`.
 *
 * It reproduces the awkward parts of a BLE link — chunked transfer, a drop
 * part-way through, and resuming from the last acknowledged offset — so the UI
 * and the storage layer are exercised the same way they will be with real
 * hardware.
 */
export class MockTelemetryTransport implements TelemetryTransport {
  readonly kind: TransportKind = 'mock';
  private connectionLostListeners = new Set<() => void>();
  /** Bytes already delivered per session, so a retry resumes instead of restarting. */
  private resumeOffsets = new Map<string, number>();

  constructor(readonly device: MockTelemetryDevice = new MockTelemetryDevice()) {}

  static withOptions(options: MockDeviceOptions): MockTelemetryTransport {
    return new MockTelemetryTransport(new MockTelemetryDevice(options));
  }

  async connect(): Promise<void> {
    await this.device.connect();
  }

  async disconnect(): Promise<void> {
    await this.device.disconnect();
  }

  async getDeviceInfo(): Promise<DeviceInfo> {
    this.assertConnected();
    return this.device.info;
  }

  async getStatus(): Promise<DeviceStatus> {
    return this.device.getStatus();
  }

  async startRun(): Promise<void> {
    this.assertConnected();
    const status = this.device.getStatus();
    if (status.storageUsed >= 1) throw new TransportError('storage-full');
    if (status.batteryPercent <= 5) throw new TransportError('battery-low');
    await this.device.startRun();
  }

  async stopRun(): Promise<void> {
    this.assertConnected();
    await this.device.stopRun();
  }

  async calibrate(): Promise<CalibrationResult> {
    this.assertConnected();
    return this.device.calibrate();
  }

  async listSessions(): Promise<SessionInfo[]> {
    this.assertConnected();
    return this.device.listSessions();
  }

  async downloadSession(
    id: string,
    onProgress?: (p: TransferProgress) => void,
  ): Promise<ArrayBuffer> {
    this.assertConnected();
    const payload = this.device.getPayload(id);
    if (!payload) throw new TransportError('corrupt-data', `Sessione ${id} non trovata`);

    const total = payload.byteLength;
    // Resume from wherever the previous attempt stopped, not from zero.
    let offset = this.resumeOffsets.get(id) ?? 0;
    let chunkIndex = Math.floor(offset / DEFAULT_CHUNK_BYTES);
    const dropAt = this.device.consumeTransferDrop() ? Math.floor(total * 0.45) : -1;

    while (offset < total) {
      if (dropAt >= 0 && offset >= dropAt) {
        // Remember how far we got, then behave like a real dropped link.
        this.resumeOffsets.set(id, offset);
        this.device.loseConnection();
        for (const l of this.connectionLostListeners) l();
        throw new TransportError('transfer-failed', 'Connessione interrotta durante il download');
      }

      const end = Math.min(total, offset + DEFAULT_CHUNK_BYTES);
      offset = end;
      chunkIndex += 1;
      onProgress?.({ sessionId: id, receivedBytes: offset, totalBytes: total, chunkIndex });
      // Yield so progress can actually render.
      if (chunkIndex % 32 === 0) await Promise.resolve();
    }

    this.resumeOffsets.delete(id);
    return payload.slice(0);
  }

  async deleteSession(id: string): Promise<void> {
    this.assertConnected();
    this.device.deleteSession(id);
  }

  async readPosition(): Promise<PositionReading> {
    this.assertConnected();
    return this.device.readPosition();
  }

  onStatusChange(listener: (status: DeviceStatus) => void): () => void {
    return this.device.onStatusChange(listener);
  }

  onConnectionLost(listener: () => void): () => void {
    this.connectionLostListeners.add(listener);
    return () => this.connectionLostListeners.delete(listener);
  }

  private assertConnected(): void {
    if (!this.device.getStatus().connected) throw new TransportError('connection-lost');
  }
}
