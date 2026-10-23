import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
const server = spawn('npx', ['vite', 'preview', '--port', '4182', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const out = '/tmp/claude-0/-home-user-videojuego/5de3f231-c9e5-5c3b-8c65-ca7b4cf34251/scratchpad/';
const VIEWS = {
  1: [[-120, 2.2, 6, -100, 1.6, -4], [-60, 8, -100, -40, 4, -120]],
  2: [[-20, 2, 45, 10, 1, 60], [60, 2, -64, 80, 2, -75]],
};
try {
  for (const ch of process.argv.slice(2)) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.setDefaultTimeout(900000);
    page.on('pageerror', (e) => console.error('[page]', e.message));
    await page.goto(`http://localhost:4182/?shot&q=high&ch=${ch}`);
    await page.waitForFunction(() => window.__game?.ready, null, { timeout: 300000 });
    for (const [k, v] of VIEWS[ch].entries()) {
      await page.evaluate((a) => { const g = window.__game; for (let i = 0; i < 10; i++) g.look(a[0], a[1], a[2], a[3], a[4], a[5]); }, v);
      await page.evaluate(() => document.querySelectorAll('#hud, #minimap, #objective, .stats').forEach((e) => (e.style.display = 'none')));
      await page.screenshot({ path: `${out}${process.env.TAG ?? 't'}${ch}_${k}.png` });
    }
    await page.close();
  }
} finally { await browser.close(); server.kill(); }
