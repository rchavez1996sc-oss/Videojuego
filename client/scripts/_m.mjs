import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
const server = spawn('npx', ['vite', 'preview', '--port', '4174', '--strictPort'], { stdio: 'ignore', cwd: process.cwd() });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.on('pageerror', (e) => console.error('[page]', e.message));
  page.on('console', (m) => m.type() === 'error' && console.error('[page]', m.text()));
  await page.goto('http://localhost:4174/?shot&q=low&ch=' + process.argv[4]);
  await page.waitForFunction(() => window.__game?.ready, null, { timeout: 180000 });
  const shots = JSON.parse(process.argv[2]);
  for (const [i, v] of shots.entries()) {
    await page.evaluate(() => window.__game.simulate(4, 0));
    await page.screenshot({ path: `${process.argv[3]}/c${i}.png`, timeout: 300000 });
    console.log(i, JSON.stringify(await page.evaluate(() => window.__game.info())));
  }
} finally { await browser.close(); server.kill(); }
