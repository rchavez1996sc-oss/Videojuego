import type { Mixer } from './mixer';

/** Formants (F1, F2, F3 in Hz) of Spanish vowels, plus a neutral voiced sound for l, m, n, r, b, d, g, y… */
const VOWEL: Record<string, [number, number, number]> = {
  a: [730, 1150, 2450], e: [480, 1850, 2500], i: [290, 2250, 3000], o: [520, 900, 2400], u: [320, 800, 2250], _: [420, 1350, 2400],
};
const HISS = new Set(['s', 'z', 'c', 'f', 'j']);
const STOP = new Set(['t', 'k', 'p', 'q']);

/** Street calls: combi touts (jaladores) and vendors' cries. Shouted, so pitch rises through each word and the last vowel is drawn out. */
export const TOUT = ['huaycan huaycan', 'sube sube sube', 'santa anita', 'al fondo hay sitio', 'chosica chosica', 'vitarte vitarte', 'sube nomas'];
export const CRIES = ['heladooos', 'emolienteee', 'tamaleees', 'agua agua', 'papa rellenaaa', 'chicha moradaaa', 'canchita canchita'];

/**
 * A voice synthesised from formants — no recordings: a buzzy glottal source (sawtooth) through three band-pass
 * filters that glide from vowel to vowel, hiss for s/j, a click for t/k/p, a hum for the other consonants. Heard
 * from 10–60 m through the street it reads as someone shouting, not as speech.
 */
export function shout(m: Mixer, text: string, distance: number, pan: number, female: boolean): void {
  const { ctx } = m, t0 = ctx.currentTime + distance / 343 + 0.02;
  const out = ctx.createGain(), p = ctx.createStereoPanner(), lp = ctx.createBiquadFilter();
  out.gain.value = Math.min(0.5, 0.9 / (1 + distance / 9));
  p.pan.value = Math.max(-1, Math.min(1, pan));
  lp.type = 'lowpass';
  lp.frequency.value = Math.max(1200, 6000 / (1 + distance / 25));
  out.connect(lp).connect(p).connect(m.sfx);
  const src = ctx.createOscillator(), voiced = ctx.createGain();
  src.type = 'sawtooth';
  voiced.gain.value = 0;
  src.connect(voiced);
  const formants = [0, 1, 2].map((k) => {
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'bandpass';
    f.Q.value = [6, 9, 11][k];
    g.gain.value = [1, 0.55, 0.25][k];
    voiced.connect(f).connect(g).connect(out);
    return f;
  });
  const base = (female ? 230 : 150) * (0.92 + Math.random() * 0.16);
  let t = t0;
  const words = text.split(' ');
  words.forEach((w, wi) => {
    const last = wi === words.length - 1, letters = [...w];
    letters.forEach((ch, li) => {
      const rise = 1 + (li / letters.length) * 0.35 - (last && li > letters.length - 3 ? 0.25 : 0);
      if (HISS.has(ch) || STOP.has(ch)) {
        const n = m.noise(), f = ctx.createBiquadFilter(), d = HISS.has(ch) ? 0.09 : 0.025, e = m.env(t, HISS.has(ch) ? 0.35 : 0.6, 0.005, d);
        f.type = 'bandpass';
        f.frequency.value = HISS.has(ch) ? 5200 : 1800;
        f.Q.value = 1.2;
        n.connect(f).connect(e).connect(out);
        n.start(t);
        n.stop(t + d + 0.05);
        voiced.gain.setTargetAtTime(0, t, 0.01);
        t += d;
        return;
      }
      const v = VOWEL[ch] ?? VOWEL._, isVowel = ch in VOWEL && ch !== '_';
      const held = isVowel && letters[li + 1] === ch ? 0.12 : 0;
      const d = (isVowel ? 0.11 : 0.05) + held + (last && li === letters.length - 1 ? 0.28 : 0);
      formants.forEach((f, k) => f.frequency.setTargetAtTime(v[k] * (female ? 1.15 : 1), t, 0.015));
      src.frequency.setTargetAtTime(base * rise, t, 0.03);
      voiced.gain.setTargetAtTime(isVowel ? 0.9 : 0.35, t, 0.012);
      t += d;
    });
    voiced.gain.setTargetAtTime(0, t, 0.02);
    t += 0.07;
  });
  src.start(t0);
  src.stop(t + 0.3);
}
