import type { Mixer } from './mixer';
import { buildGunshots } from './gunshot';

export class Sfx {
  private shots: AudioBuffer[];
  private heavy: AudioBuffer[];

  constructor(private m: Mixer) {
    this.shots = buildGunshots(m.ctx, 4);
    this.heavy = buildGunshots(m.ctx, 2, true);
  }

  /** One pre-rendered report into `dest`, with send amounts to the street slapback and the valley reverb. */
  private report(t: number, heavy: boolean, gain: number, dest: AudioNode, street: number, reverb: number, rate = 1): void {
    const { ctx } = this.m;
    const bank = heavy ? this.heavy : this.shots;
    const src = ctx.createBufferSource();
    src.buffer = bank[Math.floor(Math.random() * bank.length)];
    src.playbackRate.value = rate * (0.96 + Math.random() * 0.08);
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(dest);
    for (const [bus, amount] of [[this.m.street, street], [this.m.reverb, reverb]] as const) {
      if (amount <= 0) continue;
      const s = ctx.createGain();
      s.gain.value = amount;
      g.connect(s).connect(bus);
    }
    src.start(t);
  }

  private filtered(t: number, type: BiquadFilterType, freq: number, q: number, peak: number, attack: number, decay: number, send = 0, dest: AudioNode = this.m.sfx): void {
    const { ctx } = this.m;
    const src = this.m.noise();
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.m.env(t, peak, attack, decay);
    src.connect(f).connect(g).connect(dest);
    if (send) {
      const s = ctx.createGain();
      s.gain.value = send;
      g.connect(s).connect(this.m.reverb);
    }
    src.start(t);
    src.stop(t + attack + decay + 0.05);
  }

