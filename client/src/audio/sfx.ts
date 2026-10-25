import type { Mixer } from './mixer';
import { buildGunshots } from './gunshot';

export type Ground = 'grass' | 'dirt' | 'hard' | 'metal' | 'wood';

export class Sfx {
  private shots: AudioBuffer[];
  private heavy: AudioBuffer[];
  private own: AudioBuffer[];

  constructor(private m: Mixer, light = 0) {
    this.shots = buildGunshots(m.ctx, 4);
    this.heavy = buildGunshots(m.ctx, 2, true);
    this.own = light ? buildGunshots(m.ctx, 4, false, light) : this.shots;
  }

  /** One pre-rendered report into `dest`, with send amounts to the street slapback and the valley reverb. */
  private report(t: number, bank: AudioBuffer[], gain: number, dest: AudioNode, street: number, reverb: number, rate = 1): void {
    const { ctx } = this.m;
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
    this.report(this.m.ctx.currentTime + 0.001, this.own, 1.15, this.m.sfx, 0.55, 0.45);
  }

  /** Other people's gunshots: delayed by distance, dulled, quieter and panned towards its side; `gain` tames the squad's fire. */
  distantShot(distance: number, pan: number, heavy: boolean | 'own' = false, gain = 1): void {
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
    this.report(t, heavy === 'own' ? this.own : heavy ? this.heavy : this.shots, 0.9, lp, 0.25 + (1 - near) * 0.5, 0.4 + (1 - near) * 1.1, v > 1 ? 1 : 0.97);
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
    const t = ctx.currentTime + distance / 343, near = 1 / (1 + distance / 50);
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan)) * 0.7;
    const bus = ctx.createGain();
    bus.gain.value = 0.8 + near * 2.1;
    panner.connect(bus).connect(this.m.sfx);
    const echo = ctx.createGain();
    echo.gain.value = 0.8 + (1 - near) * 0.6;
    panner.connect(echo).connect(this.m.street);
    this.filtered(t, 'highpass', 2200, 0.7, 0.9 * near + 0.1, 0.001, 0.09, 0.3, panner);
    this.filtered(t, 'lowpass', 220, 0.7, 2.6, 0.004, 1.6, 1.8, panner);
    this.filtered(t, 'lowpass', 1800 * near + 500, 0.6, 1.6, 0.002, 0.6, 1.2, panner);
    this.tone(t, 'sine', 62, 22, 3.2, 1.8, 0.8, panner);
    this.filtered(t, 'lowpass', 90, 0.9, 2.2, 0.003, 2.2, 2.4, panner);
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

  /** Rifle swung hard: an airy whoosh and the sling/gear jostling. */
  meleeSwing(): void {
    const t = this.m.ctx.currentTime;
    this.filtered(t, 'bandpass', 500, 0.6, 0.35, 0.09, 0.16);
    this.filtered(t + 0.05, 'bandpass', 1100, 0.7, 0.22, 0.05, 0.1);
    for (let i = 0; i < 3; i++) this.filtered(t + 0.02 + i * 0.04, 'lowpass', 900, 0.7, 0.12, 0.002, 0.04);
  }

  /** Stock into a body: a deep, dull blow (no ring), the slap of cloth and flesh, gear rattling, a grunt-like low tail. */
  meleeHit(): void {
    const t = this.m.ctx.currentTime;
    this.filtered(t, 'lowpass', 180, 0.7, 2.2, 0.002, 0.22, 0.25);
    this.tone(t, 'sine', 95, 38, 1.6, 0.22, 0.2);
    this.tone(t, 'triangle', 160, 70, 0.5, 0.09);
    this.filtered(t + 0.003, 'bandpass', 700, 0.6, 1.1, 0.001, 0.07);
    this.filtered(t + 0.006, 'lowpass', 1400, 0.5, 0.6, 0.001, 0.05);
    for (let i = 0; i < 4; i++) this.filtered(t + 0.03 + i * 0.03 + Math.random() * 0.02, 'lowpass', 1200, 0.6, 0.18, 0.002, 0.05);
    this.filtered(t + 0.12, 'lowpass', 220, 0.6, 0.5, 0.02, 0.25);
  }

  grenadePin(): void {
    const t = this.m.ctx.currentTime;
    this.filtered(t, 'bandpass', 4200, 6, 0.25, 0.001, 0.04);
    this.filtered(t + 0.18, 'bandpass', 1300, 3, 0.2, 0.002, 0.08);
  }

  /** Brass rounds rattling into a pouch, then a magazine seated with a solid click. */
  pickupAmmo(): void {
    const t = this.m.ctx.currentTime;
    for (let i = 0; i < 8; i++) this.filtered(t + i * 0.035 + Math.random() * 0.02, 'bandpass', 3000 + Math.random() * 2600, 8, 0.45, 0.001, 0.07);
    this.filtered(t + 0.3, 'bandpass', 1800, 3, 0.9, 0.001, 0.06);
    this.filtered(t + 0.31, 'lowpass', 500, 1, 0.8, 0.001, 0.09);
    this.tone(t + 0.3, 'triangle', 220, 160, 0.35, 0.1);
  }

  /** Medkit: a velcro rip, then a bright rising three-note chime. */
  pickupMedkit(): void {
    const t = this.m.ctx.currentTime;
    for (let i = 0; i < 6; i++) this.filtered(t + i * 0.03, 'highpass', 2500, 0.7, 0.35, 0.002, 0.035);
    this.tone(t + 0.2, 'sine', 523, 523, 0.32, 0.3);
    this.tone(t + 0.32, 'sine', 659, 659, 0.32, 0.3);
    this.tone(t + 0.44, 'sine', 1047, 1047, 0.3, 0.55);
  }

  hurt(): void {
    const t = this.m.ctx.currentTime;
    this.tone(t, 'sine', 90, 50, 0.5, 0.15);
    this.filtered(t, 'lowpass', 400, 1, 0.4, 0.002, 0.12);
  }

  /** Body slamming into the ground after a long fall, `k` 0..1. */
  thud(k: number): void {
    const t = this.m.ctx.currentTime;
    this.tone(t, 'sine', 70, 32, 0.6 + 0.4 * k, 0.35);
    this.filtered(t, 'lowpass', 900, 0.8, 0.5 + 0.4 * k, 0.001, 0.18);
    this.filtered(t + 0.02, 'bandpass', 2400, 1.5, 0.15 * k, 0.001, 0.08);
    this.hurt();
  }

  dryFire(): void {
    const t = this.m.ctx.currentTime;
    this.filtered(t, 'bandpass', 3200, 6, 0.4, 0.001, 0.03);
  }

  /** AK reload: catch, mag out, pouch, mag in with a slap and, from empty, the charging handle racked back and slammed home. */
  private reloadBus: GainNode | null = null;

  /** Magazine out, new one in, bolt (empty), spread over `dur` seconds; `cancelReload` silences what is still to come. */
  reload(empty: boolean, dur = empty ? 2.3 : 2.0): void {
    const t = this.m.ctx.currentTime, k = dur / (empty ? 2.3 : 2.0), bus = (this.reloadBus = this.m.ctx.createGain());
    bus.connect(this.m.sfx);
    const clack = (dt: number, f: number, p: number, body = 0) => {
      this.filtered(t + dt * k, 'bandpass', f, 3, p, 0.001, 0.07, 0, bus);
      this.filtered(t + dt * k, 'bandpass', f * 2.3, 5, p * 0.7, 0.001, 0.04, 0, bus);
      this.filtered(t + dt * k, 'lowpass', 600, 1, p * 0.5, 0.001, 0.05, 0, bus);
      if (body) this.tone(t + dt * k, 'triangle', 170, 90, body, 0.14, 0, bus);
    };
    clack(0.25, 2100, 3.6, 0.9);
    this.filtered(t + 0.3 * k, 'bandpass', 2400, 1.2, 0.9, 0.05, 0.25, 0, bus);
    this.filtered(t + 0.75 * k, 'bandpass', 900, 0.8, 0.7, 0.08, 0.3, 0, bus);
    this.filtered(t + 1.25 * k, 'bandpass', 3000, 1.4, 0.8, 0.05, 0.14, 0, bus);
    clack(1.42, 1400, 4.6, 2.0);
    this.filtered(t + 1.55 * k, 'lowpass', 480, 1, 2.0, 0.002, 0.1, 0, bus);
    if (empty) {
      clack(1.9, 2300, 3.8, 0.7);
      this.filtered(t + 1.93 * k, 'bandpass', 3600, 1.6, 0.8, 0.02, 0.1, 0, bus);
      clack(2.12, 1200, 4.8, 2.2);
    }
  }

  cancelReload(): void {
    this.reloadBus?.gain.setTargetAtTime(0, this.m.ctx.currentTime, 0.02);
    this.reloadBus = null;
  }

  /**
   * Heel thud plus a surface layer: grass swish, crunchy dirt and grit (a scatter of tiny grains), a hard click and
   * scuff on asphalt/concrete/stone, a ringing clank on sheet metal or a hollow knock on wood.
   */
  footstep(intensity: number, surface: Ground = 'dirt'): void {
    const t = this.m.ctx.currentTime, v = 0.9 + Math.random() * 0.2, k = intensity;
    const soft = surface === 'grass' || surface === 'dirt';
    this.tone(t, 'sine', 85 * v, 45, (soft ? 0.32 : 0.22) * k, soft ? 0.09 : 0.05);
    this.filtered(t, 'lowpass', 260 * v, 0.7, 0.3 * k, 0.003, soft ? 0.07 : 0.04);
    if (surface === 'grass') {
      this.filtered(t + 0.015, 'highpass', 2600 * v, 0.5, 0.03 * k, 0.025, 0.16);
      this.filtered(t + 0.01, 'bandpass', 1200 * v, 0.6, 0.02 * k, 0.02, 0.1);
    } else if (surface === 'dirt') {
      for (let i = 0; i < 7; i++) this.filtered(t + 0.005 + Math.random() * 0.07, 'bandpass', 1800 + Math.random() * 3000, 3, 0.05 * k, 0.001, 0.012);
      this.filtered(t + 0.01, 'bandpass', 900 * v, 0.8, 0.04 * k, 0.004, 0.08);
    } else if (surface === 'hard') {
      this.filtered(t, 'bandpass', 3200 * v, 1.6, 0.11 * k, 0.001, 0.025);
      this.filtered(t + 0.03, 'bandpass', 1600 * v, 0.7, 0.035 * k, 0.01, 0.06);
      this.tone(t, 'sine', 190 * v, 140, 0.08 * k, 0.03);
    } else if (surface === 'metal') {
      for (const f of [420, 690, 1130]) this.tone(t, 'sine', f * v, f * v * 0.99, 0.035 * k, 0.22);
      this.filtered(t, 'bandpass', 2500 * v, 2, 0.07 * k, 0.001, 0.05);
    } else {
      this.tone(t, 'triangle', 210 * v, 170, 0.16 * k, 0.11);
      this.filtered(t, 'bandpass', 650 * v, 3, 0.06 * k, 0.002, 0.08);
    }
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
