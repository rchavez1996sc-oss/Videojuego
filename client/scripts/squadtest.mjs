import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

// node scripts/squadtest.mjs x z chunks [walkToX walkToZ]: teleports the player, runs 2 s chunks (shooting), prints squad state.
const server = spawn('npx', ['vite', 'preview', '--port', '4174', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  page.on('pageerror', (e) => console.error('[page]', e.message));
  await page.goto('http://localhost:4174/?shot&q=low');
  await page.waitForFunction(() => window.__game?.ready, null, { timeout: 180000 });
  const [x, z, n] = process.argv.slice(2).map(Number);
  console.log(await page.evaluate(([x, z]) => window.__game.aiTest(x, z, 0.1, false) && window.__game.squadInfo(), [x, z]));
  for (let i = 0; i < n; i++) {
    const log = await page.evaluate(([x, z, i]) => window.__game.aiTest(x, z, 2, i % 2 === 0), [x, z, i]);
    console.log(log.split('\n')[0].slice(0, 60), '\n  ', await page.evaluate(() => window.__game.squadInfo()));
  }
} finally {
  await browser.close();
  server.kill();
}
