import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Rig } from '../entities/rig';
import { gear } from '../entities/gear';
import { onHit } from '../world/surfaces';
import type { Lighting } from '../render/lighting';
import type { Target } from './enemies';

const KINDS = ['civ_a', 'civ_b', 'civ_c'] as const;

interface Student extends Target { rig: Rig; collider: RAPIER.Collider; hp: number; dyingT: number; crouched: true }

/**
 * The people to defend: students cowering at the faculty's shelter spots (crouched, terrified loop), each with a
 * capsule the police (and the player's stray rounds) can hit. `lost` counts the dead; `onLost` reports each one.
 */
export class Students {
  readonly group = new THREE.Group();
  readonly list: Student[] = [];
  lost = 0;
  onLost: (at: THREE.Vector3, byPlayer: boolean) => void = () => {};
  private byHandle = new Map<number, Student>();

  constructor(spots: THREE.Vector3[], count: number, lighting: Lighting, world: RAPIER.World, rand: () => number) {
    const pool = spots.slice().sort(() => rand() - 0.5).slice(0, count);
    for (const p of pool) {
      const rig = new Rig(KINDS[Math.floor(rand() * KINDS.length)], lighting, false);
      rig.scared = true;
      rig.root.position.copy(p);
      rig.root.rotation.y = rand() * Math.PI * 2;
      rig.nearOnly(...gear(rig.bones, { backpack: 0.7, book: 0.2 }, lighting, rand));
      const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.35, 0.32).setTranslation(p.x, p.y + 0.7, p.z));
      const s: Student = { rig, collider, position: p.clone(), alive: true, crouched: true, hp: 150, dyingT: 0 };
      onHit(collider.handle, (dmg) => void this.damage(s, dmg, true));
      this.byHandle.set(collider.handle, s);
      this.list.push(s);
      this.group.add(rig.root);
    }
  }

  get alive(): Student[] {
    return this.list.filter((s) => s.alive);
  }

  /** A police round landing on `handle`; true when it was a student. */
  policeHit(handle: number, dmg: number): boolean {
    const s = this.byHandle.get(handle);
    if (!s?.alive) return false;
    this.damage(s, dmg * 0.6, false);
    return true;
  }

  explosion(at: THREE.Vector3, radius: number): void {
    for (const s of this.list) {
      const d = s.position.distanceTo(at);
      if (s.alive && d < radius) this.damage(s, 260 * (1 - d / radius), false);
    }
  }

  private damage(s: Student, dmg: number, byPlayer: boolean): void {
    if (!s.alive) return;
    s.hp -= dmg;
    if (s.hp > 0) return;
    s.alive = false;
    s.collider.setEnabled(false);
    s.rig.die(Math.random() < 0.5 ? 'dying' : 'fall_back');
    s.dyingT = 4;
    this.lost++;
    this.onLost(s.position.clone(), byPlayer);
  }

  update(dt: number, camera: THREE.Vector3): void {
    for (const s of this.list) {
      const d = s.position.distanceToSquared(camera);
      s.rig.root.visible = d < 90 * 90;
      if (!s.alive && s.dyingT <= 0) continue;
      s.dyingT -= dt;
      s.rig.far = d > 25 * 25;
      if (d < 60 * 60 || s.dyingT > 0) s.rig.animate(dt, 0, 0, 0);
    }
  }
}
