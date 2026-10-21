import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

// node scripts/walltest.mjs [spots] [seconds]: stress test against house fronts; reports wall crossings and camera-in-wall frames.
const server = spawn('npx', ['vite', 'preview', '--port', '4174', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  page.on('pageerror', (e) => console.error('[page]', e.message));
  await page.goto('http://localhost:4174/?shot&q=low');
  await page.waitForFunction(() => window.__game?.ready, null, { timeout: 180000 });
  await page.evaluate(() => window.__game.aiTest(-262, -4, 0.1, false));
  console.log(await page.evaluate(([n, s]) => window.__game.wallTest(n, s), [+(process.argv[2] ?? 12), +(process.argv[3] ?? 4)]));
} finally {
  await browser.close();
  server.kill();
}
