import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Mixer } from '../audio/mixer';
import { snapSound } from '../audio/breakSound';

export type BreakKind = 'rail' | 'post' | 'tree';
export interface Part { mesh: THREE.InstancedMesh; index: number }
interface Item { collider: RAPIER.Collider; base: THREE.Vector3; height: number; kind: BreakKind; parts: Part[] }

/**
 * Speed a 1300 kg car must carry to knock each kind over (m/s; heavier vehicles need less, lighter more), the share of its
 * speed it soaks up, the damage it does to the car, how far it ends up tipped (rad) and how hard the car is kicked.
 */
const GIVE: Record<BreakKind, { speed: number; soak: number; dmg: number; lie: number }> = {
  rail: { speed: 2.2, soak: 0.05, dmg: 1, lie: 1.42 },
  post: { speed: 2.8, soak: 0.04, dmg: 2, lie: 1.5 },
  tree: { speed: 7.5, soak: 0.2, dmg: 8, lie: 1.22 },
};
const items = new Map<number, Item>();
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0), UP = new THREE.Vector3(0, 1, 0);

/** A thin thing a car can mow down: its collider, the foot it pivots on, its height and its instanced pieces. */
export function addBreakable(collider: RAPIER.Collider | undefined, base: THREE.Vector3, height: number, kind: BreakKind, parts: Part[]): void {
  if (collider) items.set(collider.handle, { collider, base: base.clone(), height, kind, parts });
}

/**
 * The driven car against breakables, run before the physics step: whatever its body would touch within this step that
 * it is fast enough to topple gives way — its collider goes, it falls over around its foot in the direction of travel —
 * and the car loses a little speed. Returns the damage done to the car (0 if nothing broke).
 */
export function smash(world: RAPIER.World, body: RAPIER.RigidBody, collider: RAPIER.Collider, mass: number, dt: number, mixer?: Mixer, kick?: (k: number) => void): number {
  if (!items.size) return 0;
  const l = body.linvel(), speed = Math.hypot(l.x, l.z);
  if (speed < 1.2) return 0;
  const dir = new THREE.Vector3(l.x / speed, 0, l.z / speed), heavy = Math.sqrt(1300 / mass);
  let k = 1, dmg = 0;
  for (let n = 0; n < 4; n++) {
    const hit = world.castShape(collider.translation(), collider.rotation(), dir, collider.shape, 0, speed * dt * 2 + 0.3, false, undefined, undefined, undefined, undefined, (c) => items.has(c.handle));
    if (!hit) break;
    const it = items.get(hit.collider.handle)!, g = GIVE[it.kind], v = speed * k;
    if (v < g.speed * heavy) break;
    k *= 1 - g.soak * Math.min(1.5, heavy * heavy);
    dmg += g.dmg * Math.min(1.5, heavy);
    topple(world, it, dir, v);
    if (mixer) snapSound(mixer, it.kind, Math.min(1, v / 16));
    kick?.(it.kind === 'tree' ? Math.min(0.4, v * 0.025) : 0.05);
  }
  if (k < 1) body.setLinvel({ x: l.x * k, y: l.y, z: l.z * k }, true);
  return dmg;
}

/** Removes the collider, hides the instances and replaces them by a copy that rotates over its foot until it lies down. */
function topple(world: RAPIER.World, it: Item, dir: THREE.Vector3, speed: number): void {
  items.delete(it.collider.handle);
  world.removeCollider(it.collider, false);
  const parent = it.parts[0]?.mesh.parent;
  if (!parent) return;
  parent.updateMatrixWorld();
  const pivot = new THREE.Group(), axis = new THREE.Vector3().crossVectors(UP, dir).normalize();
  pivot.position.copy(parent.worldToLocal(it.base.clone()));
  parent.add(pivot);
  pivot.updateMatrixWorld();
  const toPivot = pivot.matrix.clone().invert(), m = new THREE.Matrix4();
  for (const { mesh, index } of it.parts) {
    mesh.getMatrixAt(index, m);
    mesh.setMatrixAt(index, HIDDEN);
    mesh.instanceMatrix.needsUpdate = true;
    const piece = new THREE.InstancedMesh(mesh.geometry, mesh.material, 1);
    piece.setMatrixAt(0, toPivot.clone().multiply(mesh.matrix).multiply(m));
    Object.assign(piece, { castShadow: mesh.castShadow, receiveShadow: true, frustumCulled: false });
    pivot.add(piece);
  }
  const lie = GIVE[it.kind].lie, reach = Math.max(1, it.height);
  let angle = 0.02, spin = Math.min(it.kind === 'tree' ? 1.2 : 5, (speed / reach) * (it.kind === 'tree' ? 0.25 : 0.7)), last = performance.now(), bounced = false;
  const q = new THREE.Quaternion();
  const first = pivot.children[0] as THREE.Object3D;
  first.onBeforeRender = () => {
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (spin === 0 && angle >= lie) return;
    spin += (1.5 * 9.81 / reach) * Math.sin(angle) * dt;
    angle += spin * dt;
    if (angle >= lie) {
      angle = lie;
      spin = bounced ? 0 : -spin * 0.18;
      bounced = true;
    }
    pivot.quaternion.copy(q.setFromAxisAngle(axis, angle));
  };
}

if (location.search.includes('shot')) (window as unknown as { __breakables: unknown }).__breakables = { items, list: (kind: BreakKind) => [...items.values()].filter((i) => i.kind === kind).map((i) => [+i.base.x.toFixed(1), +i.base.z.toFixed(1)]) };
