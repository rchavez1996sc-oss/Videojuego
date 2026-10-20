import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const server = spawn('npx', ['vite', 'preview', '--port', '4175', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.error('[page]', e.message));
  page.on('console', (m) => m.type() === 'log' && console.log('[log]', m.text()));
  await page.goto('http://localhost:4175/?shot&q=low');
  await page.waitForFunction(() => window.__game?.ready, null, { timeout: 180000 });
  console.log(await page.evaluate(() => window.__game.grenadeTest(-57, -17)));
  await page.evaluate(() => window.__game.simulate(1, 0, 0.1));
  await page.screenshot({ path: 'shots/grenade.png', timeout: 300000 });
} finally {
  await browser.close();
  server.kill();
}
