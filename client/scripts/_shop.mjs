import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
const server = spawn('npx', ['vite', 'preview', '--port', '4184', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 620 } });
  page.on('pageerror', (e) => console.error('[page]', e.message));
  await page.goto(`http://localhost:4184/?shot&q=${process.argv[2] ?? 'medium'}&ch=1`);
  await page.waitForFunction(() => window.__game?.ready, null, { timeout: 300000 });
  const views = JSON.parse(process.argv[3]);
  for (const [i, v] of views.entries()) {
    await page.evaluate((v) => window.__game.look(...v), v);
    await page.evaluate(() => window.__game.look && null);
    await page.screenshot({ path: `shots/_shop${i}.png`, timeout: 300000 });
  }
} finally { await browser.close(); server.kill(); }
