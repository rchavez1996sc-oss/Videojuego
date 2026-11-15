import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Builder } from './buildingKit';
import type { Heightfield } from './heightfield';
import type { Lighting } from '../render/lighting';
import type { DoorDef } from './doors';
import { looseExtra } from '../fx/looseProps';
import { surfaceTop } from './groundStrips';

const UP = new THREE.Vector3(0, 1, 0);

/**
 * The junk of a self-built barrio in front of the houses, from Street View of Huaycán: stacks of bricks waiting for
 * the next floor (with a few loose ones lying about that can be kicked and shot around), blue water drums by the door (shoot one and it spouts), and flower pots on the pavement (loose, they tumble).
 * Returns the static meshes and the drum spots.
 */
export function streetJunk(b: Builder, hf: Heightfield, lighting: Lighting, doors: DoorDef[], rand: () => number): { group: THREE.Group; drums: { p: THREE.Vector3; yaw: number }[] } {
  const geo: Record<'brick', THREE.BufferGeometry[]> = { brick: [] }, drums: { p: THREE.Vector3; yaw: number }[] = [];
  const brick = new THREE.BoxGeometry(0.24, 0.09, 0.13);
  for (const d of doors) {
    const out = new THREE.Vector3(Math.sin(d.yaw), 0, Math.cos(d.yaw)), along = new THREE.Vector3(Math.cos(d.yaw), 0, -Math.sin(d.yaw));
    const door = d.hinge.clone().addScaledVector(along, d.w / 2), roll = rand();
    const at = (o: number, s: number) => { const p = door.clone().addScaledVector(out, o).addScaledVector(along, s); p.y = surfaceTop(p.x, hf.heightAt(p.x, p.z), p.z, 0.5); return p; };
    if (roll < 0.07) {
      const c = at(0.55 + rand() * 0.25, (rand() < 0.5 ? -1 : 1) * (d.w / 2 + 1.0 + rand() * 0.6)), q = new THREE.Quaternion().setFromAxisAngle(UP, d.yaw + (rand() - 0.5) * 0.3);
      const rows = 4 + Math.floor(rand() * 6), cols = 4, deep = 3;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) for (let z = 0; z < deep; z++) {
        if (y === rows - 1 && rand() < 0.4) continue;
        const local = new THREE.Vector3((x - 1.5) * 0.25 + (y % 2) * 0.06, 0.045 + y * 0.092, (z - 1) * 0.14);
        geo.brick.push(brick.clone().applyMatrix4(new THREE.Matrix4().compose(local.applyQuaternion(q).add(c), q, new THREE.Vector3(1, 1, 1))));
      }
      b.box('none', [1.05, rows * 0.092, 0.45], c.clone().setY(c.y + rows * 0.046), q, true);
      for (let k = 0; k < 4 + rand() * 5; k++) looseExtra.push({ k: 'brick', p: c.clone().addScaledVector(out, 0.4 + rand() * 0.7).addScaledVector(along, (rand() - 0.5) * 2), yaw: rand() * 6.28 });
    } else if (roll < 0.2) drums.push({ p: at(0.45, (rand() < 0.5 ? -1 : 1) * (d.w / 2 + 0.45)), yaw: rand() * 6.28 });
    else if (roll < 0.34) for (let k = 0; k < 1 + rand() * 3; k++) looseExtra.push({ k: 'pot', p: at(0.3, (k % 2 ? -1 : 1) * (d.w / 2 + 0.35 + Math.floor(k / 2) * 0.4)), yaw: rand() * 6.28 });
  }
  const mats = {
    brick: lighting.setup(new THREE.MeshStandardMaterial({ color: '#7d4a36', roughness: 0.95 }), 'junk-brick'),
  };
  const group = new THREE.Group();
  for (const k of Object.keys(geo) as (keyof typeof geo)[]) {
    if (!geo[k].length) continue;
    group.add(Object.assign(new THREE.Mesh(mergeGeometries(geo[k].map((g) => (g.index ? g.toNonIndexed() : g)))!, mats[k]), { castShadow: true, receiveShadow: true }));
  }
  return { group, drums };
}
