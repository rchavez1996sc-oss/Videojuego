import * as THREE from 'three';
import type { Enemy } from '../entities/enemy';
import { dropLoot, type Pickups } from './pickups';

const SETTLE = 1.2;

/** Once a body settles: blood under it and, for enemies, their rounds (and maybe a medkit). */
export class Loot {
  private bodies = new Map<Enemy, number>();

  constructor(private pickups: Pickups, private stain: (at: THREE.Vector3) => void = () => {}) {}

  update(dt: number, d: { dead: Enemy[]; fallen: Enemy[] }): void {
    for (const e of [...d.dead, ...d.fallen]) {
      const t = this.bodies.get(e) ?? 0;
      this.bodies.set(e, t + dt);
      if (t >= SETTLE || t + dt < SETTLE) continue;
      const at = e.model.hips().setY(e.position.y);
      this.stain(at);
      if (d.dead.includes(e)) dropLoot(this.pickups, at, e.position.y);
    }
    for (const [e, t] of this.bodies) if (t >= SETTLE && e.alive) this.bodies.delete(e);
  }
}
