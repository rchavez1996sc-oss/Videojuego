import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Builder } from './buildingKit';
import type { Heightfield } from './heightfield';
import type { Lighting } from '../render/lighting';
import type { DoorDef } from './doors';
import { looseExtra } from '../fx/looseProps';
import { surfaceTop } from './groundStrips';

const UP = new THREE.Vector3(0, 1, 0);

/** A blue tarp thrown over a heap: a disc pulled down over a dome, with folds. */
function tarp(r: number, h: number, seed: number): THREE.BufferGeometry {
  const g = new THREE.CircleGeometry(r * 1.15, 18, 0, Math.PI * 2).rotateX(-Math.PI / 2), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), d = Math.hypot(x, z) / (r * 1.15), a = Math.atan2(z, x);
    p.setY(i, h * Math.max(0, 1 - d * d) + 0.03 + Math.sin(a * 5 + seed) * 0.04 * d);
    const k = d > 0.85 ? 0.92 : 1;
    p.setX(i, x * k);
    p.setZ(i, z * k);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * The junk of a self-built barrio in front of the houses, from Street View of Huaycán: stacks of bricks waiting for
 * the next floor (with a few loose ones lying about that can be kicked and shot around), heaps of rubble under a blue
 * tarp, blue water drums by the door (shoot one and it spouts), and flower pots on the pavement (loose, they tumble).
 * Returns the static meshes and the drum spots.
 */
export function streetJunk(b: Builder, hf: Heightfield, lighting: Lighting, doors: DoorDef[], rand: () => number): { group: THREE.Group; drums: { p: THREE.Vector3; yaw: number }[] } {
  const geo: Record<'brick' | 'dirt' | 'tarp', THREE.BufferGeometry[]> = { brick: [], dirt: [], tarp: [] }, drums: { p: THREE.Vector3; yaw: number }[] = [];
  const brick = new THREE.BoxGeometry(0.24, 0.09, 0.13);
  for (const d of doors) {
    const out = new THREE.Vector3(Math.sin(d.yaw), 0, Math.cos(d.yaw)), along = new THREE.Vector3(Math.cos(d.yaw), 0, -Math.sin(d.yaw));
    const door = d.hinge.clone().addScaledVector(along, d.w / 2), roll = rand();
    const at = (o: number, s: number) => { const p = door.clone().addScaledVector(out, o).addScaledVector(along, s); p.y = surfaceTop(p.x, hf.heightAt(p.x, p.z), p.z, 0.5); return p; };
    if (roll < 0.07) {
      const c = at(1.6 + rand() * 0.8, (rand() < 0.5 ? -1 : 1) * (d.w / 2 + 0.9 + rand())), q = new THREE.Quaternion().setFromAxisAngle(UP, d.yaw + (rand() - 0.5) * 0.3);
      const rows = 4 + Math.floor(rand() * 6), cols = 4, deep = 3;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) for (let z = 0; z < deep; z++) {
        if (y === rows - 1 && rand() < 0.4) continue;
        const local = new THREE.Vector3((x - 1.5) * 0.25 + (y % 2) * 0.06, 0.045 + y * 0.092, (z - 1) * 0.14);
        geo.brick.push(brick.clone().applyMatrix4(new THREE.Matrix4().compose(local.applyQuaternion(q).add(c), q, new THREE.Vector3(1, 1, 1))));
      }
      b.box('none', [1.05, rows * 0.092, 0.45], c.clone().setY(c.y + rows * 0.046), q, true);
      for (let k = 0; k < 4 + rand() * 5; k++) looseExtra.push({ k: 'brick', p: c.clone().addScaledVector(out, 0.5 + rand() * 1.2).addScaledVector(along, (rand() - 0.5) * 2), yaw: rand() * 6.28 });
    } else if (roll < 0.12) {
      const c = at(1.8 + rand(), (rand() < 0.5 ? -1 : 1) * (d.w / 2 + 1.2)), r = 0.7 + rand() * 0.5, h = 0.35 + rand() * 0.3, cover = rand() < 0.6;
      geo.dirt.push(new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, h / r, 0.85).translate(c.x, c.y - 0.02, c.z));
      for (let k = 0; k < 6; k++) geo.dirt.push(new THREE.DodecahedronGeometry(0.08 + rand() * 0.1, 0).translate(c.x + (rand() - 0.5) * r * 2, c.y + 0.05, c.z + (rand() - 0.5) * r * 1.6));
      if (cover) geo.tarp.push(tarp(r * 0.85, h + 0.02, rand() * 6).rotateY(rand() * 6).translate(c.x, c.y - 0.02, c.z));
      b.box('none', [r * 1.6, h, r * 1.4], c.clone().setY(c.y + h / 2), new THREE.Quaternion(), true);
    } else if (roll < 0.24) drums.push({ p: at(0.45, (rand() < 0.5 ? -1 : 1) * (d.w / 2 + 0.45)), yaw: rand() * 6.28 });
    else if (roll < 0.36) for (let k = 0; k < 1 + rand() * 3; k++) looseExtra.push({ k: 'pot', p: at(0.3, (k % 2 ? -1 : 1) * (d.w / 2 + 0.35 + Math.floor(k / 2) * 0.4)), yaw: rand() * 6.28 });
  }
  const mats = {
    brick: lighting.setup(new THREE.MeshStandardMaterial({ color: '#7d4a36', roughness: 0.95 }), 'junk-brick'),
    dirt: lighting.setup(new THREE.MeshStandardMaterial({ color: '#8a7a64', roughness: 1 }), 'junk-dirt'),
    tarp: lighting.setup(new THREE.MeshStandardMaterial({ color: '#2a5fa8', roughness: 0.55, side: THREE.DoubleSide }), 'junk-tarp'),
  };
  const group = new THREE.Group();
  for (const k of Object.keys(geo) as (keyof typeof geo)[]) {
    if (!geo[k].length) continue;
    group.add(Object.assign(new THREE.Mesh(mergeGeometries(geo[k].map((g) => (g.index ? g.toNonIndexed() : g)))!, mats[k]), { castShadow: true, receiveShadow: true }));
  }
  return { group, drums };
}
