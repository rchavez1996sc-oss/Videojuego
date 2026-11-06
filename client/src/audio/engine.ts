import type { Mixer } from './mixer';

/**
 * Engine of the vehicle the player drives: two detuned sawtooth harmonics and a sub through a low-pass, pitch from
 * revs, brightness and level from throttle, plus filtered noise for tyres/wind at speed. Silent while not driving.
 */
export class EngineSound {
  private oscs: { o: OscillatorNode; mult: number }[] = [];
  private noise: AudioBufferSourceNode;
  private filter: BiquadFilterNode;
  private gain: GainNode;
  private hiss: GainNode;
  private started = false;

  constructor(private m: Mixer) {
    const { ctx } = m;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.Q.value = 2.5;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.filter.connect(this.gain).connect(m.sfx);
    for (const [type, mult, level] of [['sawtooth', 1, 0.5], ['sawtooth', 2.01, 0.25], ['square', 0.5, 0.35]] as const) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type;
      o.frequency.value = 40 * mult;
      g.gain.value = level;
      o.connect(g).connect(this.filter);
      this.oscs.push({ o, mult });
    }
    const noise = (this.noise = m.noise()), bp = ctx.createBiquadFilter();
    noise.loop = true;
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 0.6;
    this.hiss = ctx.createGain();
    this.hiss.gain.value = 0;
    noise.connect(bp).connect(this.hiss).connect(m.sfx);
  }

  /** `rev` 0..1 (engine speed within the gear), `throttle` 0..1, `speed` m/s; `small` for motorbikes and mototaxis. */
  set(on: boolean, rev: number, throttle: number, speed: number, small: boolean): void {
    const { ctx } = this.m, t = ctx.currentTime;
    if (on && !this.started) {
      this.started = true;
      for (const { o } of this.oscs) o.start();
      this.noise.start();
    }
    if (!this.started) return;
    const base = small ? 55 + rev * 150 : 32 + rev * 85;
    for (const { o, mult } of this.oscs) o.frequency.setTargetAtTime(base * mult, t, 0.05);
    this.filter.frequency.setTargetAtTime(250 + rev * 1300 + throttle * 900, t, 0.06);
    this.gain.gain.setTargetAtTime(on ? 0.05 + throttle * 0.07 + rev * 0.03 : 0, t, on ? 0.08 : 0.25);
    this.hiss.gain.setTargetAtTime(on ? Math.min(0.06, speed * 0.0025) : 0, t, 0.2);
  }
}
