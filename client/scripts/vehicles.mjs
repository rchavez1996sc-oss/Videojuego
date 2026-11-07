import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

/**
 * Vehicle models from Sketchfab (Release assets-v1: retro-van, bus, japanese-bus-nagoya-city-bus-aichi,
 * low-poly-autorickshaw-aka-tuktuk, 1968-volkswagen-beetle; each zip unzipped into assets_src/veh/<name>/, inner
 * source zips too) → public/assets/cars/vehicles.glb. Bases for combis, micros, mototaxis and the beetle.
 */
const SRC = resolve('../assets_src/veh'), OUT = resolve('public/assets/cars');
const V = '/veh';
const PLANS = [
  { key: 'van', len: 4.8, url: `${V}/retro-van/source/Retro van SF.glb`, drop: '^Text|Smoke|^Number|Logo', paint: '^Paint_body$', mode: 'full' },
  { key: 'ussr', len: 9, url: `${V}/bus/source/bus_low_end2.fbx`, drop: '^pPlane', paint: 'bus_ussr', mode: 'full', tex: { bus_ussr: `${V}/bus/textures/bus_ussr1_Base_Color.png` } },
  { key: 'nagoya', len: 9, url: `${V}/japanese-bus-nagoya-city-bus-aichi/source/nagoyacitybus.fbx`, paint: 'Nagoya', mode: 'full', rotY: Math.PI / 2, tex: { Nagoya: `${V}/japanese-bus-nagoya-city-bus-aichi/textures/nagoyacity.png` } },
  { key: 'tuktuk', len: 2.7, url: `${V}/low-poly-autorickshaw-aka-tuktuk/source/auto Rickshaw.obj`, paint: '^body$', mode: 'full', tex: { '^(body|tyre|cloth)$': `${V}/low-poly-autorickshaw-aka-tuktuk/textures/Material.001-Colour_copy_2.png` } },
  { key: 'beetle', len: 4.05, url: `${V}/1968-volkswagen-beetle/source/FINAL_MODEL_68.fbx`, paint: 'Beetle_1968_Base$|Beetle_1968_Base1', mode: 'full', tex: { Details_EXT: `${V}/1968-volkswagen-beetle/textures/TEX_Details_EXT_D.png`, Details_MAT: `${V}/1968-volkswagen-beetle/textures/TEX_Details_MAT_D.png`, Tire_Disk: `${V}/1968-volkswagen-beetle/textures/TEX_Tire_Disk_D.png` } },
];
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
mkdirSync(OUT, { recursive: true });
const server = spawn('npx', ['vite', '--port', '4177', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 4000));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('[page]', e.message));
  await page.route('**/veh/**', (route) => {
    const file = join(SRC, decodeURIComponent(new URL(route.request().url()).pathname.replace('/veh/', '')));
    route.fulfill(existsSync(file) ? { status: 200, body: readFileSync(file) } : { status: 404, body: '' });
  });
  await page.goto('http://localhost:4177/tools/vehicles.html');
  await page.waitForFunction(() => window.ready, null, { timeout: 60000 });
  const plans = only.length ? PLANS.filter((p) => only.includes(p.key)) : PLANS;
  const { data, info, previews } = await page.evaluate((p) => window.convert(p), plans);
  previews.forEach((p, i) => writeFileSync(`shots/_veh_${plans[i].key}.jpg`, Buffer.from(p.split(',')[1], 'base64')));
  console.log(info.join('\n'));
  if (!only.length) {
    const raw = join(OUT, 'vehicles.raw.glb');
    writeFileSync(raw, Buffer.from(data, 'base64'));
    execFileSync('npx', ['gltfpack', '-i', raw, '-o', join(OUT, 'vehicles.glb'), '-cc', '-kn', '-km', '-vtf', '-si', '0.6'], { stdio: 'pipe' });
    execFileSync('rm', [raw]);
    console.log(`${(statSync(join(OUT, 'vehicles.glb')).size / 1e6).toFixed(2)}MB`);
  }
} finally {
  await browser.close();
  server.kill();
}
