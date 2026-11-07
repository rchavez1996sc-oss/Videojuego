import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

/**
 * Static models from the Release (`referencias_adicionales`, unzipped into assets_src/models/<key>/) → one glb per
 * key in public/assets/models/, normalised (base at y 0, centred, metres), textures ≤ 1024 px, simplified with
 * gltfpack (`si`). Plans in scripts/models.plan.json. `node scripts/models.mjs [key…]`; previews in shots/_m_<key>.jpg.
 */
const SRC = resolve('../assets_src/models'), OUT = resolve('public/assets/models');
const only = process.argv.slice(2);
const plans = JSON.parse(readFileSync('scripts/models.plan.json', 'utf8')).filter((p) => !only.length || only.includes(p.key));
mkdirSync(OUT, { recursive: true });
const server = spawn('npx', ['vite', '--port', '4178', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 4000));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('[page]', e.message));
  await page.route('**/src-models/**', (route) => {
    const file = join(SRC, decodeURIComponent(new URL(route.request().url()).pathname.replace('/src-models/', '')));
    route.fulfill(existsSync(file) ? { status: 200, body: readFileSync(file) } : { status: 404, body: '' });
  });
  await page.goto('http://localhost:4178/tools/models.html');
  await page.waitForFunction(() => window.ready, null, { timeout: 60000 });
  for (const p of plans) {
    const plan = { ...p, url: `/src-models/${p.url}`, tex: p.tex && `/src-models/${p.tex}`, texDir: p.texDir && `/src-models/${p.texDir}`, maps: p.maps && Object.fromEntries(Object.entries(p.maps).map(([k, v]) => [k, `/src-models/${v}`])) };
    if (p.flat) {
      mkdirSync(resolve('public/assets/murals'), { recursive: true });
      const { png, aspect } = await page.evaluate((q) => window.flatten(q), { ...plan, front: p.flat, cut: p.cut });
      writeFileSync(resolve(`public/assets/murals/${p.key}.png`), Buffer.from(png.split(',')[1], 'base64'));
      console.log(`${p.key}: mural aspect ${aspect.toFixed(2)}`);
      continue;
    }
    try {
      const { data, info, preview } = await page.evaluate((q) => window.convert(q), plan);
      writeFileSync(`shots/_m_${p.key}.jpg`, Buffer.from(preview.split(',')[1], 'base64'));
      const raw = join(OUT, `${p.key}.raw.glb`), out = join(OUT, `${p.key}.glb`);
      writeFileSync(raw, Buffer.from(data, 'base64'));
      execFileSync('npx', ['gltfpack', '-i', raw, '-o', out, '-noq', '-si', String(p.si ?? 1)], { stdio: 'pipe' });
      execFileSync('rm', [raw]);
      console.log(`${p.key}: ${info} → ${(statSync(out).size / 1e6).toFixed(2)} MB`);
    } catch (e) { console.log(`${p.key}: FAILED ${String(e).slice(0, 200)}`); }
  }
} finally {
  await browser.close();
  server.kill();
}
