/**
 * Post-build step for a static host without rewrite rules.
 *
 * GitHub Pages serves `404.html` for any path it cannot find on disk. Copying
 * the built shell there is what makes deep links such as `/Telemetry/app/run`
 * load the app instead of a "not found" page.
 *
 * `.nojekyll` stops Pages from running the output through Jekyll, which would
 * otherwise drop files and folders whose names begin with an underscore.
 */
import { copyFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dist = resolve(process.cwd(), 'dist');

copyFileSync(resolve(dist, 'index.html'), resolve(dist, '404.html'));
writeFileSync(resolve(dist, '.nojekyll'), '');

console.log('Pages: creati 404.html e .nojekyll in dist/');
