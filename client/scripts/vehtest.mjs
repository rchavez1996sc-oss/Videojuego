import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
const server = spawn('npx', ['vite', 'preview', '--port', '4178', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.error('[page]', e.message));
  await page.goto('http://localhost:4178/?shot&q=low');
  await page.waitForFunction(() => window.__game?.ready, null, { timeout: 180000 });
  await page.evaluate(() => window.__game.aiTest(-215, -7.5, 1, false));
  console.log(await page.evaluate(() => window.__game.vehicleTest()));
  await page.evaluate(() => window.__game.look(-206, 3.2, 1, -213, 1.2, 6.3));
  await page.screenshot({ path: 'shots/vehicle.png', timeout: 300000 });
} finally {
  await browser.close();
  server.kill();
}
