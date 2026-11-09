import * as THREE from 'three';
import { pets, type Pet } from '../render/pets';
import { roofPerches } from '../world/roofClutter';

interface RoofDog { beast: Pet; a: THREE.Vector3; b: THREE.Vector3; t: number; dir: number; wait: number; speed: number; barkT: number }

/**
 * Dogs kept on the flat roofs, as in so many Lima houses: each paces its front parapet, stops to look down, and
 * barks at whoever walks below (more often the closer the player is). They never come down and don't flee.
 */
export class RoofDogs {
  readonly group = new THREE.Group();
  private list: RoofDog[] = [];
  onBark: (at: THREE.Vector3) => void = () => {};

  constructor() {
    for (const [a, b] of roofPerches.splice(0)) {
      const beast = pets.make('dog', 0.8 + Math.random() * 0.3);
      if (!beast) continue;
      this.group.add(beast.root);
      this.list.push({ beast, a, b, t: Math.random(), dir: 1, wait: Math.random() * 4, speed: 0, barkT: 3 + Math.random() * 8 });
    }
  }

  update(dt: number, camera: THREE.Vector3): void {
    for (const d of this.list) {
      const len = d.a.distanceTo(d.b), near = d.a.distanceToSquared(camera) < 70 * 70;
      d.beast.root.visible = near;
      if (!near) continue;
      if (d.wait > 0) {
        d.wait -= dt;
        d.speed = THREE.MathUtils.damp(d.speed, 0, 6, dt);
      } else {
        d.speed = THREE.MathUtils.damp(d.speed, 1.1, 4, dt);
        d.t += (d.dir * d.speed * dt) / Math.max(len, 0.5);
        if (d.t > 1 || d.t < 0) [d.t, d.dir, d.wait] = [THREE.MathUtils.clamp(d.t, 0, 1), -d.dir, 1.5 + Math.random() * 5];
      }
      const p = d.a.clone().lerp(d.b, d.t), along = d.b.clone().sub(d.a).setY(0).normalize();
      d.beast.root.position.copy(p);
      d.beast.root.rotation.y = d.wait > 0 ? Math.atan2(camera.x - p.x, camera.z - p.z) : Math.atan2(along.x * d.dir, along.z * d.dir);
      d.beast.update(dt, d.speed);
      const dist = p.distanceTo(camera);
      if ((d.barkT -= dt * (dist < 25 ? 3 : 1)) <= 0) {
        d.barkT = 4 + Math.random() * 9;
        if (dist < 45) this.onBark(p.clone());
      }
    }
  }
}