  private tone(t: number, type: OscillatorType, f0: number, f1: number, peak: number, decay: number, send = 0, dest: AudioNode = this.m.sfx): void {
    const { ctx } = this.m;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + decay);
    const g = this.m.env(t, peak, 0.002, decay);
    o.connect(g).connect(dest);
    if (send) {
      const s = ctx.createGain();
      s.gain.value = send;
      g.connect(s).connect(this.m.reverb);
    }
    o.start(t);
    o.stop(t + decay + 0.05);
  }

  rifleShot(): void {
    this.report(this.m.ctx.currentTime + 0.001, false, 1.15, this.m.sfx, 0.55, 0.45);
  }

  /** Other people's gunshots: delayed by distance, dulled, quieter and panned towards its side; `gain` tames the squad's fire. */
  distantShot(distance: number, pan: number, heavy = false, gain = 1): void {
    const { ctx } = this.m;
    const t = ctx.currentTime + distance / 343, v = 0.9 + Math.random() * 0.2;
    const near = 1 / (1 + distance / 22);
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan)) * 0.8;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = Math.max(700, 9000 * near + 400);
    const bus = ctx.createGain();
    bus.gain.value = (0.25 + near * 0.9) * gain;
    lp.connect(panner).connect(bus).connect(this.m.sfx);
    this.report(t, heavy, 0.9, lp, 0.25 + (1 - near) * 0.5, 0.4 + (1 - near) * 1.1, v > 1 ? 1 : 0.97);
    setTimeout(() => bus.disconnect(), (distance / 343 + 1.5) * 1000);
  }

  whiz(pan: number): void {
    const { ctx } = this.m, t = ctx.currentTime;
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    panner.connect(this.m.sfx);
    const src = this.m.noise(), f = ctx.createBiquadFilter(), g = this.m.env(t, 0.35, 0.01, 0.12);
    f.type = 'bandpass';
    f.Q.value = 8;
    f.frequency.setValueAtTime(5200, t);
    f.frequency.exponentialRampToValueAtTime(1800, t + 0.13);
    src.connect(f).connect(g).connect(panner);
    src.start(t);
    src.stop(t + 0.2);
  }

  /** Grenade: sharp crack, deep body and sub thump, a roll bouncing off the façades, debris rain and, up close, ringing ears. */
  explosion(distance: number, pan: number): void {
    const { ctx } = this.m;
    const t = ctx.currentTime + distance / 343, near = 1 / (1 + distance / 30);
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan)) * 0.7;
    const bus = ctx.createGain();
    bus.gain.value = 0.45 + near * 1.2;
    panner.connect(bus).connect(this.m.sfx);
    const echo = ctx.createGain();
    echo.gain.value = 0.5 + (1 - near) * 0.4;
    panner.connect(echo).connect(this.m.street);
    this.filtered(t, 'highpass', 2200, 0.7, 0.9 * near + 0.1, 0.001, 0.09, 0.3, panner);
    this.filtered(t, 'lowpass', 220, 0.7, 2.6, 0.004, 1.6, 1.8, panner);
    this.filtered(t, 'lowpass', 1800 * near + 500, 0.6, 1.6, 0.002, 0.6, 1.2, panner);
    this.tone(t, 'sine', 62, 22, 2.4, 1.4, 0.8, panner);
    this.tone(t + 0.01, 'triangle', 110, 40, 0.8, 0.5, 0.3, panner);
    this.filtered(t + 0.35, 'lowpass', 160, 0.5, 0.9, 0.15, 2.6, 1.6, panner);
    for (let i = 0; i < 14; i++) {
      const d = t + 0.45 + Math.random() * 1.6;
      this.filtered(d, 'bandpass', 1800 + Math.random() * 3000, 3, (0.05 + Math.random() * 0.08) * near, 0.002, 0.05 + Math.random() * 0.08, 0.2, panner);
    }
    if (distance < 12) this.tone(t + 0.05, 'sine', 3900, 3700, 0.06 * (1 - distance / 12), 2.4);
    setTimeout(() => {
      bus.disconnect();
      echo.disconnect();
    }, (distance / 343 + 5) * 1000);
  }

  crash(distance: number): void {
    const t = this.m.ctx.currentTime + distance / 343, vol = Math.max(0.1, 1 - distance / 120);
    this.filtered(t, 'lowpass', 300, 0.8, 1.1 * vol, 0.004, 0.35, 0.5);
    this.filtered(t + 0.02, 'bandpass', 1800, 2, 0.5 * vol, 0.002, 0.25, 0.4);
    this.filtered(t + 0.18, 'bandpass', 3200, 4, 0.2 * vol, 0.002, 0.4, 0.3);
  }

  meleeSwing(): void {
    const t = this.m.ctx.currentTime;
    this.filtered(t, 'bandpass', 700, 1.2, 0.25, 0.08, 0.18);
    this.filtered(t + 0.06, 'bandpass', 1400, 1.5, 0.15, 0.05, 0.12);
  }

  meleeHit(): void {
    const t = this.m.ctx.currentTime;
    this.filtered(t, 'lowpass', 260, 1, 1.1, 0.002, 0.16, 0.2);
    this.tone(t, 'sine', 120, 55, 0.6, 0.14);
    this.filtered(t + 0.01, 'bandpass', 2400, 3, 0.18, 0.001, 0.05);
  }

  grenadePin(): void {
    const t = this.m.ctx.currentTime;
    this.filtered(t, 'bandpass', 4200, 6, 0.25, 0.001, 0.04);
    this.filtered(t + 0.18, 'bandpass', 1300, 3, 0.2, 0.002, 0.08);
  }

  pickup(): void {
    const t = this.m.ctx.currentTime;
    this.filtered(t, 'bandpass', 900, 2, 0.25, 0.005, 0.08);
    this.tone(t + 0.05, 'sine', 660, 660, 0.12, 0.12);
    this.tone(t + 0.13, 'sine', 990, 990, 0.12, 0.18);
  }

  hurt(): void {
    const t = this.m.ctx.currentTime;
    this.tone(t, 'sine', 90, 50, 0.5, 0.15);
    this.filtered(t, 'lowpass', 400, 1, 0.4, 0.002, 0.12);
  }

  dryFire(): void {
    const t = this.m.ctx.currentTime;
    this.filtered(t, 'bandpass', 3200, 6, 0.4, 0.001, 0.03);
  }

  /** AK reload: catch, mag out, pouch, mag in with a slap and, from empty, the charging handle racked back and slammed home. */
  reload(empty: boolean): void {
    const t = this.m.ctx.currentTime;
    const clack = (dt: number, f: number, p: number, body = 0) => {
      this.filtered(t + dt, 'bandpass', f, 3, p, 0.001, 0.06, 0.15);
      this.filtered(t + dt, 'bandpass', f * 2.3, 5, p * 0.6, 0.001, 0.035);
      if (body) this.tone(t + dt, 'triangle', 170, 90, body, 0.12);
    };
    clack(0.25, 2100, 1.8, 0.4);
    this.filtered(t + 0.3, 'bandpass', 2400, 1.2, 0.45, 0.05, 0.25);
    this.filtered(t + 0.75, 'bandpass', 900, 0.8, 0.35, 0.08, 0.3);
    this.filtered(t + 1.25, 'bandpass', 3000, 1.4, 0.4, 0.05, 0.14);
    clack(1.42, 1400, 2.4, 1.0);
    this.filtered(t + 1.55, 'lowpass', 480, 1, 1.1, 0.002, 0.09);
    if (empty) {
      clack(1.9, 2300, 2.0, 0.3);
      this.filtered(t + 1.93, 'bandpass', 3600, 1.6, 0.4, 0.02, 0.1);
      clack(2.12, 1200, 2.6, 1.1);
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
