import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Builder } from '../world/buildingKit';
import { car, mototaxi, type CarKind } from '../world/urbanProps';
import { setSurface } from '../world/surfaces';
import type { Heightfield } from '../world/heightfield';

interface Vehicle { group: THREE.Group; body: RAPIER.RigidBody; dir: 1 | -1; x: number; speed: number; cruise: number; len: number; honkT: number; panic: boolean; active: boolean }

const LANE = 3.2, X_MIN = -300, X_MAX = 300;

/** Cars, combis and mototaxis driving the avenue; they brake for the player and bolt when shooting starts. */
export class Traffic {
  readonly group = new THREE.Group();
  private list: Vehicle[] = [];
  private calmT = 99;
  onHonk: (at: THREE.Vector3) => void = () => {};

  constructor(world: RAPIER.World, private hf: Heightfield, materials: Record<string, THREE.Material>, bake: { material: THREE.Material; keys: string[] }[], count: number) {
    const kinds: (CarKind | 'moto')[] = ['combi', 'combi', 'tico', 'sedan', 'moto', 'moto', 'wagon', 'pickup'];
    for (let i = 0; i < count; i++) {
      const kind = kinds[i % kinds.length];
      const b = new Builder(null, null);
      if (kind === 'moto') mototaxi(b, new THREE.Vector3(), 0, `moto${i % 3}`);
      else car(b, new THREE.Vector3(), 0, kind === 'combi' ? 'car5' : kind === 'tico' ? 'car3' : `car${i % 6}`, kind);
      const g = new THREE.Group();
      g.add(...b.build(materials, 0.5, bake));
      this.group.add(g);
      const len = kind === 'moto' ? 2.3 : kind === 'combi' ? 4.8 : 4.4;
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -50, 0));
      setSurface(world.createCollider(RAPIER.ColliderDesc.cuboid(0.9, 0.8, len / 2).setTranslation(0, 0.8, 0), body).handle, 'metal');
      const dir = i % 2 ? 1 : -1;
      const cruise = kind === 'moto' ? 7 : kind === 'combi' ? 11 : 10;
      this.list.push({ group: g, body, dir, x: X_MIN + ((i * 77) % (X_MAX - X_MIN)), speed: cruise, cruise, len, honkT: 3 + Math.random() * 10, panic: false, active: true });
    }
  }

  /** Gunfire nearby: drivers floor it and leave; traffic stops spawning until things calm down. */
  alarm(at: THREE.Vector3): void {
    this.calmT = 0;
    for (const v of this.list) if (Math.abs(v.x - at.x) < 160) v.panic = true;
  }

  update(dt: number, player: THREE.Vector3): void {
    this.calmT += dt;
    for (const v of this.list) {
      const z = v.dir * LANE;
      if (!v.active) {
        if (this.calmT > 45 && Math.random() < dt * 0.2) {
          v.active = true;
          v.panic = false;
          v.x = v.dir > 0 ? X_MIN : X_MAX;
          v.group.visible = true;
        } else continue;
      }
      let target = v.panic ? 19 : v.cruise;
      const ahead = (px: number, pz: number, gap: number) => (px - v.x) * v.dir > 0 && (px - v.x) * v.dir < gap && Math.abs(pz - z) < 1.8;
      if (ahead(player.x, player.z, 12 + v.speed)) {
        target = 0;
        v.honkT -= dt * 4;
      }
      for (const o of this.list) if (o !== v && o.active && o.dir === v.dir && ahead(o.x, z, v.len + 4 + v.speed * 0.6)) target = Math.min(target, o.speed * 0.8);
      v.speed = THREE.MathUtils.damp(v.speed, target, target < v.speed ? 4 : 1.2, dt);
      v.x += v.dir * v.speed * dt;
      v.honkT -= dt;
      if (v.honkT <= 0) {
        v.honkT = 6 + Math.random() * 14;
        this.onHonk(new THREE.Vector3(v.x, 0, z));
      }
      if ((v.dir > 0 && v.x > X_MAX) || (v.dir < 0 && v.x < X_MIN)) {
        if (v.panic || this.calmT < 45) {
          v.active = false;
          v.group.visible = false;
          v.body.setNextKinematicTranslation({ x: 0, y: -50, z: 0 });
          continue;
        }
        v.x = v.dir > 0 ? X_MIN : X_MAX;
      }
      const y = this.hf.heightAt(v.x, z);
      const yaw = v.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      v.group.position.set(v.x, y, z);
      v.group.rotation.y = yaw;
      v.body.setNextKinematicTranslation({ x: v.x, y, z });
      v.body.setNextKinematicRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
    }
  }
}
