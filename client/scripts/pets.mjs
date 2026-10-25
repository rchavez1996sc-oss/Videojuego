import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

/** Stray dog and cat (Release assets-v1: dog-animated.zip, cat.zip unzipped into assets_src/pets/{dog,cat}/) → public/assets/pets/. */
const SRC = resolve('../assets_src/pets'), OUT = resolve('public/assets/pets');
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
  await page.goto('http://localhost:4177/tools/pets.html');
  await page.waitForFunction(() => window.ready, null, { timeout: 60000 });
  const { data, info } = await page.evaluate(() => window.dog('/src-assets/dog/source/dog-animated.fbx', '/src-assets/dog/textures/textures_(2).png', '/src-assets/dog/textures/textures_(1).png', 0.0048, { walk: [0, 1.333], idle: [1.4, 5.37] }));
  const raw = join(OUT, 'dog.raw.glb');
  writeFileSync(raw, Buffer.from(data, 'base64'));
  execFileSync('npx', ['gltfpack', '-i', raw, '-o', join(OUT, 'dog.glb'), '-cc', '-kn', '-km', '-vtf', '-af', '30'], { stdio: 'pipe' });
  execFileSync('rm', [raw]);
  copyFileSync(join(SRC, 'cat/source/Cat.glb'), join(OUT, 'cat.glb'));
  console.log('dog', info, `${(statSync(join(OUT, 'dog.glb')).size / 1e6).toFixed(2)}MB`, '| cat', `${(statSync(join(OUT, 'cat.glb')).size / 1e6).toFixed(2)}MB`);
} finally {
  await browser.close();
  server.kill();
}
