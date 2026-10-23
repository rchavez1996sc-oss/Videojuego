import * as THREE from 'three';
import { hitHandler } from '../world/surfaces';
import type { Player } from '../entities/player';
import type { Enemies } from './enemies';
import type { Sfx } from '../audio/sfx';
import type { ThirdPersonCamera } from '../core/camera';
import type { Input } from '../core/input';

const REACH = 1.8, DAMAGE = 140, SWING = 0.75, STRIKE = 0.32, COOLDOWN = 1;

/** Rifle-butt strike: pulling the trigger with an enemy within arm's reach in front swings the stock instead of firing. */
export class Melee {
  private t = 0;
  private cool = 0;
  private target: { handle: number; chest: () => THREE.Vector3 } | null = null;

  constructor(private player: Player, private enemies: Enemies, private sfx: Sfx, private cam: ThirdPersonCamera) {}

  /** True while a swing is under way (the rifle must not fire). */
  update(dt: number, input: Input): boolean {
    this.cool -= dt;
    if (this.t > 0) {
      const before = this.t;
      this.t -= dt;
      if (before > SWING - STRIKE && this.t <= SWING - STRIKE && this.target) {
        hitHandler(this.target.handle)?.(DAMAGE, this.target.chest());
        this.sfx.meleeHit();
        this.cam.kick(0.012, 0, 0.35);
        this.target = null;
      }
      if (this.t <= 0) this.player.model.release(0.15);
      return true;
    }
    if (this.cool > 0 || !input.hit('Mouse0') || this.player.climbing || this.player.airborne) return false;
    const p = this.player.position, fwd = new THREE.Vector3(-Math.sin(this.cam.yaw), 0, -Math.cos(this.cam.yaw));
    const e = this.enemies.list.find((x) => {
      if (!x.alive || Math.abs(x.position.y - p.y) > 1.2) return false;
      const to = x.position.clone().sub(p).setY(0), d = to.length();
      return d < REACH && to.divideScalar(d || 1).dot(fwd) > 0.4;
    });
    if (!e) return false;
    this.target = { handle: e.handle, chest: () => e.position.clone().setY(e.position.y + 1.2) };
    const m = this.player.model;
    m.hold('melee', (m.durationOf('melee') * 0.45) / SWING, true, 0.22);
    this.sfx.meleeSwing();
    this.t = SWING;
    this.cool = COOLDOWN;
    return true;
  }
}
