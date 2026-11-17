import type { Sfx } from './sfx';

/**
 * Air-raid style alarm for an ambush: two detuned saws through a band-pass whose pitch wails up and down (~5 s cycle),
 * echoed on the street bus, fading in over 2 s; returns a stop function (fades out over 3 s).
 */
export function siren(sfx: Sfx, seconds = 45): () => void {
  const { ctx, sfx: bus, street } = sfx.m, t = ctx.currentTime;
  const out = ctx.createGain(), band = ctx.createBiquadFilter(), lfo = ctx.createOscillator(), depth = ctx.createGain();
  band.type = 'bandpass';
  band.Q.value = 2.5;
  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(0.16, t + 2);
  out.gain.setTargetAtTime(0, t + seconds, 2);
  lfo.frequency.value = 0.19;
  depth.gain.value = 190;
  lfo.connect(depth);
  const oscs = [0, 7].map((cents) => {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 520;
    o.detune.value = cents;
    depth.connect(o.frequency);
    o.connect(band);
    o.start(t);
    return o;
  });
  band.frequency.value = 900;
  band.connect(out);
  out.connect(bus);
  out.connect(street);
  lfo.start(t);
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    const n = ctx.currentTime;
    out.gain.cancelScheduledValues(n);
    out.gain.setTargetAtTime(0, n, 1);
    [...oscs, lfo].forEach((o) => o.stop(n + 4));
  };
  const auto = setTimeout(stop, (seconds + 6) * 1000);
  return () => (clearTimeout(auto), stop());
}
