import { afterEach, describe, expect, it, vi } from 'vitest';
import { TransportError } from '../core/types';
import { encodeSessionPayload, decodeSessionPayload } from '../protocol/codec';
import { WifiTelemetryTransport, wifiAvailability } from './WifiTelemetryTransport';

/**
 * The Wi-Fi transport is exercised against a stubbed `fetch` that behaves like
 * the acquisition unit's HTTP server, including `Range` support, so resume is
 * tested through the same mechanism the real device will use.
 */

const ORIGIN = 'http://192.168.4.1';

const INFO = {
  id: 'unit-1',
  name: 'MTBTelem',
  firmwareVersion: '1.0.0',
  hardwareRevision: 'rev-a',
  channels: ['front', 'rear'],
  sampleRateHz: 100,
};

const STATUS = {
  connected: true,
  batteryPercent: 80,
  charging: false,
  storageUsed: 0.2,
  recording: false,
  calibrated: true,
  sensors: { front: 'ok', rear: 'ok' },
  pendingSessions: 1,
};

const PAYLOAD = encodeSessionPayload({
  sessionId: 'sess-1',
  startedAt: '2025-01-01T10:00:00.000Z',
  sampleRateHz: 100,
  samples: Array.from({ length: 9000 }, (_, i) => ({ t: i * 10, frontMm: i % 60, rearMm: i % 25 })),
});

interface ServerOptions {
  /** Fail every download chunk at or beyond this byte offset, once. */
  cutAtByte?: number;
}

function stubDevice(options: ServerOptions = {}) {
  const body = new Uint8Array(PAYLOAD);
  let cutArmed = options.cutAtByte !== undefined;

  const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const path = String(url).replace(ORIGIN, '');
    const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200 });

    if (path === '/api/info') return json(INFO);
    if (path === '/api/status') return json(STATUS);
    if (path === '/api/run/start' || path === '/api/run/stop') return json({ ok: true });
    if (path === '/api/calibrate') {
      return json({ ok: true, at: '2025-01-01T10:00:00.000Z', channels: [] });
    }
    if (path === '/api/sessions') {
      return json([
        {
          id: 'sess-1',
          startedAt: '2025-01-01T10:00:00.000Z',
          durationSec: 4,
          sampleRateHz: 100,
          sizeBytes: body.length,
          channels: ['front', 'rear'],
        },
      ]);
    }

    if (path.startsWith('/api/sessions/')) {
      if (!path.endsWith('/sess-1')) return new Response(null, { status: 404 });
      if (init?.method === 'DELETE') return new Response(null, { status: 204 });

      const range = (init?.headers as Record<string, string> | undefined)?.Range ?? '';
      const [, fromRaw, toRaw] = range.match(/bytes=(\d+)-(\d+)/) ?? [];
      const from = Number(fromRaw ?? 0);
      const to = Math.min(body.length - 1, Number(toRaw ?? body.length - 1));

      if (cutArmed && from > 0) {
        cutArmed = false;
        throw new TypeError('Failed to fetch');
      }

      const slice = body.subarray(from, to + 1);
      return new Response(slice, {
        status: 206,
        headers: { 'Content-Range': `bytes ${from}-${to}/${body.length}` },
      });
    }

    return new Response(null, { status: 404 });
  });

  vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('disponibilità del canale Wi-Fi', () => {
  it('è utilizzabile da una pagina servita in HTTP', () => {
    expect(wifiAvailability(ORIGIN).usable).toBe(true);
  });

  it('rileva il blocco del contenuto misto da una pagina HTTPS', () => {
    const original = window.location;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...original, protocol: 'https:' },
    });
    expect(wifiAvailability(ORIGIN)).toEqual({ usable: false, reason: 'mixed-content' });
    Object.defineProperty(window, 'location', { writable: true, value: original });
  });

  it('non blocca il loopback, che è esente dalla regola', () => {
    const original = window.location;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...original, protocol: 'https:' },
    });
    expect(wifiAvailability('http://localhost:8080').usable).toBe(true);
    Object.defineProperty(window, 'location', { writable: true, value: original });
  });
});

