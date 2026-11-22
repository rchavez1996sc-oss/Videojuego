// usage: node scripts/_probe.mjs <ch> x z dx dz len  -> collider hits at several heights with surface + size
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
const [ch, ...rest] = process.argv.slice(2);
const server = spawn('npx', ['vite', 'preview', '--port', '4210', '--strictPort'], { stdio: 'ignore', cwd: '/home/user/videojuego/client' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 400, height: 240 } });
  await page.goto(`http://localhost:4210/?shot&q=low&ch=${ch}`);
  await page.waitForFunction(() => window.__game?.ready, null, { timeout: 600000 });
  for (const s of JSON.parse(rest[0])) console.log(s.slice(0, 70), '→', String(await page.evaluate(s)).slice(0, 4000));
} finally { await browser.close(); server.kill(); }
