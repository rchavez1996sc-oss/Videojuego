import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Lighting } from '../render/lighting';
import { carModels, PAINT } from '../render/carModels';
import { toFloat } from '../render/floatGeometry';
import { carExtent, type CarKind } from './urbanProps';
import { setSurface } from './surfaces';
import { vehicleColliders } from '../physics/noLift';
import { vehicleLook, type VehicleMats } from '../systems/vehicleLook';

/** A parked car of the level: drawn instanced until the player takes it (then it becomes a traffic `Vehicle`). */
export interface ParkedSpot { pos: THREE.Vector3; yaw: number; kind: CarKind | 'moto'; paint: string; company?: number; model: string | null; collider?: RAPIER.Collider; taken?: boolean; look: string }

interface Batch { mesh: THREE.InstancedMesh; locals: THREE.Matrix4[]; tinted: boolean; spots: ParkedSpot[] }

const RANGE = 140, REFRESH = 0.4;



/**
 * Every parked car of the level (`car()` with a level builder registers one here instead of baking it): one instanced
 * mesh per look and part, refilled every 0.4 s with the cars within 140 m of the camera (so far cars cost nothing and
 * frustum culling works), a fixed box collider per car; `take` hands one over to be driven.
 */
class ParkedCars {
  readonly spots: ParkedSpot[] = [];
  readonly group = new THREE.Group();
  private batches: Batch[] = [];
  private world: RAPIER.World | null = null;
  private t = 0;
  private m = new THREE.Matrix4();
  private c = new THREE.Color();

  add(pos: THREE.Vector3, yaw: number, kind: CarKind | 'moto', paint: string): ParkedSpot {
    const spot: ParkedSpot = { pos: pos.clone(), yaw, kind, paint, model: null, look: '' };
    this.spots.push(spot);
    return spot;
  }

  /** After the level and the car models are loaded: colliders and instanced meshes. */
  build(lighting: Lighting, world: RAPIER.World, mats: VehicleMats): void {
    this.world = world;
    if (location.search.includes('shot')) Object.assign(window, { __parked: this });
    const byLook = new Map<string, ParkedSpot[]>();
    this.spots.forEach((s, i) => {
      s.model = carModels.pick(s.kind, Math.floor(s.pos.x * 7.3 + s.pos.z * 3.1) + i);
      s.look = s.model ? `m:${s.model}|${s.kind}` : `p:${s.kind}|${s.paint}|${s.company ?? 0}`;
      const e = carExtent(s.kind), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.yaw);
      const mid = new THREE.Vector3(0, e.h / 2 + 0.05, 0).applyQuaternion(q).add(s.pos);
      s.collider = world.createCollider(RAPIER.ColliderDesc.cuboid(e.w / 2, e.h / 2 - 0.05, e.l / 2).setTranslation(mid.x, mid.y, mid.z).setRotation(q));
      setSurface(s.collider.handle, 'metal');
      vehicleColliders.add(s.collider.handle);
      if (!byLook.has(s.look)) byLook.set(s.look, []);
      byLook.get(s.look)!.push(s);
    });
    for (const [, list] of byLook) {
      const s0 = list[0], template = vehicleLook(lighting, mats, s0.kind, s0.paint, s0.model, s0.company, true);
      template.updateMatrixWorld(true);
      const parts = new Map<string, { geo: THREE.BufferGeometry; mat: THREE.Material; locals: THREE.Matrix4[] }>(), pieces = new Map<THREE.Material, THREE.BufferGeometry[]>();
      template.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh || Array.isArray(mesh.material)) return;
        if (!pieces.has(mesh.material)) pieces.set(mesh.material, []);
        pieces.get(mesh.material)!.push(toFloat(mesh.geometry).applyMatrix4(mesh.matrixWorld));
      });
      for (const [mat, geos] of pieces) {
        const merged = geos.length > 1 ? mergeGeometries(geos) : geos[0];
        if (merged) parts.set(mat.uuid, { geo: merged, mat, locals: [new THREE.Matrix4()] });
        else geos.forEach((g, k) => parts.set(`${mat.uuid}${k}`, { geo: g, mat, locals: [new THREE.Matrix4()] }));
      }
      for (const p of parts.values()) {
        const mesh = new THREE.InstancedMesh(p.geo, p.mat, list.length * p.locals.length);
        mesh.castShadow = !p.mat.transparent;
        mesh.receiveShadow = true;
        mesh.count = 0;
        mesh.visible = false;
        const tinted = p.mat.name === 'car-model-paint';
        if (tinted) mesh.setColorAt(0, this.c.set('#ffffff'));
        this.batches.push({ mesh, locals: p.locals, tinted, spots: list });
        this.group.add(mesh);
      }
    }
  }

  /** Refills the instances near the camera. */
  tick(dt: number, camera: THREE.Vector3, force = false): void {
    if (!force && (this.t -= dt) > 0) return;
    this.t = REFRESH;
    const q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), at = new THREE.Matrix4(), up = new THREE.Vector3(0, 1, 0);
    for (const b of this.batches) {
      let n = 0;
      for (const s of b.spots) {
        if (s.taken || Math.hypot(s.pos.x - camera.x, s.pos.z - camera.z) > RANGE) continue;
        at.compose(s.pos, q.setFromAxisAngle(up, s.yaw), one);
        for (const l of b.locals) {
          b.mesh.setMatrixAt(n, this.m.multiplyMatrices(at, l));
          if (b.tinted) b.mesh.setColorAt(n, this.c.set(PAINT[s.paint] ?? s.paint));
          n++;
        }
      }
      b.mesh.count = n;
      b.mesh.visible = n > 0;
      b.mesh.instanceMatrix.needsUpdate = true;
      if (b.mesh.instanceColor) b.mesh.instanceColor.needsUpdate = true;
      b.mesh.boundingSphere = null;
      if (n) b.mesh.computeBoundingSphere();
    }
  }

  /** The closest parked car whose body is within `reach` of `p`, and how far. */
  nearest(p: THREE.Vector3, reach: number): { spot: ParkedSpot; dist: number } | null {
    let best: ParkedSpot | null = null, bd = reach;
    for (const s of this.spots) {
      if (s.taken || Math.abs(s.pos.y - p.y) > 2.5) continue;
      const e = carExtent(s.kind), f = new THREE.Vector3(Math.sin(s.yaw), 0, Math.cos(s.yaw)), rx = p.x - s.pos.x, rz = p.z - s.pos.z;
      const along = Math.max(0, Math.abs(rx * f.x + rz * f.z) - e.l / 2), side = Math.max(0, Math.abs(rx * f.z - rz * f.x) - e.w / 2);
      const d = Math.hypot(along, side);
      if (d < bd) [best, bd] = [s, d];
    }
    return best ? { spot: best, dist: bd } : null;
  }

  byCollider(handle: number): ParkedSpot | undefined {
    return this.spots.find((s) => s.collider?.handle === handle);
  }

  /** Removes the car from the parked set (its instance and collider) so it can be driven. */
  take(s: ParkedSpot, camera: THREE.Vector3): void {
    s.taken = true;
    if (s.collider && this.world) this.world.removeCollider(s.collider, false);
    s.collider = undefined;
    this.tick(0, camera, true);
  }
}

export const parkedCars = new ParkedCars();
