/**
 * Build identity, for tying a tester's report to a specific build.
 *
 * The values are replaced at build time. Under Vitest no replacement happens,
 * so the fallbacks keep tests from crashing on an undefined global.
 */
export const BUILD_INFO = {
  version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0-dev',
  commit: typeof __BUILD_COMMIT__ === 'string' ? __BUILD_COMMIT__ : 'dev',
  date: typeof __BUILD_DATE__ === 'string' ? __BUILD_DATE__ : 'dev',
} as const;

/** Single string a tester can copy into a bug report. */
export function buildLabel(): string {
  return `v${BUILD_INFO.version} · ${BUILD_INFO.commit} · ${BUILD_INFO.date}`;
}
