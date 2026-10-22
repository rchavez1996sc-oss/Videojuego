import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Enemy } from '../entities/enemy';
import { dropLoot, type Pickups } from './pickups';
import type { Heightfield } from '../world/heightfield';
import type { Player } from '../entities/player';
import type { Gun } from '../weapons/gun';
import type { Hud } from '../ui/hud';

const SETTLE = 1.2, EMPTY_DELAY = 2, EMPTY_EVERY = 40, LOW_EVERY = 100;

/** Once a body settles: blood under it and, for enemies, their rounds (and maybe a medkit). Plus crates when the player runs dry. */
export class Loot {
  private bodies = new Map<Enemy, number>();
  private emptyT = EMPTY_DELAY;
  private lowT = LOW_EVERY;

  constructor(private pickups: Pickups, private world: RAPIER.World, private hf: Heightfield, private stain: (at: THREE.Vector3) => void = () => {}) {}

  update(dt: number, d: { dead: Enemy[]; fallen: Enemy[]; player: Player; gun: Gun; hud: Hud; alive: boolean }): void {
    for (const e of [...d.dead, ...d.fallen]) {
      const t = this.bodies.get(e) ?? 0;
      this.bodies.set(e, t + dt);
      if (t >= SETTLE || t + dt < SETTLE) continue;
      const at = e.model.hips().setY(e.position.y);
      this.stain(at);
      if (d.dead.includes(e)) dropLoot(this.pickups, at, e.position.y);
    }
    for (const [e, t] of this.bodies) if (t >= SETTLE && e.alive) this.bodies.delete(e);
    this.resupply(dt, d);
  }

  private resupply(dt: number, d: { player: Player; gun: Gun; hud: Hud; alive: boolean }): void {
    if (!d.alive) return;
    const total = d.gun.ammo + d.gun.reserve;
    if (total <= 0) {
      if ((this.emptyT -= dt) <= 0 && this.drop(d.player)) {
        this.emptyT = EMPTY_EVERY;
        d.hud.showToast('MUNICIÓN DE EMERGENCIA CERCA');
      }
    } else this.emptyT = Math.min(this.emptyT + dt, EMPTY_DELAY);
    if (d.gun.reserve < d.gun.reserveMax * 0.35 && (this.lowT -= dt) <= 0 && this.drop(d.player)) {
      this.lowT = LOW_EVERY;
      d.hud.showToast('CAJA DE MUNICIÓN CERCA');
    }
  }

  /** A crate 7–14 m away, in the open and in line of sight of the player. */
  private drop(player: Player): boolean {
    const p = player.position, eye = p.clone().setY(p.y + 1.5);
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2, r = 7 + Math.random() * 7;
      const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r, y = this.hf.heightAt(x, z);
      if (Math.abs(y - p.y) > 2.5) continue;
      if (this.world.castRay(new RAPIER.Ray({ x, y: y + 0.3, z }, { x: 0, y: 1, z: 0 }), 30, true)) continue;
      const to = new THREE.Vector3(x, y + 0.5, z).sub(eye), len = to.length();
      const hit = this.world.castRay(new RAPIER.Ray(eye, to.divideScalar(len)), len, true, undefined, undefined, undefined, undefined, (c) => c.isEnabled() && c.handle !== player.collisionHandle);
      if (hit && hit.timeOfImpact < len - 0.6) continue;
      this.pickups.spawn(new THREE.Vector3(x, y, z), 'ammo', 90);
      return true;
    }
    return false;
  }
}
