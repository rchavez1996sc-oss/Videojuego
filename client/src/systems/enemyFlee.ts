import * as THREE from 'three';
import type { Enemy } from '../entities/enemy';

/** Some enemies who notice a live grenade nearby sprint away from it after a short reaction delay. */
export function fleeGrenade(list: Enemy[], at: THREE.Vector3): void {
  for (const e of list) {
    if (!e.alive || e.isStatic || e.position.distanceTo(at) > 8 || Math.random() > 0.6) continue;
    setTimeout(() => {
      if (!e.alive) return;
      const away = e.position.clone().sub(at).setY(0).normalize();
      e.moveTarget = e.position.clone().addScaledVector(away, 9);
      e.path = [];
      e.running = true;
      e.crouched = false;
      if (e.cover) e.cover.owner = -1;
      e.cover = null;
    }, 500 + Math.random() * 700);
  }
}
