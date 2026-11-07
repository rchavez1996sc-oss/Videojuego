import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

/** Small props from the Release (`referencias_adicionales`) unzipped into assets_src/props/<name>/ → public/assets/props/<key>.glb. */
const SRC = resolve('../assets_src/props'), OUT = resolve('public/assets/props');
const PLANS = [{ key: 'menuBoard', url: '/src-assets/welcome/source/SM_Welcome_Sign.fbx', height: 1.05 }];
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
  for (const p of PLANS) {
    const { data, info } = await page.evaluate(([u, h]) => window.prop(u, h), [p.url, p.height]);
    writeFileSync(join(OUT, `${p.key}.glb`), Buffer.from(data, 'base64'));
    console.log(p.key, info);
  }
} finally {
  await browser.close();
  server.kill();
}
