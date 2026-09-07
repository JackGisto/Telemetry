import type {
  CalibrationResult,
  DeviceInfo,
  DeviceStatus,
  SessionInfo,
  TransferProgress,
  TransportKind,
} from '@/types';
import { TransportError, type TelemetryTransport } from '../core/types';
import {
  DEFAULT_DEVICE_ORIGIN,
  DOWNLOAD_CHUNK_BYTES,
  REQUEST_TIMEOUT_MS,
  ROUTES,
  STATUS_POLL_MS,
} from './protocol';

/**
 * Wi-Fi transport: the app talks to the acquisition unit over plain HTTP on the
 * local network.
 *
 * Two things make this the better primary channel over Bluetooth. It works on
 * every browser, including Safari on iOS where Web Bluetooth simply does not
 * exist; and a session download becomes an ordinary HTTP GET, so resuming after
 * a drop uses the `Range` header the browser and every HTTP server already
 * implement, instead of a bespoke chunking protocol.
 *
 * HTTP has no server push, so status changes — including the unit's own
 * Start/Stop button — are picked up by polling rather than notifications.
 */
export class WifiTelemetryTransport implements TelemetryTransport {
  readonly kind: TransportKind = 'wifi';

  private statusListeners = new Set<(s: DeviceStatus) => void>();
  private connectionLostListeners = new Set<() => void>();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastStatus: DeviceStatus | null = null;
  /**
   * Chunks already received per session. A dropped transfer keeps what it got,
   * so the retry asks the unit only for the bytes that are actually missing.
   */
  private partial = new Map<string, Uint8Array[]>();

  constructor(private origin: string = DEFAULT_DEVICE_ORIGIN) {}

  async connect(): Promise<void> {
    const availability = wifiAvailability(this.origin);
    if (!availability.usable) {
      throw new TransportError(
        availability.reason === 'mixed-content' ? 'not-supported' : 'device-not-found',
        availability.reason,
      );
    }

    // There is no pairing step over Wi-Fi: reaching /api/info *is* connecting.
    await this.request(ROUTES.info);
    await this.refreshStatus();
    this.startPolling();
  }

  async disconnect(): Promise<void> {
    this.stopPolling();
    this.lastStatus = null;
  }

  async getDeviceInfo(): Promise<DeviceInfo> {
    return (await this.request(ROUTES.info)).json() as Promise<DeviceInfo>;
  }

  async getStatus(): Promise<DeviceStatus> {
    if (this.lastStatus) return this.lastStatus;
    return this.refreshStatus();
  }

  async startRun(): Promise<void> {
    await this.request(ROUTES.startRun, { method: 'POST' });
    await this.refreshStatus();
  }

  async stopRun(): Promise<void> {
    await this.request(ROUTES.stopRun, { method: 'POST' });
    await this.refreshStatus();
  }

  async calibrate(): Promise<CalibrationResult> {
    const response = await this.request(ROUTES.calibrate, {
      method: 'POST',
      // Calibration holds the sensors still for a couple of seconds, so it needs
      // more headroom than an ordinary request.
      timeoutMs: REQUEST_TIMEOUT_MS * 3,
    });
    const result = (await response.json()) as CalibrationResult;
    await this.refreshStatus();
    return result;
  }

  async listSessions(): Promise<SessionInfo[]> {
    return (await this.request(ROUTES.sessions)).json() as Promise<SessionInfo[]>;
  }

  /**
   * Download one session, resuming from the last byte already received.
   *
   * The unit is asked for one `Range` window at a time so progress is reported
   * as it arrives and an interrupted transfer leaves a usable offset behind.
   */
  async downloadSession(
    id: string,
    onProgress?: (p: TransferProgress) => void,
  ): Promise<ArrayBuffer> {
    // Resume: whatever a previous attempt managed to pull is kept and only the
    // remaining bytes are requested.
    const chunks: Uint8Array[] = this.partial.get(id) ?? [];
    this.partial.set(id, chunks);
    let offset = chunks.reduce((n, c) => n + c.length, 0);
    let total = 0;
    let chunkIndex = chunks.length;

    try {
      do {
        const end = offset + DOWNLOAD_CHUNK_BYTES - 1;
        const response = await this.request(ROUTES.session(id), {
          headers: { Range: `bytes=${offset}-${end}` },
        });

        total = parseTotalBytes(response) ?? total;
        const buffer = new Uint8Array(await response.arrayBuffer());
        if (buffer.length === 0) break;

        chunks.push(buffer);
        offset += buffer.length;
        chunkIndex += 1;
        onProgress?.({ sessionId: id, receivedBytes: offset, totalBytes: total, chunkIndex });
      } while (total === 0 || offset < total);
    } catch (cause) {
      // The unit still holds the run, so this is recoverable, not data loss.
      if (cause instanceof TransportError && cause.code === 'device-not-found') {
        throw new TransportError('transfer-failed', 'Trasferimento interrotto', cause);
      }
      throw cause;
    }

    const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
    let cursor = 0;
    for (const chunk of chunks) {
      out.set(chunk, cursor);
      cursor += chunk.length;
    }
    if (total > 0 && out.length < total) {
      throw new TransportError('transfer-failed', 'Trasferimento incompleto');
    }

    this.partial.delete(id);
    return out.buffer;
  }

