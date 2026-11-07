import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
const server = spawn('npx', ['vite', 'preview', '--port', '4188', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
  page.on('pageerror', (e) => console.error('[page]', e.message));
  page.on('console', (m) => m.type() === 'error' && console.error('[console]', m.text().slice(0, 300)));
  await page.goto(`http://localhost:4188/?shot&q=medium&ch=${process.argv[2]}`);
  await page.waitForFunction(() => window.__game?.ready, null, { timeout: 300000 });
  await new Promise((r) => setTimeout(r, 6000));
  const spots = await page.evaluate(() => window.__models.map((s) => [s.key, s.x, s.y ?? null, s.z, s.yaw ?? 0]));
  console.log(spots.length, JSON.stringify(spots.map((s) => s[0])));
  const want = (process.argv[3] ?? '').split(',').filter(Boolean), seen = new Set();
  let i = 0;
  for (const [key, x, y0, z, yaw] of spots) {
    if (seen.has(key) || (want.length && !want.includes(key))) continue;
    seen.add(key);
    const d = +(process.argv[4] ?? 9), fx = Math.sin(yaw + +(process.argv[5] ?? 0)), fz = Math.cos(yaw + +(process.argv[5] ?? 0));
    const y = y0 ?? 0;
    await page.evaluate(([a, b, c, e, f, g]) => window.__game.look(a, b, c, e, f, g), [x + fx * d + fz * 2, (y0 === null ? 0 : y) + 3, z + fz * d - fx * 2, x, (y0 === null ? 0 : y) + 1.5, z]);
    await page.screenshot({ path: `shots/_place_${process.argv[2]}_${i++}_${key}.png` });
  }
} finally { await browser.close(); server.kill(); }
