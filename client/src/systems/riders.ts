import * as THREE from 'three';
import type { Rig } from '../entities/rig';
import type { Heightfield } from '../world/heightfield';

const MAX_BODIES = 10, DEATHS = ['fall_back', 'death_right', 'death_front'];

/** Riders shot off their bikes: the seated rig leaves the vehicle, lands beside it and plays a death clip. */
export class Riders {
  private fallen: { rig: Rig; t: number }[] = [];

  constructor(private parent: THREE.Object3D, private hf: Heightfield) {}

  throwOff(holder: THREE.Object3D, side: THREE.Vector3): void {
    const rig = holder.userData.rig as Rig | undefined;
    if (!rig) return;
    const at = holder.getWorldPosition(new THREE.Vector3()).addScaledVector(side, 0.55);
    const yaw = new THREE.Euler().setFromQuaternion(rig.root.getWorldQuaternion(new THREE.Quaternion()), 'YXZ').y;
    holder.remove(rig.root);
    rig.root.position.set(at.x, this.hf.heightAt(at.x, at.z), at.z);
    rig.root.rotation.set(0, yaw, 0);
    this.parent.add(rig.root);
    rig.die(DEATHS[Math.floor(Math.random() * DEATHS.length)]);
    this.fallen.push({ rig, t: 0 });
    if (this.fallen.length > MAX_BODIES) this.fallen.shift()!.rig.root.removeFromParent();
  }

  update(dt: number, camera: THREE.Vector3): void {
    for (const f of this.fallen) {
      if ((f.t += dt) < 4) f.rig.tick(dt);
      f.rig.root.visible = f.rig.root.position.distanceTo(camera) < 150;
    }
  }
}
