import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Builder } from '../world/buildingKit';
import { car, mototaxi, type CarKind } from '../world/urbanProps';
import { deliveryBike } from '../world/deliveryBike';
import { onHit, setSurface } from '../world/surfaces';
import { seatedPerson, SEATS } from '../entities/occupants';
import type { Heightfield } from '../world/heightfield';
import type { Lighting } from '../render/lighting';

type State = 'drive' | 'off' | 'crash' | 'wreck';

interface Vehicle {
  kind: CarKind | 'moto' | 'delivery'; group: THREE.Group; body: RAPIER.RigidBody; collider: RAPIER.Collider; dir: 1 | -1;
  x: number; z: number; yaw: number; speed: number; cruise: number; len: number;
  honkT: number; panic: boolean; state: State; hp: number; spin: number; drift: number; smokeT: number;
}

export interface Victim { key: string; pos: THREE.Vector3; hurt(damage: number, from: THREE.Vector3, shove: THREE.Vector3): void }

const LANE = 3.2, X_MIN = -245, X_MAX = 245, HP = 140;

/** Avenue traffic with drivers/passengers; vehicles take bullet damage and, once disabled, skid out of control. */
export class Traffic {
  readonly group = new THREE.Group();
  private list: Vehicle[] = [];
  private calmT = 99;
  onHonk: (at: THREE.Vector3) => void = () => {};
  onDisabled: (at: THREE.Vector3, weight: number) => void = () => {};
  onCrash: (at: THREE.Vector3) => void = () => {};
  onSmoke: (at: THREE.Vector3) => void = () => {};
  /** People a moving vehicle can run into (player, squad, soldiers); `hurt` receives damage, origin and a shove. */
  victims: () => Victim[] = () => [];
  private hitT = new Map<string, number>();
  private clock = 0;
  /** Other people on the road drivers brake for (the squad). */
  obstacles: () => THREE.Vector3[] = () => [];

