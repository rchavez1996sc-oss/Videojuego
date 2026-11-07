import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
const server = spawn('npx', ['vite', 'preview', '--port', '4191', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 560 } });
  page.on('pageerror', (e) => console.error('[page]', e.message));
  page.on('console', (m) => m.type() === 'error' && console.error('[console]', m.text().slice(0, 400)));
  await page.goto(`http://localhost:4191/?shot&q=medium&ch=${process.argv[2] ?? 1}`);
  await page.waitForFunction(() => window.__game?.ready, null, { timeout: 300000 });
  await new Promise((r) => setTimeout(r, 4000));
  const views = JSON.parse(process.argv[3]);
  for (const [i, v] of views.entries()) {
    await page.evaluate((v) => window.__game.look(...v), v);
    await page.screenshot({ path: `shots/_wall${i}.png` });
  }
  console.log(await page.evaluate(() => JSON.stringify(window.__game.programs?.() ?? '')));
} finally { await browser.close(); server.kill(); }
