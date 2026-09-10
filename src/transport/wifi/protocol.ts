/**
 * Wi-Fi (HTTP) protocol map.
 *
 * FIRMWARE TBD — the paths and the JSON shapes below are the app's proposal,
 * not a frozen specification. They are deliberately plain REST over the local
 * network so the firmware side stays a small HTTP server on the acquisition
 * unit, and so the browser can use its own resume mechanism (`Range`) instead
 * of a hand-rolled chunking scheme.
 *
 * The unit is expected to be reachable either as its own access point that the
 * phone joins, or as a client on the same network as the phone.
 */

/**
 * Default address of the unit in access-point mode.
 *
 * 192.168.4.1 is the standard SoftAP gateway address used by the ESP32 SDK, so
 * it is a documented default rather than an invented one. It stays overridable
 * because a unit joined to a home network will be somewhere else entirely.
 */
export const DEFAULT_DEVICE_ORIGIN = 'http://192.168.4.1';

export const ROUTES = {
  info: '/api/info',
  status: '/api/status',
  startRun: '/api/run/start',
  stopRun: '/api/run/stop',
  calibrate: '/api/calibrate',
  /** Instantaneous suspension position, used by the static sag procedure. */
  position: '/api/position',
  sessions: '/api/sessions',
  /** GET for download (honours `Range`), DELETE to free the unit's storage. */
  session: (id: string) => `/api/sessions/${encodeURIComponent(id)}`,
} as const;

/** Milliseconds before a request to the unit is treated as unreachable. */
export const REQUEST_TIMEOUT_MS = 6000;

/** How often the app re-reads status while connected, in milliseconds. */
export const STATUS_POLL_MS = 2500;

/** Bytes requested per `Range` chunk during a session download. */
export const DOWNLOAD_CHUNK_BYTES = 64 * 1024;
