// Bakes the street-art weathering (blur mask, fade, flakes, drips) of every mural into murals/<key>.w.png, so the game only loads it (the canvas filters + pixel read-back stalled the first seconds of play).
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
const dir = new URL('..', import.meta.url).pathname, path = `${dir}public/assets/manifest.json`, manifest = JSON.parse(readFileSync(path, 'utf8'));
const server = spawn('npx', ['vite', 'preview', '--port', '4203', '--strictPort'], { stdio: 'ignore', cwd: dir });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 500 } });
  await page.goto('http://localhost:4203/?shot&q=low&ch=1');
  await page.waitForFunction(() => window.__bakeMural, null, { timeout: 400000 });
  for (const [key, m] of Object.entries(manifest.murals)) {
    const url = await page.evaluate((img) => window.__bakeMural(img), m.img), file = `murals/${key}.w.png`;
    writeFileSync(`${dir}public/assets/${file}`, Buffer.from(url.split(',')[1], 'base64'));
    m.baked = file;
    console.log(key);
  }
  writeFileSync(path, `${JSON.stringify(manifest, null, 1)}\n`);
} finally { await browser.close(); server.kill(); }
