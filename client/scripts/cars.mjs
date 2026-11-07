import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

/**
 * Car packs (Release assets-v1: generic-passenger-car-pack.zip unzipped into assets_src/cars/, low-poly-cars.zip: its source/cars.zip
 * contents and textures into assets_src/cars2/) → public/assets/cars/cars.glb.
 */
const SRC = resolve('../assets_src/cars'), SRC2 = resolve('../assets_src/cars2'), OUT = resolve('public/assets/cars');
const PLANS = JSON.parse(readFileSync(resolve('scripts/cars.plan.json'), 'utf8'));
const PLANS2 = [{ body: 'car1', key: 'lowA', flip: true }, { body: 'car2', key: 'lowB', flip: true }, { body: 'car3', key: 'lowC' }, { body: 'car4', key: 'lowD', flip: true }];
mkdirSync(OUT, { recursive: true });
const server = spawn('npx', ['vite', '--port', '4179', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 4000));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('[page]', e.message));
  await page.route('**/src-assets2/**', (route) => {
    const file = join(SRC2, decodeURIComponent(new URL(route.request().url()).pathname.replace('/src-assets2/', '')));
    route.fulfill(existsSync(file) ? { status: 200, body: readFileSync(file) } : { status: 404, body: '' });
  });
  await page.route('**/src-assets/**', (route) => {
    const file = join(SRC, decodeURIComponent(new URL(route.request().url()).pathname.replace('/src-assets/', '')));
    route.fulfill(existsSync(file) ? { status: 200, body: readFileSync(file) } : { status: 404, body: '' });
  });
  await page.goto('http://localhost:4179/tools/cars.html');
  await page.waitForFunction(() => window.ready, null, { timeout: 60000 });
  const { data, info, previews } = await page.evaluate((p) => window.convert('/src-assets/source/fab.fbx', '/src-assets/textures', p[0], '/src-assets2/cars.fbx', '/src-assets2', p[1]), [PLANS, PLANS2]);
  const raw = join(OUT, 'cars.raw.glb');
  writeFileSync(raw, Buffer.from(data, 'base64'));
  execFileSync('npx', ['gltfpack', '-i', raw, '-o', join(OUT, 'cars.glb'), '-cc', '-kn', '-km', '-vtf'], { stdio: 'pipe' });
  execFileSync('rm', [raw]);
  if (process.argv.includes('--previews')) previews.forEach((p, i) => writeFileSync(`shots/_carprev${i}.jpg`, Buffer.from(p.split(',')[1], 'base64')));
  console.log(info.join('\n'), `\n${(statSync(join(OUT, 'cars.glb')).size / 1e6).toFixed(2)}MB`);
} finally {
  await browser.close();
  server.kill();
}