describe('comandi sul dispositivo via Wi-Fi', () => {
  it('si collega leggendo le informazioni e lo stato del dispositivo', async () => {
    const fetchMock = stubDevice();
    const transport = new WifiTelemetryTransport(ORIGIN);
    await transport.connect();

    expect(fetchMock).toHaveBeenCalledWith(`${ORIGIN}/api/info`, expect.anything());
    expect((await transport.getStatus()).connected).toBe(true);
    expect((await transport.getDeviceInfo()).name).toBe('MTBTelem');
    await transport.disconnect();
  });

  it('avvia e ferma la registrazione con una POST', async () => {
    const fetchMock = stubDevice();
    const transport = new WifiTelemetryTransport(ORIGIN);
    await transport.connect();
    await transport.startRun();
    await transport.stopRun();

    const posted = fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST');
    expect(posted.map(([url]) => String(url))).toEqual(
      expect.arrayContaining([`${ORIGIN}/api/run/start`, `${ORIGIN}/api/run/stop`]),
    );
    await transport.disconnect();
  });

  it('segnala un dispositivo irraggiungibile invece di un errore tecnico', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }) as unknown as typeof fetch,
    );
    const transport = new WifiTelemetryTransport(ORIGIN);
    await expect(transport.connect()).rejects.toMatchObject({ code: 'device-not-found' });
  });

  it('traduce la memoria piena del dispositivo nel codice corretto', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 507 })) as unknown as typeof fetch,
    );
    const transport = new WifiTelemetryTransport(ORIGIN);
    await expect(transport.connect()).rejects.toMatchObject({ code: 'storage-full' });
  });
});

describe('trasferimento di una sessione via Wi-Fi', () => {
  it('scarica la sessione completa riportando il progresso', async () => {
    stubDevice();
    const transport = new WifiTelemetryTransport(ORIGIN);
    await transport.connect();

    const progress: number[] = [];
    const buffer = await transport.downloadSession('sess-1', (p) => progress.push(p.receivedBytes));

    expect(buffer.byteLength).toBe(PAYLOAD.byteLength);
    expect(progress.at(-1)).toBe(PAYLOAD.byteLength);
    expect([...progress].sort((a, b) => a - b)).toEqual(progress);
    // The payload survives the round trip intact, CRC included.
    expect(decodeSessionPayload(buffer).samples).toHaveLength(9000);
    await transport.disconnect();
  });

  it('riprende il trasferimento dopo una caduta di rete', async () => {
    stubDevice({ cutAtByte: 1 });
    const transport = new WifiTelemetryTransport(ORIGIN);
    await transport.connect();

    await expect(transport.downloadSession('sess-1')).rejects.toMatchObject({
      code: 'transfer-failed',
    });

    // The unit still holds the run, so a retry succeeds and the data is intact.
    const resumed: number[] = [];
    const buffer = await transport.downloadSession('sess-1', (p) => resumed.push(p.receivedBytes));

    // Resuming, not restarting: the retry picks up past what the first attempt
    // already pulled instead of asking for the whole session again.
    expect(resumed[0]).toBeGreaterThan(0);
    expect(decodeSessionPayload(buffer).samples).toHaveLength(9000);
    await transport.disconnect();
  });

  it('libera la memoria del dispositivo con una DELETE', async () => {
    const fetchMock = stubDevice();
    const transport = new WifiTelemetryTransport(ORIGIN);
    await transport.connect();
    await transport.deleteSession('sess-1');

    expect(fetchMock).toHaveBeenCalledWith(
      `${ORIGIN}/api/sessions/sess-1`,
      expect.objectContaining({ method: 'DELETE' }),
    );
    await transport.disconnect();
  });

  it('non lascia timer attivi dopo la disconnessione', async () => {
    stubDevice();
    const transport = new WifiTelemetryTransport(ORIGIN);
    await transport.connect();
    await transport.disconnect();
    // A leaked poll timer would keep firing requests at a device we left.
    const before = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(before);
  });
});

describe('errori del trasporto Wi-Fi', () => {
  it('usa il vocabolario di errori condiviso', async () => {
    stubDevice();
    const transport = new WifiTelemetryTransport(ORIGIN);
    await transport.connect();
    await expect(transport.downloadSession('mancante')).rejects.toBeInstanceOf(TransportError);
    await transport.disconnect();
  });
});
