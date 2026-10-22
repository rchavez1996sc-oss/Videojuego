// node scripts/atlas.mjs: renders the sign atlas (tools/atlas.html) to shots/atlas.png for review.
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const server = spawn('npx', ['vite', '--port', '4197', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 3500));
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('[page]', e.message));
  await page.goto('http://localhost:4197/tools/atlas.html');
  await page.waitForFunction(() => window.__atlas, null, { timeout: 60000 });
  writeFileSync('shots/atlas.png', Buffer.from((await page.evaluate(() => window.__atlas)).split(',')[1], 'base64'));
  console.log('ok');
} finally { await browser.close(); server.kill(); }