  constructor(private world: RAPIER.World, private hf: Heightfield, lighting: Lighting, materials: Record<string, THREE.Material>, bake: { material: THREE.Material; keys: string[] }[], count: number) {
    const glass = lighting.setup(new THREE.MeshStandardMaterial({ color: '#2a3238', roughness: 0.1, metalness: 0.5, transparent: true, opacity: 0.35 }), 'glass-see');
    const mats = { ...materials, glass };
    const bakeNoGlass = bake.map((g) => ({ ...g, keys: g.keys.filter((k) => k !== 'glass') }));
    const kinds: (CarKind | 'moto' | 'delivery')[] = ['combi', 'moto', 'tico', 'sedan', 'delivery', 'moto', 'combi', 'wagon', 'pickup', 'moto', 'tico', 'delivery'];
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < count; i++) {
      const kind = kinds[i % kinds.length];
      const b = new Builder(null, null);
      if (kind === 'moto') mototaxi(b, new THREE.Vector3(), 0, `moto${i % 3}`);
      else if (kind === 'delivery') deliveryBike(b, i % 3);
      else car(b, new THREE.Vector3(), 0, kind === 'combi' ? 'car5' : kind === 'tico' ? 'car3' : `car${i % 6}`, kind);
      const g = new THREE.Group();
      g.add(...b.build(mats, 0.5, bakeNoGlass));
      SEATS[kind].forEach(([x, y, z], k) => {
        if (k > 0 && rand() < 0.45) return;
        const p = seatedPerson(lighting, rand);
        p.position.set(x, y - 0.95, z);
        g.add(p);
      });
      this.group.add(g);
      const len = kind === 'delivery' ? 1.9 : kind === 'moto' ? 2.3 : kind === 'combi' ? 4.8 : 4.4;
      const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -50, 0));
      const collider = this.world.createCollider(RAPIER.ColliderDesc.cuboid(kind === 'delivery' ? 0.4 : 0.9, 0.8, len / 2).setTranslation(0, 0.8, 0), body);
      setSurface(collider.handle, 'metal');
      const dir = i % 2 ? 1 : -1;
      const cruise = kind === 'delivery' ? 9 : kind === 'moto' ? 7 : kind === 'combi' ? 11 : 10;
      const v: Vehicle = {
        kind, group: g, body, collider, dir, x: X_MIN + ((i * 77) % (X_MAX - X_MIN)), z: dir * LANE, yaw: dir > 0 ? Math.PI / 2 : -Math.PI / 2,
        speed: cruise, cruise, len, honkT: 3 + rand() * 10, panic: false, state: 'drive', hp: HP, spin: 0, drift: 0, smokeT: 0,
      };
      this.list.push(v);
      onHit(collider.handle, (dmg) => {
        this.damage(v, dmg);
        return false;
      });
    }
  }

  private damage(v: Vehicle, dmg: number): void {
    if (v.state !== 'drive') return;
    v.hp -= dmg;
    v.panic = true;
    if (v.hp > 0) return;
    v.state = 'crash';
    v.spin = (Math.random() < 0.5 ? -1 : 1) * (1.2 + Math.random() * 1.6);
    v.drift = v.dir * (1.5 + Math.random() * 2.5);
    this.onDisabled(new THREE.Vector3(v.x, 1, v.z), v.kind === 'combi' ? 4 : v.kind === 'moto' || v.kind === 'delivery' ? 1 : 2);
  }

  /** Test hook: disables the nearest driving vehicle and reports where it is. */
  debugDisableNearest(p: THREE.Vector3): string {
    const v = this.list.filter((o) => o.state === 'drive').sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
    if (!v) return 'none';
    this.damage(v, HP);
    return `${v.x.toFixed(0)},${v.z.toFixed(1)} speed ${v.speed.toFixed(1)}`;
  }

  /** Test hook: a spot `gap` metres in front of the fastest driving vehicle, in its lane. */
  debugAhead(gap: number): THREE.Vector3 | null {
    const v = this.list.filter((o) => o.state === 'drive').sort((a, b) => b.speed - a.speed)[0];
    return v ? new THREE.Vector3(v.x + v.dir * (v.len / 2 + gap), 0, v.z) : null;
  }

  get debugStates(): string {
    return this.list.map((v) => `${v.state[0]}@${v.x.toFixed(0)},${v.z.toFixed(1)}`).join(' ');
  }

  alarm(at: THREE.Vector3): void {
    this.calmT = 0;
    for (const v of this.list) if (v.state === 'drive' && Math.abs(v.x - at.x) < 160) v.panic = true;
  }

  explosion(at: THREE.Vector3, radius: number): void {
    for (const v of this.list) if (v.state === 'drive' && Math.hypot(v.x - at.x, v.z - at.z) < radius) this.damage(v, HP);
  }

  private crashStep(v: Vehicle, dt: number): void {
    const fwd = new THREE.Vector3(Math.sin(v.yaw), 0, Math.cos(v.yaw));
    const step = v.speed * dt + v.len / 2 + 0.3;
    const y = this.hf.heightAt(v.x, v.z) + 0.6;
    const hit = this.world.castRay(new RAPIER.Ray({ x: v.x, y, z: v.z }, fwd), step, true, undefined, undefined, undefined, undefined, (c) => c.handle !== v.collider.handle);
    if (hit || Math.abs(v.z) > 7.5) {
      if (v.speed > 2) this.onCrash(new THREE.Vector3(v.x, y, v.z));
      v.speed = 0;
    }
    v.speed = Math.max(0, v.speed - 7 * dt);
    v.x += fwd.x * v.speed * dt;
    v.z = THREE.MathUtils.clamp(v.z + fwd.z * v.speed * dt + v.drift * dt * Math.min(1, v.speed / 4), -7.6, 7.6);
    v.yaw += v.spin * dt * Math.min(1, v.speed / 3);
    if (v.speed <= 0.05) v.state = 'wreck';
  }

  /** Bodies inside the bumper's sweep this frame take damage from speed and how square the hit is, and get shoved aside. */
  private impacts(v: Vehicle, dt: number, now: number): void {
    if (v.speed < 2.5) return;
    const fwd = new THREE.Vector3(Math.sin(v.yaw), 0, Math.cos(v.yaw)), right = new THREE.Vector3(fwd.z, 0, -fwd.x);
    for (const t of this.victims()) {
      const rel = new THREE.Vector3(t.pos.x - v.x, 0, t.pos.z - v.z);
      const along = rel.dot(fwd), lat = rel.dot(right);
      if (Math.abs(lat) > 1.3 || along < -v.len / 2 - 0.3 || along > v.len / 2 + 0.45 + v.speed * dt) continue;
      const key = `${t.key}`;
      if ((this.hitT.get(key) ?? -9) > now - 1.2) continue;
      this.hitT.set(key, now);
      const square = along > v.len / 2 - 0.6 ? 1 - Math.min(1, Math.abs(lat) / 1.3) * 0.5 : 0.35;
      const damage = Math.min(75, (v.speed - 2) * 5.5) * square;
      const shove = fwd.clone().multiplyScalar(v.speed * 0.55 * square).addScaledVector(right, Math.sign(lat || 1) * (2 + v.speed * 0.25));
      t.hurt(damage, new THREE.Vector3(v.x, t.pos.y + 0.8, v.z), shove);
      if (square > 0.6) v.speed *= 0.6;
    }
  }

  /** Moves a far-off car to just beyond view behind/ahead of the player so the nearby avenue stays busy. */
  private bringNear(v: Vehicle, camX: number): void {
    const x = THREE.MathUtils.clamp(camX - v.dir * (150 + Math.random() * 40), X_MIN, X_MAX);
    if (this.list.some((o) => o !== v && o.dir === v.dir && o.state !== 'off' && Math.abs(o.x - x) < o.len + 10)) return;
    v.x = x;
  }

  update(dt: number, player: THREE.Vector3, camera: THREE.Vector3): void {
    this.calmT += dt;
    this.clock += dt;
    for (const v of this.list) {
      if (v.state === 'off') {
        if (this.calmT > 45 && Math.random() < dt * 0.2) {
          Object.assign(v, { state: 'drive', panic: false, hp: HP, x: v.dir > 0 ? X_MIN : X_MAX, z: v.dir * LANE, yaw: v.dir > 0 ? Math.PI / 2 : -Math.PI / 2 });
          v.group.visible = true;
        } else continue;
      }
      if (v.state === 'drive' || v.state === 'crash') this.impacts(v, dt, this.clock);
      if (v.state === 'crash') this.crashStep(v, dt);
      else if (v.state === 'drive') {
        let target = v.panic ? 19 : v.cruise;
        const ahead = (px: number, pz: number, gap: number) => (px - v.x) * v.dir > 0 && (px - v.x) * v.dir < gap && Math.abs(pz - v.z) < 1.8;
        if (ahead(player.x, player.z, 12 + v.speed) || this.obstacles().some((o) => ahead(o.x, o.z, 10 + v.speed))) {
          target = 0;
          v.honkT -= dt * 4;
        }
        for (const o of this.list) if (o !== v && o.state !== 'off' && (o.dir === v.dir || o.state !== 'drive') && ahead(o.x, o.z, v.len + 4 + v.speed * 0.6)) target = Math.min(target, o.state === 'drive' ? o.speed * 0.8 : 0);
        v.speed = THREE.MathUtils.damp(v.speed, target, target < v.speed ? 4 : 1.2, dt);
        v.x += v.dir * v.speed * dt;
        v.honkT -= dt;
        if (v.honkT <= 0) {
          v.honkT = 6 + Math.random() * 14;
          this.onHonk(new THREE.Vector3(v.x, 0, v.z));
        }
        if (!v.panic && this.calmT > 45 && Math.abs(v.x - camera.x) > 220) this.bringNear(v, camera.x);
        if ((v.dir > 0 && v.x > X_MAX) || (v.dir < 0 && v.x < X_MIN)) {
          if (v.panic || this.calmT < 45) {
            v.state = 'off';
            v.group.visible = false;
            v.body.setNextKinematicTranslation({ x: 0, y: -50, z: 0 });
            continue;
          }
          v.x = v.dir > 0 ? X_MIN : X_MAX;
        }
      } else if ((v.smokeT -= dt) <= 0 && Math.hypot(v.x - camera.x, v.z - camera.z) < 140) {
        v.smokeT = 0.12;
        this.onSmoke(new THREE.Vector3(v.x, this.hf.heightAt(v.x, v.z) + 1.2, v.z).add(new THREE.Vector3(Math.sin(v.yaw), 0, Math.cos(v.yaw)).multiplyScalar(v.len * 0.35)));
      }
      const y = this.hf.heightAt(v.x, v.z);
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), v.yaw);
      v.group.visible = Math.hypot(v.x - camera.x, v.z - camera.z) < 150;
      v.group.position.set(v.x, y, v.z);
      v.group.quaternion.copy(q);
      v.body.setNextKinematicTranslation({ x: v.x, y, z: v.z });
      v.body.setNextKinematicRotation(q);
    }
  }
}
