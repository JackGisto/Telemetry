import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Build identity, stamped in at build time and shown in Settings.
 *
 * Without it a tester's report cannot be tied to a specific build, which makes
 * feedback across several test rounds impossible to interpret.
 */
function buildInfo() {
  const { version } = JSON.parse(readFileSync('./package.json', 'utf8')) as { version: string };
  let commit = 'sconosciuto';
  try {
    // GitHub Actions provides the sha directly; locally we ask git.
    commit = (process.env.GITHUB_SHA ?? execSync('git rev-parse HEAD').toString()).trim().slice(0, 7);
  } catch {
    // A build from a tarball has no git metadata, which is not an error.
  }
  return { version, commit, date: new Date().toISOString().slice(0, 10) };
}

/**
 * `BASE_PATH` lets the same build serve from a subpath, which is what a project
 * page on GitHub Pages needs (`/Telemetry/`). It defaults to the root so local
 * development and any root-domain hosting are unaffected.
 */
const build = buildInfo();

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  define: {
    __APP_VERSION__: JSON.stringify(build.version),
    __BUILD_COMMIT__: JSON.stringify(build.commit),
    __BUILD_DATE__: JSON.stringify(build.date),
  },
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
