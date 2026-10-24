/**
 * Orchestral stingers for the end of a mission, synthesised on the spot: a brass section (detuned saws through a
 * swelling filter), strings and an "ah" choir pad, timpani, cymbals and a tam-tam, all into a concert-hall reverb.
 */
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

class Orchestra {
  readonly t0: number;
  private dry: GainNode;
  private wet: GainNode;
  private noise: AudioBuffer;
  private out: GainNode;

  constructor(volume: number, readonly ctx: BaseAudioContext) {
    this.t0 = ctx.currentTime + 0.05;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    const out = (this.out = ctx.createGain());
    out.gain.value = volume;
    out.connect(comp).connect(ctx.destination);
    this.dry = ctx.createGain();
    this.dry.connect(out);
    const hall = ctx.createConvolver();
    hall.buffer = this.impulse(1.8);
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.55;
    this.wet.connect(hall).connect(out);
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  private impulse(seconds: number): AudioBuffer {
    const { ctx } = this, len = Math.floor(ctx.sampleRate * seconds), buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4) * (i < ctx.sampleRate * 0.02 ? i / (ctx.sampleRate * 0.02) : 1);
    }
    return buf;
  }

  private send(node: AudioNode, wet = 1): void {
    node.connect(this.dry);
    const s = this.ctx.createGain();
    s.gain.value = wet;
    node.connect(s).connect(this.wet);
  }

  private env(at: number, attack: number, hold: number, release: number, peak: number): GainNode {
    const g = this.ctx.createGain(), t = this.t0 + at;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
    return g;
  }

  /** Brass section note: the filter opens with the attack ("blat") and a slow vibrato sets in. */
  brass(at: number, midi: number, dur: number, vel = 1): void {
    const { ctx } = this, t = this.t0 + at, f = hz(midi);
    const g = this.env(at, 0.05, dur, 0.5, 0.11 * vel), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 1.2;
    lp.frequency.setValueAtTime(f * 1.5, t);
    lp.frequency.exponentialRampToValueAtTime(Math.min(9000, f * (6 + 6 * vel)), t + 0.07);
    lp.frequency.exponentialRampToValueAtTime(Math.min(6000, f * 4.5), t + 0.4);
    const vib = ctx.createOscillator(), depth = ctx.createGain();
    vib.frequency.value = 5.2;
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(7, t + 0.5);
    vib.connect(depth);
    for (const det of [-9, 0, 8]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = det;
      depth.connect(o.detune);
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.6);
    }
    vib.start(t);
    vib.stop(t + dur + 0.6);
    lp.connect(g);
    this.send(g, 0.8);
  }

  /** Strings and an "ah" choir under the brass: slow swell, formant-filtered saws. */
  pad(at: number, notes: number[], dur: number, vel = 1): void {
    const { ctx } = this, t = this.t0 + at;
    const g = this.env(at, 0.35, dur, 1.4, 0.05 * vel), mix = ctx.createGain();
    for (const [f, q, k] of [[730, 6, 1], [1150, 7, 0.6], [2500, 8, 0.3], [400, 1, 0.8]]) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f;
      bp.Q.value = q;
      const kg = ctx.createGain();
      kg.gain.value = k;
      mix.connect(bp).connect(kg).connect(g);
    }
    for (const n of notes) for (const det of [-12, 11]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = hz(n);
      o.detune.value = det;
      o.connect(mix);
      o.start(t);
      o.stop(t + dur + 1.8);
    }
    this.send(g, 1.3);
  }

  timpani(at: number, midi: number, vel = 1): void {
    const { ctx } = this, t = this.t0 + at, f = hz(midi);
    const o = ctx.createOscillator(), g = this.env(at, 0.004, 0, 1.3, 0.55 * vel);
    o.frequency.setValueAtTime(f * 1.4, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
    o.connect(g);
    o.start(t);
    o.stop(t + 1.4);
    this.send(g, 0.6);
    this.hiss(at, 'bandpass', 180, 0.25 * vel, 0.002, 0.25, 0.5);
  }

  /** Timpani roll that swells from soft to `vel` over `dur`. */
  roll(at: number, midi: number, dur: number, vel = 1): void {
    for (let x = 0; x < dur; x += 0.065) this.timpani(at + x, midi, 0.15 + vel * 0.7 * (x / dur));
  }

  hiss(at: number, type: BiquadFilterType, freq: number, peak: number, attack: number, release: number, wet = 1, q = 0.7): void {
    const { ctx } = this, t = this.t0 + at, src = ctx.createBufferSource(), f = ctx.createBiquadFilter();
    src.buffer = this.noise;
    src.loop = true;
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.env(at, attack, 0, release, peak);
    src.connect(f).connect(g);
    src.start(t);
    src.stop(t + attack + release + 0.1);
    this.send(g, wet);
  }

  cymbal(at: number, vel = 1, swell = 0): void {
    if (swell) this.hiss(at - swell, 'highpass', 6000, 0.22 * vel, swell, 0.15);
    this.hiss(at, 'highpass', 5200, 0.3 * vel, 0.004, 1.5);
    this.hiss(at, 'bandpass', 3000, 0.12 * vel, 0.004, 1.4, 1, 1.5);
  }

  tamtam(at: number, vel = 1): void {
    this.hiss(at, 'lowpass', 140, 0.9 * vel, 0.01, 2.4, 0.8);
    this.hiss(at + 0.05, 'bandpass', 420, 0.35 * vel, 0.3, 2.2, 1.2, 3);
  }

  /** Fades everything (reverb tail included) out between `from` and `to` seconds, then frees the context. */
  end(from: number, to: number): void {
    const { ctx } = this, g = this.out.gain;
    g.setValueAtTime(g.value, this.t0 + from);
    g.linearRampToValueAtTime(0, this.t0 + to);
    if (ctx instanceof AudioContext) setTimeout(() => ctx.close(), (to + 0.5) * 1000);
  }
}

/** Short brass call: a quick roll and pickup into one major chord with a cymbal crash (under 3 s). */
export function victoryFanfare(ctx: BaseAudioContext = new AudioContext()): void {
  try {
    const o = new Orchestra(0.75, ctx);
    o.roll(0, 36, 0.5, 0.7);
    o.cymbal(0.5, 0.9, 0.45);
    [[0, 55], [0.12, 55], [0.24, 60]].forEach(([at, n]) => o.brass(at, n, 0.05, 0.8));
    for (const n of [36, 48, 55, 60, 64, 67, 72, 76]) o.brass(0.5, n, 1.2, 1);
    o.pad(0.5, [48, 55, 60, 64, 67, 72], 1.0, 1.1);
    o.timpani(0.5, 36, 1);
    o.timpani(1.7, 36, 0.6);
    o.end(2.3, 3);
  } catch { /* no audio */ }
}

/** A low minor blow: tam-tam, timpani and a dark brass chord that dies away (under 3 s). */
export function defeatFanfare(ctx: BaseAudioContext = new AudioContext()): void {
  try {
    const o = new Orchestra(0.95, ctx);
    o.tamtam(0, 1);
    o.timpani(0, 36, 1);
    for (const n of [36, 43, 48, 51]) o.brass(0, n, 0.9, 0.9);
    o.pad(0.1, [48, 51, 55], 1.0, 0.8);
    o.end(2.2, 3);
  } catch { /* no audio */ }
}
