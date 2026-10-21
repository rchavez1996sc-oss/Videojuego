// node scripts/plates.mjs: renders the prologue plates (tools/plates.html) to shots/plate*.jpg for review.
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const server = spawn('npx', ['vite', '--port', '4189', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 3500));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  page.on('pageerror', (e) => console.error('[page]', e.message));
  page.on('console', (m) => m.type() !== 'log' && console.error('[console]', m.text().slice(0, 300)));
  await page.goto('http://localhost:4189/tools/plates.html');
  await page.waitForFunction(() => window.__done || window.__err, null, { timeout: 400000, polling: 1000 });
  const err = await page.evaluate(() => window.__err);
  if (err) console.log('ERR', err);
  const urls = await page.evaluate(() => window.__plates);
  urls.forEach((u, i) => u && writeFileSync(`shots/plate${i}.jpg`, Buffer.from(u.split(',')[1], 'base64')));
  console.log('ok', urls.length);
} finally { await browser.close(); server.kill(); }
