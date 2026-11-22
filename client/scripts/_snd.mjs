import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
const out = process.argv[2];
const server = spawn('npx', ['vite', '--port', '4211', '--strictPort'], { stdio: 'ignore', cwd: '/home/user/videojuego/client' });
await new Promise((r) => setTimeout(r, 4000));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('[page]', e.message));
  await page.goto('http://localhost:4211/scripts/blank.html').catch(() => {});
  const res = await page.evaluate(async () => {
    const crash = await import('/src/audio/crashSound.ts'), brk = await import('/src/audio/breakSound.ts'), car = await import('/src/audio/carNoise.ts');
    const make = (secs) => {
      const ctx = new OfflineAudioContext(1, 44100 * secs, 44100);
      Object.defineProperty(ctx, 'state', { value: 'running' });
      const buf = ctx.createBuffer(1, 44100 * 2, 44100), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const sfx = ctx.createGain(), street = ctx.createGain();
      sfx.connect(ctx.destination); street.gain.value = 0.3; street.connect(ctx.destination);
      const m = { ctx, sfx, street, noise() { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; return s; },
        env(t, peak, a, dd) { const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dd); return g; } };
      return { ctx, m };
    };
    const cases = {
      crash_soft: (m) => crash.crashSound(m, 0, 0.3), crash_hard: (m) => crash.crashSound(m, 0, 1),
      knock: (m) => car.knock(m, 0, 0.6), post: (m) => brk.snapSound(m, 'post', 0.6), rail: (m) => brk.snapSound(m, 'rail', 0.6), tree: (m) => brk.snapSound(m, 'tree', 0.8),
      scrape: (m) => { const s = new car.Scrape(m); s.set(9); },
    };
    const out = {};
    for (const [k, f] of Object.entries(cases)) {
      const { ctx, m } = make(2.2);
      f(m);
      const b = await ctx.startRendering(), x = b.getChannelData(0);
      let peak = 0, sum = 0, clip = 0, zc = 0;
      for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); peak = Math.max(peak, a); sum += x[i] * x[i]; if (a > 1) clip++; if (i && (x[i] > 0) !== (x[i - 1] > 0)) zc++; }
      const pcm = new Int16Array(x.length), sc = 0.9 / Math.max(peak, 1e-6);
      for (let i = 0; i < x.length; i++) pcm[i] = Math.max(-32767, Math.min(32767, x[i] * sc * 32767));
      out[k] = { peak: +peak.toFixed(2), rms: +Math.sqrt(sum / x.length).toFixed(3), clip, zcHz: Math.round(zc / 2 / 2.2), pcm: Array.from(pcm) };
    }
    return out;
  });
  for (const [k, v] of Object.entries(res)) {
    const pcm = Int16Array.from(v.pcm), hdr = Buffer.alloc(44);
    hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + pcm.length * 2, 4); hdr.write('WAVEfmt ', 8); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(1, 22);
    hdr.writeUInt32LE(44100, 24); hdr.writeUInt32LE(88200, 28); hdr.writeUInt16LE(2, 32); hdr.writeUInt16LE(16, 34); hdr.write('data', 36); hdr.writeUInt32LE(pcm.length * 2, 40);
    writeFileSync(`${out}/${k}.wav`, Buffer.concat([hdr, Buffer.from(pcm.buffer)]));
    console.log(k, 'peak', v.peak, 'rms', v.rms, 'clip', v.clip, 'zcHz', v.zcHz);
  }
} finally { await browser.close(); server.kill(); }
