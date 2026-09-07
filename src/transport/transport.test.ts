import { describe, expect, it, vi } from 'vitest';
import {
  availableTransports,
  MockTelemetryDevice,
  MockTelemetryTransport,
  TransportError,
  createTransport,
  crc32,
  decodeSessionPayload,
  encodeSessionPayload,
  errorMessage,
} from './index';

const fast = () => MockTelemetryTransport.withOptions({ speed: 0 });

describe('codec di sessione', () => {
  const payload = {
    sessionId: 'sess-1',
    startedAt: '2025-01-01T10:00:00.000Z',
    sampleRateHz: 100,
    samples: [
      { t: 0, frontMm: 12.345, rearMm: 4.2 },
      { t: 10, frontMm: 15.5, rearMm: null },
    ],
  };

  it('fa il round-trip di una sessione', () => {
    const decoded = decodeSessionPayload(encodeSessionPayload(payload));
    expect(decoded.sessionId).toBe('sess-1');
    expect(decoded.sampleRateHz).toBe(100);
    // Samples are rounded to 0.01 mm, below sensor resolution.
    expect(decoded.samples[0].frontMm).toBeCloseTo(12.35, 2);
    expect(decoded.samples[1].rearMm).toBeNull();
  });

  it('rileva un payload corrotto tramite CRC', () => {
    const buffer = encodeSessionPayload(payload);
    const bytes = new Uint8Array(buffer);
    bytes[bytes.length - 5] ^= 0xff;
    expect(() => decodeSessionPayload(bytes.buffer)).toThrow(TransportError);
    expect(() => decodeSessionPayload(bytes.buffer)).toThrow(/CRC/);
  });

  it('rifiuta un buffer troppo corto', () => {
    expect(() => decodeSessionPayload(new ArrayBuffer(2))).toThrow(TransportError);
  });

  it('calcola un CRC32 stabile', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
});

describe('ciclo di vita del trasporto', () => {
  it('rifiuta i comandi finché non è connesso', async () => {
    const transport = fast();
    await expect(transport.listSessions()).rejects.toThrow(TransportError);
    await transport.connect();
    await expect(transport.listSessions()).resolves.toEqual([]);
  });

  it('espone info e stato del dispositivo dopo la connessione', async () => {
    const transport = fast();
    await transport.connect();
    const info = await transport.getDeviceInfo();
    const status = await transport.getStatus();
    expect(info.channels).toEqual(['front', 'rear']);
    expect(status.connected).toBe(true);
    expect(status.recording).toBe(false);
  });

  it('disconnette senza perdere le sessioni memorizzate sul dispositivo', async () => {
    const transport = fast();
    await transport.connect();
    await transport.startRun();
    await transport.stopRun();
    await transport.disconnect();
    await transport.connect();
    expect(await transport.listSessions()).toHaveLength(1);
  });

  it('notifica i cambi di stato, compreso il pulsante fisico', async () => {
    const device = new MockTelemetryDevice({ speed: 0, startCalibrated: true });
    const transport = new MockTelemetryTransport(device);
    await transport.connect();

    const listener = vi.fn();
    transport.onStatusChange(listener);
    device.pressPhysicalButton();
    await Promise.resolve();

    expect(listener).toHaveBeenCalled();
    expect(listener.mock.calls.at(-1)?.[0].recording).toBe(true);
  });

  it('non avvia una run se la memoria del dispositivo è piena', async () => {
    const transport = MockTelemetryTransport.withOptions({ speed: 0, storageUsed: 1 });
    await transport.connect();
    await expect(transport.startRun()).rejects.toMatchObject({ code: 'storage-full' });
  });

  it('non avvia una run con la batteria esaurita', async () => {
    const transport = MockTelemetryTransport.withOptions({ speed: 0, batteryPercent: 3 });
    await transport.connect();
    await expect(transport.startRun()).rejects.toMatchObject({ code: 'battery-low' });
  });
});

describe('calibrazione', () => {
  it('riesce e marca il dispositivo come calibrato', async () => {
    const transport = fast();
    await transport.connect();
    const result = await transport.calibrate();
    expect(result.ok).toBe(true);
    expect(result.channels).toHaveLength(2);
    expect((await transport.getStatus()).calibrated).toBe(true);
  });

  it('fallisce con movimento rilevato senza calibrare', async () => {
    const transport = MockTelemetryTransport.withOptions({ speed: 0, failCalibration: true });
    await transport.connect();
    const result = await transport.calibrate();
    expect(result.ok).toBe(false);
    expect(result.failure).toBe('movement-detected');
    expect((await transport.getStatus()).calibrated).toBe(false);
  });
});

describe('trasferimento di una sessione', () => {
  it('scarica a chunk riportando il progresso fino al totale', async () => {
    const transport = fast();
    await transport.connect();
    await transport.startRun();
    await transport.stopRun();
    const [session] = await transport.listSessions();

    const progress: number[] = [];
    const buffer = await transport.downloadSession(session.id, (p) =>
      progress.push(p.receivedBytes),
    );

    expect(progress.length).toBeGreaterThan(1);
    expect(progress.at(-1)).toBe(buffer.byteLength);
    // Progress is monotonic: a bar must never jump backwards.
    expect([...progress].sort((a, b) => a - b)).toEqual(progress);
    expect(decodeSessionPayload(buffer).samples.length).toBeGreaterThan(100);
  });

  it('riprende il trasferimento dopo una caduta di connessione', async () => {
    const transport = MockTelemetryTransport.withOptions({
      speed: 0,
      dropDuringTransfer: true,
      preloadedDatasetIds: ['normal_run'],
    });
    await transport.connect();
    const [session] = await transport.listSessions();

    const lost = vi.fn();
    transport.onConnectionLost(lost);

    // First attempt drops part-way through.
    await expect(transport.downloadSession(session.id)).rejects.toMatchObject({
      code: 'transfer-failed',
    });
    expect(lost).toHaveBeenCalled();

    // The run is still on the device, and the retry resumes where it stopped.
    await transport.connect();
    const resumed: number[] = [];
    const buffer = await transport.downloadSession(session.id, (p) => resumed.push(p.receivedBytes));

    // Resuming means the first reported offset is already past zero.
    expect(resumed[0]).toBeGreaterThan(0);
    expect(decodeSessionPayload(buffer).samples.length).toBeGreaterThan(100);
  });

  it('libera spazio quando una sessione viene cancellata dal dispositivo', async () => {
    const transport = MockTelemetryTransport.withOptions({
      speed: 0,
      preloadedDatasetIds: ['normal_run'],
    });
    await transport.connect();
    const before = (await transport.getStatus()).storageUsed;
    const [session] = await transport.listSessions();

    await transport.deleteSession(session.id);

    expect(await transport.listSessions()).toHaveLength(0);
    expect((await transport.getStatus()).storageUsed).toBeLessThan(before);
  });

  it('segnala una sessione inesistente come dato non leggibile', async () => {
    const transport = fast();
    await transport.connect();
    await expect(transport.downloadSession('non-esiste')).rejects.toMatchObject({
      code: 'corrupt-data',
    });
  });
});

describe('selezione del trasporto', () => {
  it('crea il trasporto simulato', () => {
    expect(createTransport('mock').kind).toBe('mock');
  });

  it('crea il trasporto Wi-Fi, che è il canale primario', () => {
    expect(createTransport('wifi').kind).toBe('wifi');
  });

  it('propone il Wi-Fi come opzione consigliata', () => {
    const options = availableTransports('http://192.168.4.1');
    expect(options[0].kind).toBe('wifi');
    expect(options[0].primary).toBe(true);
  });

  it('rifiuta esplicitamente i canali non ancora implementati', () => {
    expect(() => createTransport('usb')).toThrow(TransportError);
    expect(() => createTransport('usb')).toThrow(/non ancora implementato/);
  });

  it('traduce ogni codice di errore in un messaggio comprensibile', () => {
    const message = errorMessage('storage-full');
    expect(message.title).toMatch(/memoria/i);
    expect(message.body).toMatch(/scarica/i);
  });
});
