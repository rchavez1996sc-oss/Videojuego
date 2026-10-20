import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const port = 4173;
const quality = process.argv[2] ?? 'medium';
const only = process.argv[3];
mkdirSync('shots', { recursive: true });
const server = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (m) => m.type() === 'error' && console.error('[page]', m.text()));
  page.on('pageerror', (e) => console.error('[page]', e.message));
  await page.goto(`http://localhost:${port}/?shot&q=${quality}`);
  await page.waitForFunction(() => window.__game?.ready, null, { timeout: 180000 });
  const nViews = await page.evaluate(() => window.__game.views());
  for (const i of only === 'combat' ? [] : [...Array(nViews).keys()]) {
    await page.evaluate((v) => window.__game.setView(v), i);
    await page.screenshot({ path: `shots/view${i}.png`, timeout: 300000 });
    console.log(`shots/view${i}.png`, JSON.stringify(await page.evaluate(() => window.__game.info())));
  }
  await page.evaluate(() => window.__game.simulate(21, 4, -0.32));
  await page.screenshot({ path: 'shots/combat.png', timeout: 300000 });
  console.log('shots/combat.png', JSON.stringify(await page.evaluate(() => window.__game.info())));
} finally {
  await browser.close();
  server.kill();
}
