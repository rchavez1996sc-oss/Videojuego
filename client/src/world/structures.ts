import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Heightfield } from './heightfield';
import type { Lighting } from '../render/lighting';
import { Builder } from './buildingKit';
import { rock, wood } from '../render/textures';

export interface StructureDef { type: 'watchpost' | 'crates'; forward: number; lateral: number; rot?: number }

const UP = new THREE.Vector3(0, 1, 0);

type At = (x: number, y: number, z: number) => THREE.Vector3;

function watchpost(b: Builder, at: At, q: THREE.Quaternion): void {
  const H = 2.4, sink = 1, W = 4;
  b.box('stone', [W, H + sink, W], at(0, (H - sink) / 2, 0), q);
  b.box('stone', [W + 0.2, 0.15, W + 0.2], at(0, H + 0.075, 0), q, false);
  b.box('stone', [W, 0.9, 0.3], at(0, H + 0.45, W / 2 - 0.15), q);
  for (const s of [1, -1]) b.box('stone', [0.3, 0.9, W - 0.3], at(s * (W / 2 - 0.15), H + 0.45, 0.15), q);
  b.box('stone', [W / 2 - 0.6, 0.9, 0.3], at(-W / 4 - 0.3, H + 0.45, -W / 2 + 0.15), q);
  const steps = 6, rise = H / steps, run = 0.45;
  for (let i = 0; i < steps; i++) {
    const top = H - rise * (i + 1);
    b.box('stone', [1.2, top + sink, run], at(W / 4, (top - sink) / 2, -W / 2 - run * (i + 0.5)), q);
  }
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) b.box('wood', [0.14, 2.1, 0.14], at(x * (W / 2 - 0.15), H + 1.05, z * (W / 2 - 0.15)), q, false);
  const roofQ = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.12));
  b.box('wood', [W + 0.5, 0.08, W + 0.5], at(0, H + 2.2, 0), roofQ, false);
}

function crates(b: Builder, at: At, q: THREE.Quaternion): void {
  const c = (x: number, y: number, z: number, s: number, yaw: number) =>
    b.box('crate', [s, s, s], at(x, y + s / 2, z), q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(UP, yaw)));
  c(0, 0, 0, 1.0, 0.05);
  c(1.1, 0, 0.1, 1.0, -0.08);
  c(1.05, 1.0, 0.05, 1.0, 0.12);
  c(-1.3, 0, -0.4, 0.6, 0.3);
  c(2.4, 0, 1.2, 1.6, 0.2);
}

export function buildStructures(hf: Heightfield, lighting: Lighting, world: RAPIER.World, origin: { x: number; z: number; yaw: number }, defs: StructureDef[]): THREE.Group {
  const b = new Builder(world, world.createRigidBody(RAPIER.RigidBodyDesc.fixed()));
  const fwd = new THREE.Vector3(-Math.sin(origin.yaw), 0, -Math.cos(origin.yaw));
  const side = new THREE.Vector3(-fwd.z, 0, fwd.x);
  for (const d of defs) {
    const x = origin.x + fwd.x * d.forward + side.x * d.lateral, z = origin.z + fwd.z * d.forward + side.z * d.lateral;
    const base = new THREE.Vector3(x, hf.heightAt(x, z), z);
    const q = new THREE.Quaternion().setFromAxisAngle(UP, origin.yaw + Math.PI + (d.rot ?? 0));
    const at: At = (lx, ly, lz) => new THREE.Vector3(lx, ly, lz).applyQuaternion(q).add(base);
    if (d.type === 'watchpost') watchpost(b, at, q);
    else crates(b, at, q);
  }
  const st = rock(), wd = wood();
  const std = (key: string, p: THREE.MeshStandardMaterialParameters) => lighting.setup(new THREE.MeshStandardMaterial(p), key);
  const group = new THREE.Group();
  if (!defs.length) return group;
  group.add(...b.build({
    stone: std('stone', { map: st.map, normalMap: st.normalMap, roughness: 0.9, color: '#a39a90' }),
    wood: std('wood', { map: wd.map, normalMap: wd.normalMap, roughness: 0.9 }),
    crate: std('crate', { map: wd.map, normalMap: wd.normalMap, roughness: 0.85, color: '#b8a080' }),
  }, 0.5));
  return group;
}
