import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Grenades } from './grenades';
import type { Input } from '../core/input';
import type { Player } from '../entities/player';
import type { Sfx } from '../audio/sfx';
import type { Hud } from '../ui/hud';

const STEPS = 90, DT = 0.03, GRAVITY = 9.81, THROW_SPEED = 20, THROW_LIFT = 3.5;
/** Grenade Throw clip: torso poses (held ready / arm cocked), the throwing stretch and when the hand lets go. */
const READY = 1.0, COCKED = 1.84, FROM = 1.6, THROW_TIME = 0.75, RELEASE = 0.29, DRAW = 0.3;

/**
 * G puts the rifle away and takes a grenade in hand; right click cocks the arm and shows the arc, left click throws
 * (the grenade leaves the hand at the release moment). Another grenade is drawn while any are left, then the rifle returns.
 */
export class GrenadeMode {
  readonly group = new THREE.Group();
  equipped = false;
  private drawnAt = 0;
  private throwing: { t0: number; released: boolean } | null = null;
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

  private stow(): void {
    this.equipped = false;
    this.throwing = null;
    this.show(false);
    const m = this.player.model;
    m.clearPose();
    m.grenadeInHand = false;
    m.holster = false;
  }

  /** Returns true while the grenade is in hand (the rifle must not fire). */
  update(input: Input, alive: boolean): boolean {
    const now = performance.now() / 1000, m = this.player.model;
    if (!alive || input.hit('Digit1')) this.stow();
    else if (input.hit('KeyG') && !this.throwing) {
      if (this.equipped) this.stow();
      else if (this.grenades.count > 0) [this.equipped, this.drawnAt] = [true, now];
      else this.hud.showToast('SIN GRANADAS');
    }
    if (!this.equipped) return false;
    m.holster = true;
    if (this.throwing) {
      const t = now - this.throwing.t0;
      if (!this.throwing.released && t >= RELEASE) {
        this.throwing.released = true;
        const { from, dir } = this.release();
        this.grenades.throw(from, dir, new THREE.Vector3());
      }
      m.grenadeInHand = !this.throwing.released;
      if (t >= THROW_TIME) {
        this.throwing = null;
        if (this.grenades.count <= 0) this.stow();
        else this.drawnAt = now;
      }
      return true;
    }
    const ready = now - this.drawnAt > DRAW;
    m.grenadeInHand = ready;
    m.pose('throw', input.aiming ? COCKED : READY);
    if (input.aiming) this.preview();
    else this.show(false);
    if (ready && input.hit('Mouse0')) {
      this.throwing = { t0: now, released: false };
      this.sfx.grenadePin();
      m.gesture('throw', THROW_TIME, FROM);
      this.show(false);
    }
    return true;
  }
}
