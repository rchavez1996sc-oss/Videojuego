import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const port = 4173;
const quality = process.argv[2] ?? 'medium';
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
  for (const i of [0, 1, 2, 3]) {
    await page.evaluate((v) => window.__game.setView(v), i);
    await page.screenshot({ path: `shots/view${i}.png`, timeout: 300000 });
    console.log(`shots/view${i}.png`);
  }
} finally {
  await browser.close();
  server.kill();
}
