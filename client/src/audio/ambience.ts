import type { Mixer } from './mixer';
import { CityBed } from './cityBed';

/** City bed: distant traffic rumble plus positional horns and barking (distance in m, pan -1..1). */
export class Ambience {
  private rumble: GainNode;
  private calm = 1;
  private bed: CityBed;

  constructor(private m: Mixer) {
    const { ctx } = m;
    this.bed = new CityBed(m);
    this.rumble = ctx.createGain();
    this.rumble.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    lp.connect(this.rumble).connect(m.master);
    const src = m.noise();
    src.connect(lp);
    src.start();
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

  /** `combat` fades the traffic bed down during fights. */
  update(dt: number, combat: boolean): void {
    if (this.m.ctx.state !== 'running') return;
    this.calm += ((combat ? 0.15 : 1) - this.calm) * Math.min(1, dt * 0.5);
    this.rumble.gain.value = 0.035 * this.calm;
    this.bed.update(dt, this.calm);
  }

  /**
   * A car horn: two slightly sour reeds at the vehicle's own fixed pitch through a nasal band, muffled with distance.
   * Fixed per vehicle and only from nearby traffic, so distant honks never line up into something like a tune.
   */
  horn(distance: number, pan: number, pitch: number): void {
    const { ctx } = this.m, t = ctx.currentTime + distance / 343;
    const p = ctx.createStereoPanner(), g = ctx.createGain(), bp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    g.gain.value = 0.18 / (1 + distance / 20);
    bp.type = 'bandpass';
    bp.frequency.value = 1300;
    bp.Q.value = 0.7;
    lp.type = 'lowpass';
    lp.frequency.value = Math.max(700, 3200 / (1 + distance / 40));
    bp.connect(lp).connect(g).connect(p).connect(this.m.sfx);
    const dur = 0.2 + Math.random() * 0.25;
    for (const f of [pitch, pitch * 1.23]) this.blip(t, 'sawtooth', f, dur, 0.3, bp);
    if (Math.random() < 0.3) for (const f of [pitch, pitch * 1.23]) this.blip(t + dur + 0.1, 'sawtooth', f, 0.12, 0.3, bp);
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
