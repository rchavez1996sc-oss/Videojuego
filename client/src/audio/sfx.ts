import type { Mixer } from './mixer';

export class Sfx {
  constructor(private m: Mixer) {}

  private filtered(t: number, type: BiquadFilterType, freq: number, q: number, peak: number, attack: number, decay: number, send = 0): void {
    const { ctx } = this.m;
    const src = this.m.noise();
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.m.env(t, peak, attack, decay);
    src.connect(f).connect(g).connect(this.m.sfx);
    if (send) {
      const s = ctx.createGain();
      s.gain.value = send;
      g.connect(s).connect(this.m.reverb);
    }
    src.start(t);
    src.stop(t + attack + decay + 0.05);
  }

  private tone(t: number, type: OscillatorType, f0: number, f1: number, peak: number, decay: number, send = 0): void {
    const { ctx } = this.m;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + decay);
    const g = this.m.env(t, peak, 0.002, decay);
    o.connect(g).connect(this.m.sfx);
    if (send) {
      const s = ctx.createGain();
      s.gain.value = send;
      g.connect(s).connect(this.m.reverb);
    }
    o.start(t);
    o.stop(t + decay + 0.05);
  }

  rifleShot(): void {
    const t = this.m.ctx.currentTime + 0.001, v = 0.9 + Math.random() * 0.2;
    this.filtered(t, 'bandpass', 2400 * v, 0.7, 1.4, 0.001, 0.07, 0.6);
    this.filtered(t, 'lowpass', 700 * v, 0.8, 1.6, 0.002, 0.22, 1.0);
    this.filtered(t + 0.004, 'highpass', 5500, 0.5, 0.35, 0.001, 0.03);
    this.tone(t, 'sine', 140 * v, 38, 1.3, 0.18, 0.4);
    this.filtered(t + 0.05, 'bandpass', 3800, 4, 0.12, 0.001, 0.02);
  }

  dryFire(): void {
    const t = this.m.ctx.currentTime;
    this.filtered(t, 'bandpass', 3200, 6, 0.4, 0.001, 0.03);
  }

  reload(empty: boolean): void {
    const t = this.m.ctx.currentTime;
    const click = (dt: number, f: number, p: number) => this.filtered(t + dt, 'bandpass', f, 5, p, 0.001, 0.05);
    click(0.35, 1800, 0.5);
    click(0.42, 900, 0.4);
    click(1.45, 2200, 0.6);
    click(1.5, 1100, 0.5);
    if (empty) {
      click(2.25, 2600, 0.6);
      click(2.38, 1500, 0.7);
    }
  }

  /** Muffled heel thud plus a surface layer: grass swish, dirt grit, stone tap or hollow wood. */
  footstep(intensity: number, surface: 'grass' | 'dirt' | 'rock' | 'wood' = 'dirt'): void {
    const t = this.m.ctx.currentTime, v = 0.9 + Math.random() * 0.2, k = intensity;
    this.tone(t, 'sine', 85 * v, 45, 0.32 * k, 0.09);
    this.filtered(t, 'lowpass', 260 * v, 0.7, 0.3 * k, 0.003, 0.07);
    if (surface === 'grass') this.filtered(t + 0.015, 'bandpass', 1500 * v, 0.6, 0.035 * k, 0.02, 0.12);
    else if (surface === 'dirt') this.filtered(t + 0.01, 'bandpass', 1100 * v, 0.9, 0.05 * k, 0.005, 0.07);
    else if (surface === 'rock') {
      this.filtered(t, 'bandpass', 1800 * v, 2, 0.08 * k, 0.001, 0.035);
      this.tone(t, 'sine', 160 * v, 120, 0.12 * k, 0.05);
    } else this.tone(t, 'triangle', 210 * v, 170, 0.16 * k, 0.11);
  }

  shellBounce(): void {
    const t = this.m.ctx.currentTime, f = 4200 + Math.random() * 1800;
    this.tone(t, 'sine', f, f * 0.98, 0.05, 0.12);
    this.tone(t, 'sine', f * 1.53, f * 1.5, 0.03, 0.08);
  }

  impact(surface: string, distance: number): void {
    const t = this.m.ctx.currentTime + Math.min(distance / 343, 0.6);
    const vol = Math.max(0.08, 1 - distance / 150) * 0.5;
    if (surface === 'rock' || surface === 'metal') this.filtered(t, 'bandpass', 3000, 3, vol, 0.001, 0.06);
    else this.filtered(t, 'lowpass', 900, 1, vol, 0.001, 0.09);
  }

  hitmarker(kill: boolean): void {
    const t = this.m.ctx.currentTime + 0.02;
    this.tone(t, 'square', kill ? 1300 : 1900, kill ? 1200 : 1850, kill ? 0.18 : 0.1, kill ? 0.12 : 0.04);
  }

  steelPing(distance: number): void {
    const t = this.m.ctx.currentTime + distance / 343;
    const vol = Math.max(0.15, 1 - distance / 120) * 0.35;
    for (const [f, d] of [[1180, 0.7], [1730, 0.5], [2650, 0.35], [3920, 0.2]]) this.tone(t, 'sine', f, f * 0.995, vol, d, 0.3);
  }
}
