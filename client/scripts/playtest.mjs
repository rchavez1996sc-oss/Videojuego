import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
const [ch, runs = '1', secs = '120', chunk = '60'] = process.argv.slice(2);
const port = 4190 + Number(ch);
const server = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  for (let r = 0; r < Number(runs); r++) {
    const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
    const errs = [];
    page.on('pageerror', (e) => errs.push('[pageerror] ' + e.message));
    page.on('console', (m) => m.type() === 'error' && errs.push('[console] ' + m.text().slice(0, 200)));
    const t0 = Date.now();
    await page.goto(`http://localhost:${port}/?test&ch=${ch}&q=low&d=normal`);
    await page.waitForFunction(() => window.__game?.ready, null, { timeout: 400000 });
    console.log(`=== ch${ch} run ${r + 1} loaded in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    for (let s = 0; s < Number(secs); s += Number(chunk)) {
      const out = await page.evaluate((n) => window.__game.bot(n), Number(chunk));
      console.log(out.split('\n').map((l) => `  [${s}+] ${l}`).join('\n'));
    }
    if (errs.length) console.log('  ERRORS:\n   ' + [...new Set(errs)].slice(0, 15).join('\n   '));
    await page.close();
  }
} finally { await browser.close(); server.kill(); }
