/**
 * Pre-rendered explosions (a few seeded variants), layered like a field recording of a grenade in a street:
 * - the shock front: a hard N-wave crack with a burst of broadband noise,
 * - the fireball "whump": noise through a low-pass that closes from ~3 kHz to ~150 Hz,
 * - a sub thump that drops in pitch, lightly saturated,
 * - a long rolling rumble (brown noise, slow amplitude wobble),
 * - debris: fragments and grit pattering down for two seconds, with a few heavier thuds,
 * - slap-back echoes off the facades (delayed, darker copies, different per ear).
 */
export function buildExplosions(ctx: BaseAudioContext, variants: number, first = 0): AudioBuffer[] {
  const sr = ctx.sampleRate, len = Math.floor(sr * 5), out: AudioBuffer[] = [];
  const lp = (fc: number) => 1 - Math.exp((-2 * Math.PI * fc) / sr);
  for (let v = first; v < first + variants; v++) {
    const dry = new Float32Array(len), pat = new Float32Array(len);
    let fb = 0, fb2 = 0, brown = 0, rum = 0, phase = 0, wob = 0, wobT = 0;
    const f0 = 46 + v * 5, rumbleT = 1.4 + v * 0.25;
    for (let i = 0; i < len; i++) {
      const t = i / sr, n = Math.random() * 2 - 1;
      const crack = (t < 0.0008 ? 1 : t < 0.0022 ? -0.8 : 0) + n * Math.exp(-t / 0.004) * 1.2;
      const a = lp(150 + 2900 * Math.exp(-t / 0.09));
      fb += a * (n - fb);
      fb2 += a * (fb - fb2);
      const whump = fb2 * (1 - Math.exp(-t / 0.004)) * Math.exp(-t / 0.32) * 4.2;
      phase += (2 * Math.PI * (f0 * Math.exp(-t / 0.5) + 24)) / sr;
      const sub = Math.sin(phase) * (1 - Math.exp(-t / 0.006)) * Math.exp(-t / 0.85) * 1.5;
      brown = (brown + n * 0.02) * 0.998;
      rum += lp(130) * (brown - rum);
      if ((wobT -= 1 / sr) <= 0) (wobT = 0.08 + Math.random() * 0.2), (wob = 0.6 + Math.random() * 0.8);
      const rumble = rum * 5 * (1 - Math.exp(-t / 0.06)) * Math.exp(-t / rumbleT) * wob;
      dry[i] = crack * 1.3 + whump + sub + rumble;
    }
    for (let k = 0; k < 90; k++) {
      const t0 = 0.25 + Math.pow(Math.random(), 1.6) * 2.3, s = Math.floor(t0 * sr), heavy = Math.random() < 0.12;
      const amp = (heavy ? 0.35 : 0.08 + Math.random() * 0.12) * Math.exp(-(t0 - 0.25) / 1.6), dec = heavy ? 0.03 : 0.004 + Math.random() * 0.01;
      let f = 0;
      for (let j = 0; j < sr * dec * 6 && s + j < len; j++) {
        const n = Math.random() * 2 - 1;
        f += lp(heavy ? 300 : 2500 + Math.random() * 3000) * (n - f);
        pat[s + j] += (heavy ? f : n - f) * amp * Math.exp(-j / (sr * dec));
      }
    }
    const buf = ctx.createBuffer(2, len, sr);
    const L = buf.getChannelData(0), R = buf.getChannelData(1);
    const echoes = [[0.19 + v * 0.02, 0.32, 0.08], [0.43, 0.24, -0.05], [0.88, 0.14, 0.11], [1.5, 0.08, -0.09]];
    let el = 0, er = 0;
    for (let i = 0; i < len; i++) {
      let wl = 0, wr = 0;
      for (const [d, g, skew] of echoes) {
        const jl = i - Math.floor((d - skew * 0.1) * sr), jr = i - Math.floor((d + skew * 0.1) * sr);
        if (jl > 0) wl += dry[jl] * g * (1 + skew);
        if (jr > 0) wr += dry[jr] * g * (1 - skew);
      }
      el += lp(900) * (wl - el);
      er += lp(900) * (wr - er);
      const p = pat[i];
      L[i] = Math.tanh((dry[i] + el + p * 0.9) * 0.32) * 0.95;
      R[i] = Math.tanh((dry[i] + er + p * 1.1) * 0.32) * 0.95;
    }
    out.push(buf);
  }
  return out;
}
