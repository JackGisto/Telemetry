import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 430, height: 1200 } });
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
await p.goto('file:///home/user/Telemetry/preview-artifact.html');
await p.waitForTimeout(1200);
await p.getByRole('link', { name: /apri l’app/i }).first().click();
await p.getByRole('button', { name: /iniziamo/i }).click();
await p.getByRole('button', { name: /continua senza account/i }).click();
await p.getByRole('button', { name: /salta per ora/i }).click();
for (let i = 0; i < 3; i++) await p.getByRole('button', { name: /continua/i }).click();
await p.getByRole('button', { name: /salva bici/i }).click();
await p.waitForTimeout(700);

await p.getByRole('link', { name: /^run$/i }).click();
await p.getByRole('button', { name: /^collega$/i }).last().click();
await p.waitForTimeout(1200);
await p.getByRole('button', { name: /^calibra$/i }).click();
await p.waitForTimeout(2500);
// The mock cycles datasets; the first is a clean run with no advice, so record
// twice to reach one that actually needs a change.
for (let i = 0; i < 2; i++) {
  await p.getByRole('button', { name: /start run/i }).click();
  await p.waitForTimeout(700);
  await p.getByRole('button', { name: /stop run/i }).click();
  await p.waitForTimeout(1000);
}
const downloads = await p.getByRole('button', { name: /scarica dati/i }).all();
for (const button of downloads.reverse()) {
  await button.click();
  await p.waitForTimeout(2500);
  const hasAction = await p.getByRole('button', { name: /ho fatto questa modifica/i }).count();
  if (hasAction > 0) break;
  await p.getByRole('link', { name: /^run$/i }).click();
  await p.waitForTimeout(800);
}
await p.waitForTimeout(600);
await p.screenshot({ path: '/tmp/a-action.png' });

await p.getByRole('button', { name: /come si fa/i }).click();
await p.waitForTimeout(500);
await p.getByText(/cosa dovresti sentire/i).scrollIntoViewIfNeeded();
await p.waitForTimeout(300);
await p.screenshot({ path: '/tmp/a-howto.png' });
console.log('ERRORS:', errs.length ? errs.slice(0,3) : 'none');
await b.close();
