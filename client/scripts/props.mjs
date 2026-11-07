import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

/** Small props from the Release (`referencias_adicionales`) unzipped into assets_src/props/<name>/ → public/assets/props/<key>.glb. */
const SRC = resolve('../assets_src/props'), OUT = resolve('public/assets/props');
const PLANS = [{ key: 'menuBoard', url: '/src-assets/welcome/source/SM_Welcome_Sign.fbx', height: 1.05 }];
const only = process.argv.slice(2);
const KITS = [{ key: 'stall', url: '/src-assets/tacos/Tacos.dae', tex: '/src-assets/tacos/Textures/', anchor: '^Taco_stand', reach: 1.5, drop: 'Taco[s.]|^Taco$|Tortilla|shepherd|Sign|OXXO|building|brick|Cable|pole|Tree|^Light|Traffic|road|Sidewalk|Parking|Grass|Plants|Fence|phone|doors', dropMat: '^Sodas$' }].filter((k) => !only.length || only.includes(k.key));
mkdirSync(OUT, { recursive: true });
const server = spawn('npx', ['vite', '--port', '4177', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 4000));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('[page]', e.message));
  await page.route('**/src-assets/**', (route) => {
    const file = join(SRC, decodeURIComponent(new URL(route.request().url()).pathname.replace('/src-assets/', '')));
    route.fulfill(existsSync(file) ? { status: 200, body: readFileSync(file) } : { status: 404, body: '' });
  });
  await page.goto('http://localhost:4177/tools/props.html');
  await page.waitForFunction(() => window.ready, null, { timeout: 60000 });
  for (const k of KITS) {
    const { data, info, preview } = await page.evaluate((k) => window.kit(k.url, k.tex, k.anchor, k.reach, k.drop, k.dropMat), k);
    const raw = join(OUT, `${k.key}.raw.glb`);
    writeFileSync(raw, Buffer.from(data, 'base64'));
    execFileSync('npx', ['gltfpack', '-i', raw, '-o', join(OUT, `${k.key}.glb`), '-noq'], { stdio: 'pipe' });
    execFileSync('rm', [raw]);
    writeFileSync(`shots/_kit_${k.key}.jpg`, Buffer.from(preview.split(',')[1], 'base64'));
    console.log(k.key, info);
  }
  for (const p of only.length ? [] : PLANS) {
    const { data, info } = await page.evaluate(([u, h]) => window.prop(u, h), [p.url, p.height]);
    writeFileSync(join(OUT, `${p.key}.glb`), Buffer.from(data, 'base64'));
    console.log(p.key, info);
  }
} finally {
  await browser.close();
  server.kill();
}
