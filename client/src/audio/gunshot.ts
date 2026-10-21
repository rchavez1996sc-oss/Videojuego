/**
 * Pre-rendered rifle reports: supersonic crack, saturated muzzle blast, low boom, action clatter and a short tail.
 * A few seeded variants are built once so every shot is cheap (one buffer source) yet not identical.
 */
export function buildGunshots(ctx: BaseAudioContext, variants: number, heavy = false): AudioBuffer[] {
  const sr = ctx.sampleRate, len = Math.floor(sr * 0.7);
  const out: AudioBuffer[] = [];
  for (let v = 0; v < variants; v++) {
    const buf = ctx.createBuffer(2, len, sr);
    const L = buf.getChannelData(0), R = buf.getChannelData(1);
    const lp = (fc: number) => 1 - Math.exp((-2 * Math.PI * fc) / sr);
    const aBlast = lp(heavy ? 900 : 1500 + v * 120), aTail = lp(520), aMech = lp(3800);
    let blast = 0, tail = 0, mech = 0, mechHp = 0, phase = 0;
    const f0 = (heavy ? 95 : 125) * (0.94 + v * 0.04), boomT = heavy ? 0.14 : 0.09;
    const clank = 0.028 + v * 0.003;
    for (let i = 0; i < len; i++) {
      const t = i / sr, n = Math.random() * 2 - 1;
      const crack = (t < 0.0005 ? 1 : t < 0.0011 ? -0.85 : 0) + n * Math.exp(-t / 0.0011) * 0.9;
      blast += aBlast * (n - blast);
      tail += aTail * (n - tail);
      phase += (2 * Math.PI * (f0 * Math.exp(-t / 0.05) + 42)) / sr;
      const boom = Math.sin(phase) * Math.exp(-t / boomT);
      const dt = t - clank;
      mech += aMech * (n - mech);
      mechHp = n - mech;
      const action = dt > 0 ? mechHp * Math.exp(-dt / 0.006) * 0.22 + (dt > 0.03 ? mechHp * Math.exp(-(dt - 0.03) / 0.004) * 0.12 : 0) : 0;
      const x = crack * 1.1 + blast * Math.exp(-t / 0.032) * 3.2 + boom * (heavy ? 1.2 : 0.9) + tail * Math.exp(-t / 0.22) * 0.9 + action;
      const y = Math.tanh(x * 1.6) * 0.85;
      const w = tail * Math.exp(-t / 0.3) * 0.25;
      L[i] = y + w;
      R[i] = y - w;
    }
    out.push(buf);
  }
  return out;
}
