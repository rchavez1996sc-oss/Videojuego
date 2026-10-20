import type { Mixer } from './mixer';

/**
 * City bed: distant traffic rumble, horns, barking and a tinny cumbia radio from a shop.
 * Positional cues take a distance (m) and pan (-1..1) from the caller.
 */
export class Ambience {
  private rumble: GainNode;
  private radioBus: GainNode;
  private radioPan: StereoPannerNode;
  private nextBeat = 0;
  private step = 0;
  private started = false;
  private calm = 1;

  constructor(private m: Mixer) {
    const { ctx } = m;
    this.rumble = ctx.createGain();
    this.rumble.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    lp.connect(this.rumble).connect(m.master);
    const src = m.noise();
    src.connect(lp);
    src.start();
    this.radioPan = ctx.createStereoPanner();
    this.radioBus = ctx.createGain();
    this.radioBus.gain.value = 0;
    const speaker = ctx.createBiquadFilter();
    speaker.type = 'bandpass';
    speaker.frequency.value = 1200;
    speaker.Q.value = 0.6;
    this.radioBus.connect(speaker).connect(this.radioPan).connect(m.master);
  }

  private blip(t: number, type: OscillatorType, f: number, dur: number, vol: number, dest: AudioNode): void {
    const { ctx } = this.m;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    const g = this.m.env(t, vol, 0.004, dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private scrape(t: number, dur: number, vol: number): void {
    const src = this.m.noise(), f = this.m.ctx.createBiquadFilter(), g = this.m.env(t, vol, 0.01, dur);
    f.type = 'bandpass';
    f.frequency.value = 5200;
    f.Q.value = 2;
    src.connect(f).connect(g).connect(this.radioBus);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  /** Schedules the cumbia loop a little ahead of time (call every frame). */
  private radio(): void {
    const { ctx } = this.m;
    const spb = 60 / 96 / 2;
    if (this.nextBeat < ctx.currentTime) this.nextBeat = ctx.currentTime + 0.05;
    const chords = [[196, 247, 294], [196, 247, 294], [220, 262, 330], [147, 185, 220]];
    while (this.nextBeat < ctx.currentTime + 0.25) {
      const t = this.nextBeat, s = this.step % 8, chord = chords[Math.floor(this.step / 8) % chords.length];
      if (s === 0 || s === 3 || s === 4 || s === 7) this.blip(t, 'sine', chord[0] / 2, 0.22, 0.5, this.radioBus);
      this.scrape(t, s % 2 ? 0.05 : 0.12, 0.18);
      if (s === 2 || s === 6) this.blip(t, 'square', 880, 0.05, 0.08, this.radioBus);
      if (s % 2 === 1) this.blip(t, 'triangle', chord[(this.step >> 1) % 3] * 2, 0.16, 0.16, this.radioBus);
      this.nextBeat += spb;
      this.step++;
    }
  }

  /** `radioDist`/`radioPan`: listener relation to the shop radio. `calm` 0..1 fades the traffic bed during fights. */
  update(dt: number, radioDist: number, radioPan: number, combat: boolean): void {
    if (this.m.ctx.state !== 'running') return;
    if (!this.started) {
      this.started = true;
      this.nextBeat = this.m.ctx.currentTime + 0.1;
    }
    this.calm += ((combat ? 0.15 : 1) - this.calm) * Math.min(1, dt * 0.5);
    this.rumble.gain.value = 0.035 * this.calm;
    this.radioBus.gain.value = Math.min(0.35, 2.2 / (1 + radioDist / 4)) * 0.4;
    this.radioPan.pan.value = Math.max(-1, Math.min(1, radioPan));
    this.radio();
  }

  horn(distance: number, pan: number): void {
    const { ctx } = this.m, t = ctx.currentTime + distance / 343;
    const p = ctx.createStereoPanner(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    g.gain.value = Math.max(0.03, 0.25 / (1 + distance / 25));
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    lp.connect(g).connect(p).connect(this.m.sfx);
    const dur = 0.25 + Math.random() * 0.35;
    for (const f of [392, 494]) this.blip(t, 'square', f * (0.9 + Math.random() * 0.2), dur, 0.3, lp);
    if (Math.random() < 0.4) for (const f of [392, 494]) this.blip(t + dur + 0.12, 'square', f, 0.18, 0.3, lp);
  }

  bark(distance: number, pan: number): void {
    const { ctx } = this.m;
    const p = ctx.createStereoPanner(), g = ctx.createGain();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    g.gain.value = Math.max(0.03, 0.4 / (1 + distance / 15));
    g.connect(p).connect(this.m.sfx);
    const t0 = ctx.currentTime + distance / 343;
    for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
      const t = t0 + i * 0.32, src = this.m.noise(), f = ctx.createBiquadFilter(), e = this.m.env(t, 0.8, 0.01, 0.12);
      f.type = 'bandpass';
      f.frequency.value = 700 + Math.random() * 200;
      f.Q.value = 3;
      src.connect(f).connect(e).connect(g);
      src.start(t);
      src.stop(t + 0.2);
      this.blip(t, 'sawtooth', 340 + Math.random() * 60, 0.09, 0.2, g);
    }
  }
}
