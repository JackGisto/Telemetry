import type {
  CalibrationResult,
  DeviceInfo,
  DeviceStatus,
  PositionReading,
  SessionInfo,
} from '@/types';
import { DATASETS, datasetSamples, getDataset } from '@/data/datasets';
import { encodeSessionPayload } from '../protocol/codec';
import { DEFAULT_FULL_SCALE_RAW } from '@/data/normalize';

export interface MockDeviceOptions {
  /** Speed multiplier for every simulated delay. 0 makes the device instant. */
  speed?: number;
  batteryPercent?: number;
  /** 0..1 fraction of storage already used. */
  storageUsed?: number;
  /** Force calibration to fail with movement detected. */
  failCalibration?: boolean;
  /** Drop the link once, part-way through the next download. */
  dropDuringTransfer?: boolean;
  /** Dataset used for the next recorded run. */
  datasetId?: string;
  startCalibrated?: boolean;
  /** Sessions already stored on the device at startup. */
  preloadedDatasetIds?: string[];
  /**
   * Sag the simulated bike settles at, as a fraction of travel, so the sag
   * screen can be exercised in and out of band.
   */
  sag?: { front: number; rear: number };
  /**
   * Travel of the simulated hardware. The real unit reports millimetres, so the
   * mock needs its own stroke to synthesise a plausible reading; it is a
   * property of the simulated bike, not something the caller passes in.
   */
  travelMm?: { front: number; rear: number | null };
  /** Make the simulated rider wobble, to exercise the instability path. */
  unstableSag?: boolean;
}

interface StoredSession {
  info: SessionInfo;
  payload: ArrayBuffer;
}

/**
 * A simulated telemetry unit.
 *
 * It models the parts of a real device the app has to cope with: it records on
 * its own once started, it keeps the run in local memory if the phone walks
 * away, it reports battery and storage, and it can fail on demand. This is what
 * makes the whole flow testable with no hardware at all.
 */
export class MockTelemetryDevice {
  private status: DeviceStatus;
  private sessions = new Map<string, StoredSession>();
  private listeners = new Set<(s: DeviceStatus) => void>();
  private recordingStartedAt: number | null = null;
  private counter = 0;
  private transferDropArmed: boolean;

  constructor(private options: MockDeviceOptions = {}) {
    this.transferDropArmed = options.dropDuringTransfer ?? false;
    this.status = {
      connected: false,
      batteryPercent: options.batteryPercent ?? 78,
      charging: false,
      storageUsed: options.storageUsed ?? 0.12,
      recording: false,
      calibrated: options.startCalibrated ?? false,
      sensors: { front: 'ok', rear: 'ok' },
      pendingSessions: 0,
    };
    for (const id of options.preloadedDatasetIds ?? []) this.storeSession(id);
  }

  readonly info: DeviceInfo = {
    id: 'mock-0001',
    name: 'MTBTelem Mock',
    firmwareVersion: '0.0.0-mock',
    hardwareRevision: 'ESP32-mini / LS-13 + LS-95',
    channels: ['front', 'rear'],
    sampleRateHz: 100,
  };

  getStatus(): DeviceStatus {
    return { ...this.status, sensors: { ...this.status.sensors } };
  }

