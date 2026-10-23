import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
const server = spawn('npx', ['vite', 'preview', '--port', '4185', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const goals = { 1: [204, -12 + 8.5], 2: [111, 313.5] };
try {
  for (const ch of ['1', '2']) for (let k = 0; k < 3; k++) {
    const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
    page.setDefaultTimeout(900000);
    await page.goto(`http://localhost:4185/?q=low&ch=${ch}`);
    await page.waitForSelector('#launcher .go');
    await page.click('#launcher .go');
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__game?.ready, null, { timeout: 600000 });
    const p = (await page.evaluate(() => window.__game.info())).pos;
    console.log('ch', ch, 'start', p, 'dist', Math.round(Math.hypot(p[0] - goals[ch][0], p[2] - goals[ch][1])));
    await page.close();
  }
} finally { await browser.close(); server.kill(); }
