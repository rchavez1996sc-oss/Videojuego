import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
const server = spawn('npx', ['vite', 'preview', '--port', '4181', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 560 } });
  page.on('pageerror', (e) => console.error('[page]', e.message));
  page.on('console', (m) => m.type() === 'error' && console.error('[console]', m.text().slice(0, 300)));
  await page.goto(`http://localhost:4181/?shot&q=medium&ch=${process.argv[2] ?? 1}`);
  await page.waitForFunction(() => window.__game?.ready, null, { timeout: 300000 });
  const plan = [[['KeyW'], 2.2], [['KeyW', 'KeyA'], 0.35]];
  await page.evaluate(() => (window.__hits = []));
  console.log(await page.evaluate(([k, p]) => window.__game.driveTest(k, p), [process.argv[3] ?? 'sedan', plan]));
  console.log(await page.evaluate(() => window.__hits.join(' ')));
  await page.screenshot({ path: 'shots/_drive0.png', timeout: 300000 });
} finally { await browser.close(); server.kill(); }
