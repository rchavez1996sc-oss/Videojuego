import type { WeaponDef } from './types';

/** Fire-rate, ammo, reload and spread state for one weapon. */
export class Gun {
  ammo: number;
  reserve: number;
  mode: 'auto' | 'semi';
  reloading = 0;
  spread = 0;
  shotIndex = 0;
  private cooldown = 0;
  private reloadTotal = 1;
  private sinceShot = 10;

  constructor(readonly def: WeaponDef) {
    this.ammo = def.magazine;
    this.reserve = def.reserve;
    this.mode = def.modes[0];
  }

  get reloadProgress(): number {
    return this.reloading > 0 ? 1 - this.reloading / this.reloadTotal : 0;
  }

  /** Most rounds that can be carried in total (loaded magazine included). */
  get carry(): number {
    return this.def.magazine + this.def.reserve;
  }

  /** Room left in the reserve given what is loaded. */
  get reserveMax(): number {
    return this.carry - this.ammo;
  }

  addAmmo(rounds: number): void {
    this.reserve = Math.min(this.reserveMax, this.reserve + rounds);
  }

  toggleMode(): void {
    const i = this.def.modes.indexOf(this.mode);
    this.mode = this.def.modes[(i + 1) % this.def.modes.length];
  }

  /** Returns 'empty' when reloading starts automatically or the mag is dry. */
  startReload(): boolean {
    if (this.reloading > 0 || this.ammo === this.def.magazine || this.reserve === 0) return false;
    this.reloadTotal = this.reloading = this.ammo === 0 ? this.def.reloadEmptyTime : this.def.reloadTime;
    return true;
  }

  /** Abandons a reload in progress (the magazine stays as it was). */
  cancelReload(): void {
    this.reloading = 0;
  }

  /** Current cone half-angle in degrees. */
  coneDeg(aiming: boolean, moveSpeed: number, airborne: boolean): number {
    const base = aiming ? this.def.spreadAim : this.def.spreadHip;
    return base + Math.min(moveSpeed / 6, 1) * this.def.spreadMove + (airborne ? 3 : 0) + this.spread;
  }

  /** Advances timers; returns true when a bullet should be fired this frame. */
  update(dt: number, trigger: boolean, triggerPressed: boolean): 'fire' | 'dry' | null {
    this.cooldown -= dt;
    this.sinceShot += dt;
    this.spread = Math.max(0, this.spread - this.def.spreadRecover * dt * (this.sinceShot > 0.15 ? 1 : 0.2));
    if (this.sinceShot > 0.35) this.shotIndex = 0;
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) {
        const take = Math.min(this.def.magazine - this.ammo, this.reserve);
        this.ammo += take;
        this.reserve -= take;
      }
      return null;
    }
    const wants = this.mode === 'auto' ? trigger : triggerPressed;
    if (!wants || this.cooldown > 0) return null;
    if (this.ammo === 0) {
      this.cooldown = 0.25;
      return triggerPressed ? 'dry' : null;
    }
    this.ammo--;
    this.cooldown = 60 / this.def.rpm;
    this.sinceShot = 0;
    this.spread = Math.min(this.def.spreadMax, this.spread + this.def.spreadPerShot);
    this.shotIndex++;
    return 'fire';
  }

  /** Recoil kick for the shot just fired, in radians [up, side]. */
  recoil(aiming: boolean): [number, number] {
    const p = this.def.pattern[Math.min(Math.max(0, this.shotIndex - 1), this.def.pattern.length - 1)];
    const k = (aiming ? 0.7 : 1) * Math.PI / 180;
    const jitter = (Math.random() - 0.5) * this.def.recoilSide;
    return [p[1] * this.def.recoilUp * k, (p[0] * this.def.recoilSide + jitter) * k];
  }
}
