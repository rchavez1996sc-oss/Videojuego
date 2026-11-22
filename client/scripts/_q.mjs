import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
const server = spawn('npx', ['vite', 'preview', '--port', '4209', '--strictPort'], { stdio: 'ignore', cwd: '/home/user/videojuego/client' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 400, height: 240 } });
  page.on('pageerror', (e) => console.error('[page]', e.message));
  page.on('console', (m) => process.env.CONS && console.log('[c]', m.text().slice(0, 300)));
  await page.goto(`http://localhost:4209/?shot&q=low&ch=${process.argv[2]}`);
  await page.waitForFunction(() => window.__game?.ready, null, { timeout: 600000 });
  for (const s of JSON.parse(process.argv[3])) console.log(s.slice(0, 60), '→', String(await page.evaluate(s)).slice(0, 4000));
} finally { await browser.close(); server.kill(); }
