// node scripts/_shot2.mjs <ch> '<js before>' '[[view]...]' out-prefix
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
const [ch, pre, views, prefix] = process.argv.slice(2);
const server = spawn('npx', ['vite', 'preview', '--port', '4212', '--strictPort'], { stdio: 'ignore', cwd: '/home/user/videojuego/client' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
  page.on('pageerror', (e) => console.error('[page]', e.message));
  await page.goto(`http://localhost:4212/?shot&q=medium&ch=${ch}${process.env.URLX ?? ""}`);
  await page.waitForFunction(() => window.__game?.ready, null, { timeout: 600000 });
  console.log(String(await page.evaluate(pre)).slice(0, 1500));
  let i = 0;
  for (const v of JSON.parse(views)) {
    for (let k = 0; k < 8; k++) { await page.evaluate((v) => window.__game.setView(v), v); await new Promise((r) => setTimeout(r, 400)); }
    await page.screenshot({ path: `${prefix}${i++}.png`, timeout: 240000 });
  }
} finally { await browser.close(); server.kill(); }
