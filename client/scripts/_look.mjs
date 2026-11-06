import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
// node scripts/_look.mjs ch "x,y,z,lx,ly,lz" ... -> shots/_lookN.png
const server = spawn('npx', ['vite', 'preview', '--port', '4176', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.error('[page]', e.message));
  page.on('console', (m) => m.type() === 'error' && console.error('[console]', m.text().slice(0, 200)));
  await page.goto(`http://localhost:4176/?shot&q=medium&ch=${process.argv[2]}`);
  await page.waitForFunction(() => window.__game?.ready, null, { timeout: 300000 });
  await page.addStyleTag({ content: 'body *:not(canvas){visibility:hidden!important} canvas{visibility:visible!important}' });
  const views = process.argv.slice(3);
  for (const [i, v] of views.entries()) {
    const a = v.split(',').map(Number);
    await page.evaluate((a) => window.__game.look(...a), a);
    await page.screenshot({ path: `shots/_look${i}.png`, timeout: 300000 });
  }
} finally { await browser.close(); server.kill(); }