  onStatusChange(listener: (s: DeviceStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    const snapshot = this.getStatus();
    for (const l of this.listeners) l(snapshot);
  }

  private delay(ms: number): Promise<void> {
    const speed = this.options.speed ?? 1;
    if (speed <= 0) return Promise.resolve();
    return new Promise((resolve) => setTimeout(resolve, ms / speed));
  }

  async connect(): Promise<void> {
    await this.delay(600);
    this.status.connected = true;
    this.emit();
  }

  async disconnect(): Promise<void> {
    this.status.connected = false;
    this.emit();
  }

  /** Simulates the link dropping while the device keeps recording. */
  loseConnection(): void {
    this.status.connected = false;
    this.emit();
  }

  async calibrate(): Promise<CalibrationResult> {
    await this.delay(1800);
    if (this.options.failCalibration) {
      return {
        ok: false,
        at: new Date().toISOString(),
        channels: [],
        failure: 'movement-detected',
      };
    }
    this.status.calibrated = true;
    this.emit();
    return {
      ok: true,
      at: new Date().toISOString(),
      channels: [
        { component: 'front', zeroRaw: 0, fullRaw: DEFAULT_FULL_SCALE_RAW, noiseStdDev: 2.1 },
        { component: 'rear', zeroRaw: 0, fullRaw: DEFAULT_FULL_SCALE_RAW, noiseStdDev: 1.8 },
      ],
    };
  }

  async startRun(): Promise<void> {
    await this.delay(300);
    this.status.recording = true;
    this.recordingStartedAt = Date.now();
    this.emit();
  }

  /**
   * Stop recording and store the run on the device. The session stays on the
   * device until it is downloaded, exactly as the real unit behaves, which is
   * what makes a mid-run disconnection non-destructive.
   */
  async stopRun(): Promise<void> {
    await this.delay(300);
    this.status.recording = false;
    this.recordingStartedAt = null;
    this.storeSession(this.options.datasetId ?? this.pickDataset());
    this.emit();
  }

  /** The device's own Start/Stop button, used to test app-state sync. */
  pressPhysicalButton(): void {
    if (this.status.recording) void this.stopRun();
    else void this.startRun();
  }

  private pickDataset(): string {
    // Cycle through the datasets so successive runs differ, deterministically.
    const dataset = DATASETS[this.counter % DATASETS.length];
    return dataset.id;
  }

  private storeSession(datasetId: string): void {
    if (this.status.storageUsed >= 1) return;
    const dataset = getDataset(datasetId);
    const samples = datasetSamples(datasetId);
    const id = `sess-${String(++this.counter).padStart(3, '0')}`;
    const payload = encodeSessionPayload({
      sessionId: id,
      startedAt: new Date(this.recordingStartedAt ?? Date.now()).toISOString(),
      sampleRateHz: dataset.profile.sampleRateHz,
      samples,
    });
    this.sessions.set(id, {
      info: {
        id,
        startedAt: new Date(this.recordingStartedAt ?? Date.now()).toISOString(),
        durationSec: dataset.profile.durationSec,
        sampleRateHz: dataset.profile.sampleRateHz,
        sizeBytes: payload.byteLength,
        channels: ['front', 'rear'],
      },
      payload,
    });
    this.status.pendingSessions = this.sessions.size;
    this.status.storageUsed = Math.min(1, this.status.storageUsed + 0.08);
    this.status.batteryPercent = Math.max(0, this.status.batteryPercent - 3);
  }

  listSessions(): SessionInfo[] {
    return [...this.sessions.values()]
      .map((s) => s.info)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  getPayload(id: string): ArrayBuffer | undefined {
    return this.sessions.get(id)?.payload;
  }

  deleteSession(id: string): void {
    if (this.sessions.delete(id)) {
      this.status.pendingSessions = this.sessions.size;
      this.status.storageUsed = Math.max(0, this.status.storageUsed - 0.08);
      this.emit();
    }
  }

  /** True once, then disarms: lets a test exercise resume-after-drop. */
  consumeTransferDrop(): boolean {
    if (!this.transferDropArmed) return false;
    this.transferDropArmed = false;
    return true;
  }

  setStorageUsed(fraction: number): void {
    this.status.storageUsed = fraction;
    this.emit();
  }

  setBattery(percent: number): void {
    this.status.batteryPercent = percent;
    this.emit();
  }

  /**
   * Instantaneous position, as the real unit would report while the rider sits
   * on the bike. Values carry a little noise so the stability check is
   * genuinely exercised rather than fed a perfect constant.
   */
  readPosition(): PositionReading {
    const sag = this.options.sag ?? { front: 0.18, rear: 0.27 };
    const travel = this.options.travelMm ?? { front: 160, rear: 60 };
    const noise = this.options.unstableSag ? 6 : 0.4;
    const jitter = () => (Math.random() - 0.5) * noise;
    return {
      frontMm: Math.max(0, travel.front * sag.front + jitter()),
      rearMm: travel.rear === null ? null : Math.max(0, travel.rear * sag.rear + jitter()),
    };
  }
}
