import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Grenades } from './grenades';
import type { Input } from '../core/input';
import type { Player } from '../entities/player';
import type { Sfx } from '../audio/sfx';
import type { Hud } from '../ui/hud';

const STEPS = 90, DT = 0.03, GRAVITY = 9.81, THROW_SPEED = 17, THROW_LIFT = 3.5;

/** G equips a grenade: right click shows the throw arc and landing spot, left click throws, then back to the rifle. */
export class GrenadeMode {
  readonly group = new THREE.Group();
  equipped = false;
  private arc: THREE.Line;
  private marker: THREE.Mesh;
  private pts = new Float32Array(STEPS * 3);

  constructor(private grenades: Grenades, private world: RAPIER.World, private camera: THREE.Camera, private player: Player, private sfx: Sfx, private hud: Hud) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pts, 3));
    this.arc = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: new THREE.Color(2.2, 1.7, 0.8), transparent: true, opacity: 0.85 }));
    this.arc.frustumCulled = false;
    this.marker = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.55, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.2, 0.5), transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    this.group.add(this.arc, this.marker);
    this.show(false);
  }

  private release(): { from: THREE.Vector3; dir: THREE.Vector3 } {
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const p = this.player.position;
    const from = p.clone().setY(p.y + 1.55).addScaledVector(dir.clone().setY(0).normalize(), 0.55);
    return { from, dir };
  }

  /** Throws immediately from the current view (also used by the test hooks). */
  throwNow(): boolean {
    const { from, dir } = this.release();
    if (!this.grenades.throw(from, dir, new THREE.Vector3())) return false;
    this.sfx.grenadePin();
    this.player.model.gesture('throw', 1.1);
    return true;
  }

  private show(v: boolean): void {
    this.arc.visible = this.marker.visible = v;
  }

  /** Shows the arc and landing ring for the current view. */
  preview(): void {
    this.arc.visible = true;
    const { from, dir } = this.release();
    const pos = from.clone(), vel = dir.multiplyScalar(THROW_SPEED).add(new THREE.Vector3(0, THROW_LIFT, 0));
    const ex = this.player.collisionHandle;
    let n = 0, landed: { p: THREE.Vector3; normal: THREE.Vector3 } | null = null;
    for (; n < STEPS && !landed; n++) {
      this.pts.set([pos.x, pos.y, pos.z], n * 3);
      vel.y -= GRAVITY * DT;
      const move = vel.clone().multiplyScalar(DT), len = move.length();
      const hit = this.world.castRayAndGetNormal(new RAPIER.Ray(pos, move.clone().divideScalar(len)), len, true, undefined, undefined, undefined, undefined, (c) => c.handle !== ex && c.isEnabled());
      if (hit) landed = { p: pos.clone().addScaledVector(move, hit.timeOfImpact / len), normal: new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z) };
      else pos.add(move);
    }
    if (landed) this.pts.set([landed.p.x, landed.p.y, landed.p.z], Math.min(n, STEPS - 1) * 3);
    const count = Math.min(n + 1, STEPS);
    this.arc.geometry.setDrawRange(0, count);
    this.arc.geometry.attributes.position.needsUpdate = true;
    this.marker.visible = !!landed;
    if (landed) {
      this.marker.position.copy(landed.p).addScaledVector(landed.normal, 0.04);
      this.marker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), landed.normal);
    }
  }

  /** Returns true while the grenade is in hand (the rifle must not fire). */
  update(input: Input, alive: boolean): boolean {
    if (!alive || input.hit('Digit1')) this.equipped = false;
    else if (input.hit('KeyG')) {
      if (this.equipped) this.equipped = false;
      else if (this.grenades.count > 0) this.equipped = true;
      else this.hud.showToast('SIN GRANADAS');
    }
    if (this.equipped && this.grenades.count <= 0) this.equipped = false;
    this.player.model.weapon.visible = !this.equipped;
    if (!this.equipped) {
      this.show(false);
      return false;
    }
    if (input.aiming) this.preview();
    else this.show(false);
    if (input.hit('Mouse0') && this.throwNow()) {
      this.equipped = false;
      this.show(false);
    }
    return true;
  }
}
