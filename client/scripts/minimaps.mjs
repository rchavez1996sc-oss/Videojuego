import { existsSync } from 'node:fs';
// Pre-renders each chapter's minimap street plan (public/assets/minimap/<id>.png) and records its level signature in the manifest.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { levelSigs } from './levelSig.mjs';

const dir = new URL('..', import.meta.url).pathname, sigs = levelSigs(dir);
const chapters = process.argv.slice(2).length ? process.argv.slice(2) : ['1', '2', '3', '4'];
const server = spawn('npx', ['vite', 'preview', '--port', '4198', '--strictPort'], { stdio: 'ignore', cwd: dir });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const path = `${dir}public/assets/manifest.json`, manifest = JSON.parse(readFileSync(path, 'utf8'));
try {
  for (const n of chapters) {
    const page = await browser.newPage({ viewport: { width: 900, height: 500 } });
    await page.goto(`http://localhost:4198/?shot&livemap&q=medium&ch=${n}`);
    await page.waitForFunction(() => window.__minimap, null, { timeout: 400000 });
    const id = `ch0${n}`, url = await page.evaluate(() => window.__minimap.map.toDataURL('image/png'));
    const file = `minimap/${id}.png`;
    writeFileSync(`${dir}public/assets/${file}`, Buffer.from(url.split(',')[1], 'base64'));
    (manifest.minimaps ??= {})[id] = { file, sig: sigs[id] };
    console.log(id, sigs[id]);
    await page.close();
  }
  writeFileSync(path, `${JSON.stringify(manifest, null, 1)}\n`);
} finally { await browser.close(); server.kill(); }