  async deleteSession(id: string): Promise<void> {
    await this.request(ROUTES.session(id), { method: 'DELETE' });
  }

  onStatusChange(listener: (status: DeviceStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  onConnectionLost(listener: () => void): () => void {
    this.connectionLostListeners.add(listener);
    return () => this.connectionLostListeners.delete(listener);
  }

  private async refreshStatus(): Promise<DeviceStatus> {
    const status = (await (await this.request(ROUTES.status)).json()) as DeviceStatus;
    this.lastStatus = { ...status, connected: true };
    for (const listener of this.statusListeners) listener(this.lastStatus);
    return this.lastStatus;
  }

  /** HTTP cannot push, so the unit's own button is seen by polling. */
  private startPolling(): void {
    this.stopPolling();
    this.pollTimer = setInterval(() => {
      void this.refreshStatus().catch(() => {
        this.stopPolling();
        this.lastStatus = null;
        for (const listener of this.connectionLostListeners) listener();
      });
    }, STATUS_POLL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer !== null) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  private async request(
    path: string,
    options: RequestInit & { timeoutMs?: number } = {},
  ): Promise<Response> {
    const { timeoutMs = REQUEST_TIMEOUT_MS, ...init } = options;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${this.origin}${path}`, { ...init, signal: controller.signal });
    } catch (cause) {
      // A browser gives no detail here: an unreachable unit, a wrong network and
      // a blocked request all surface as the same generic failure.
      throw new TransportError('device-not-found', `Nessuna risposta da ${this.origin}`, cause);
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) throw errorForStatus(response.status);
    return response;
  }
}

/** Maps the unit's HTTP status codes onto the app's error vocabulary. */
function errorForStatus(status: number): TransportError {
  if (status === 404) return new TransportError('corrupt-data', 'Risorsa non trovata sul dispositivo');
  if (status === 409) return new TransportError('device-busy');
  if (status === 507) return new TransportError('storage-full');
  return new TransportError('connection-lost', `Il dispositivo ha risposto ${status}`);
}

/** Total size from `Content-Range`, falling back to `Content-Length`. */
function parseTotalBytes(response: Response): number | null {
  const contentRange = response.headers.get('Content-Range');
  const match = contentRange?.match(/\/(\d+)\s*$/);
  if (match) return Number(match[1]);
  const length = response.headers.get('Content-Length');
  // Without a range header a plain Content-Length is only the total when the
  // server ignored the Range request and sent the whole body.
  return response.status === 200 && length ? Number(length) : null;
}

export interface WifiAvailability {
  usable: boolean;
  reason?: 'mixed-content';
}

/**
 * Honest capability check.
 *
 * A page served over HTTPS is not allowed to call a plain-HTTP address, and the
 * unit on the local network has no certificate. This is the one real constraint
 * of the Wi-Fi channel and the app states it rather than failing silently at
 * the first request.
 */
export function wifiAvailability(origin: string = DEFAULT_DEVICE_ORIGIN): WifiAvailability {
  if (typeof window === 'undefined') return { usable: true };
  const pageIsSecure = window.location.protocol === 'https:';
  const deviceIsPlain = origin.startsWith('http://');
  // Loopback is exempt from the mixed-content rule in every current browser.
  const isLoopback = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/.test(origin);
  if (pageIsSecure && deviceIsPlain && !isLoopback) return { usable: false, reason: 'mixed-content' };
  return { usable: true };
}
