import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

const OUT = 0.18, IN = 0.62, KEEP = 25, MAX = 10;
const HAND_AT = new THREE.Vector3(0, 9, 3);

interface Dropped { m: THREE.Object3D; v: THREE.Vector3; w: THREE.Vector3; t: number; rest: boolean }

/**
 * Visible magazine change on the player's gun (parts tagged `userData.mag`): at 18 % of the reload the magazine
 * drops out of the well and falls to the floor (gravity, a bounce, then lies there), a fresh one rides in the left
 * hand, and at 62 % it is seated again. A cancelled reload simply puts the magazine back.
 */
export class MagSwap {
  private parts: THREE.Object3D[] = [];
  private inHand: THREE.Group | null = null;
  private dropped: Dropped[] = [];
  private out = false;
  private q = new THREE.Quaternion();

  constructor(weapon: THREE.Object3D, leftHand: THREE.Object3D | undefined, private world: RAPIER.World, private scene: THREE.Object3D) {
    weapon.traverse((o) => o.userData.mag && this.parts.push(o));
    if (!this.parts.length || !leftHand) return;
    const hand = (this.inHand = new THREE.Group());
    for (const p of this.parts) hand.add(p.clone());
    hand.scale.copy(weapon.scale);
    hand.position.copy(HAND_AT);
    hand.rotation.set(Math.PI / 2, 0, 0);
    hand.visible = false;
    leftHand.add(hand);
  }

  update(dt: number, reloading: boolean, progress: number): void {
    if (!this.inHand) return;
    const phase = reloading ? progress : 1;
    if (!this.out && reloading && phase >= OUT && phase < IN) this.eject();
    if (this.out && (!reloading || phase >= IN)) this.seat();
    for (let i = this.dropped.length - 1; i >= 0; i--) if (this.fall(this.dropped[i], dt)) this.scene.remove(this.dropped.splice(i, 1)[0].m);
  }

  private eject(): void {
    this.out = true;
    const g = new THREE.Group();
    for (const p of this.parts) {
      const c = p.clone();
      p.getWorldPosition(c.position);
      p.getWorldQuaternion(c.quaternion);
      c.scale.setScalar(1);
      g.add(c);
      p.visible = false;
    }
    this.scene.add(g);
    if (this.dropped.length >= MAX) this.scene.remove(this.dropped.shift()!.m);
    this.dropped.push({ m: g, v: new THREE.Vector3((Math.random() - 0.5) * 0.4, -0.6, (Math.random() - 0.5) * 0.4), w: new THREE.Vector3().randomDirection().multiplyScalar(4), t: 0, rest: false });
    this.inHand!.visible = true;
  }

  private seat(): void {
    this.out = false;
    for (const p of this.parts) p.visible = true;
    this.inHand!.visible = false;
  }

  /** Simple rigid fall of the group's children (each keeps its world pose); true when it should be removed. */
  private fall(d: Dropped, dt: number): boolean {
    d.t += dt;
    if (d.t > KEEP) return true;
    if (d.rest) return false;
    d.v.y -= 9.8 * dt;
    const pivot = d.m.children[0].position.clone(), step = d.v.clone().multiplyScalar(dt), len = step.length();
    const hit = len > 1e-5 ? this.world.castRayAndGetNormal(new RAPIER.Ray(pivot, step.clone().divideScalar(len)), len + 0.03, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS | RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC) : null;
    if (hit) {
      d.v.reflect(new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z)).multiplyScalar(0.25);
      d.w.multiplyScalar(0.4);
      if (d.v.lengthSq() < 0.3) {
        d.rest = true;
        const lay = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2).premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6.28));
        for (const k of d.m.children) k.quaternion.copy(lay);
        for (const k of d.m.children) k.position.y = pivot.y + 0.015;
        return false;
      }
      step.setScalar(0);
    }
    this.q.setFromAxisAngle(d.w.clone().normalize(), d.w.length() * dt);
    for (const k of d.m.children) {
      k.position.sub(pivot).applyQuaternion(this.q).add(pivot).add(step);
      k.quaternion.premultiply(this.q);
    }
    return false;
  }
}
