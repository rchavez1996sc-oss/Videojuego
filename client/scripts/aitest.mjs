import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const server = spawn('npx', ['vite', 'preview', '--port', '4174', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  page.on('pageerror', (e) => console.error('[page]', e.message));
  await page.goto('http://localhost:4174/?shot&q=low');
  await page.waitForFunction(() => window.__game?.ready, null, { timeout: 180000 });
  const [x, z, secs, fire] = process.argv.slice(2);
  console.log(await page.evaluate(([x, z, s, f]) => window.__game.aiTest(+x, +z, +s, f === '1' ? true : f === '0' ? false : +f), [x ?? '-70', z ?? '-10', secs ?? '20', fire ?? '1']));
  if (process.argv[6]) {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.evaluate(() => window.__game.simulate(2, 0, -0.05));
    await page.screenshot({ path: process.argv[6], timeout: 300000 });
  }
} finally {
  await browser.close();
  server.kill();
}
