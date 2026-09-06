import type { RawSample } from '@/types';
import { TransportError } from '../transport/types';

/**
 * Session payload codec.
 *
 * FIRMWARE TBD: this is the app's own container format, used by the mock
 * transport and by the BLE transport until the firmware's on-wire session
 * format is frozen. It is intentionally trivial to replace: only
 * `encodeSessionPayload` / `decodeSessionPayload` know the layout.
 *
 * Layout: [4-byte little-endian CRC32] [UTF-8 JSON body]
 */

export interface SessionPayload {
  sessionId: string;
  startedAt: string;
  sampleRateHz: number;
  /** Millimetres of travel, already normalised by the device or the adapter. */
  samples: RawSample[];
}

/** CRC-32 (IEEE), used for the integrity check after a chunked transfer. */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function encodeSessionPayload(payload: SessionPayload): ArrayBuffer {
  // Samples are rounded to 0.01 mm: below sensor resolution, and it keeps the
  // payload small enough to move over a BLE link in reasonable time.
  const body = new TextEncoder().encode(
    JSON.stringify({
      ...payload,
      samples: payload.samples.map((s) => ({
        t: s.t,
        f: Math.round(s.frontMm * 100) / 100,
        r: s.rearMm === null ? null : Math.round(s.rearMm * 100) / 100,
      })),
    }),
  );
  const out = new Uint8Array(4 + body.length);
  new DataView(out.buffer).setUint32(0, crc32(body), true);
  out.set(body, 4);
  return out.buffer;
}

export function decodeSessionPayload(buffer: ArrayBuffer): SessionPayload {
  if (buffer.byteLength < 5) {
    throw new TransportError('corrupt-data', 'Payload troppo corto');
  }
  const bytes = new Uint8Array(buffer);
  const expected = new DataView(buffer).getUint32(0, true);
  const body = bytes.subarray(4);
  if (crc32(body) !== expected) {
    throw new TransportError('corrupt-data', 'CRC non corrispondente');
  }

  let parsed: {
    sessionId: string;
    startedAt: string;
    sampleRateHz: number;
    samples: Array<{ t: number; f: number; r: number | null }>;
  };
  try {
    parsed = JSON.parse(new TextDecoder().decode(body));
  } catch (cause) {
    throw new TransportError('corrupt-data', 'JSON non valido', cause);
  }

  return {
    sessionId: parsed.sessionId,
    startedAt: parsed.startedAt,
    sampleRateHz: parsed.sampleRateHz,
    samples: parsed.samples.map((s) => ({ t: s.t, frontMm: s.f, rearMm: s.r })),
  };
}
