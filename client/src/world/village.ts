import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { mulberry32 } from '../core/rng';
import type { Heightfield } from './heightfield';
import type { ChapterDef } from '../data/types';
import type { Lighting } from '../render/lighting';
import { adobe, roofTiles, wood, rock } from '../render/textures';
import { Builder, type Opening } from './buildingKit';

const UP = new THREE.Vector3(0, 1, 0);

interface Footprint { x: number; z: number; r: number }

function house(b: Builder, rand: () => number, x: number, z: number, y: number, rot: number, w: number, d: number, h: number): void {
  const q = new THREE.Quaternion().setFromAxisAngle(UP, rot);
  const at = (lx: number, ly: number, lz: number) => new THREE.Vector3(lx, ly, lz).applyQuaternion(q).add(new THREE.Vector3(x, y, z));
  const t = 0.45, sink = 1.2, hh = h + sink;
  const door: Opening = { x: (rand() - 0.5) * (w - 2.5), w: 1.1, y: sink, h: 2.1 };
  const win = (px: number): Opening => ({ x: px, w: 0.9, y: sink + 1.0, h: 1.0 });
  const front = [door, ...(w > 6 ? [win(door.x > 0 ? -w / 4 : w / 4)] : [])];
  b.wall('adobe', w, hh, t, at(0, -sink, d / 2 - t / 2), rot, front);
  b.wall('adobe', w, hh, t, at(0, -sink, -d / 2 + t / 2), rot + Math.PI, rand() > 0.4 ? [win(0)] : []);
  b.wall('adobe', d - t * 2, hh, t, at(w / 2 - t / 2, -sink, 0), rot + Math.PI / 2, rand() > 0.5 ? [win(0)] : []);
  b.wall('adobe', d - t * 2, hh, t, at(-w / 2 + t / 2, -sink, 0), rot - Math.PI / 2);
  b.box('stone', [w + 0.1, sink + 0.45, d + 0.1], at(0, -sink / 2 + 0.2, 0), q, false);
  b.box('floor', [w - t * 2, 0.1, d - t * 2], at(0, 0.05, 0), q, false);

  const ruined = rand() < 0.35;
  const pitch = 0.42, over = 0.5;
  const half = d / 2 + over, slab = half / Math.cos(pitch);
  for (const side of [1, -1]) {
    if (ruined && side === -1) continue;
    const sq = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), side * pitch));
    const c = at(0, h + Math.tan(pitch) * half / 2, side * half / 2);
    b.box('roof', [w + over * 2, 0.14, slab], c, sq);
    b.box('wood', [w + over * 2 - 0.1, 0.16, slab - 0.1], c.clone().add(new THREE.Vector3(0, -0.14, 0)), sq, false);
  }
  const ridgeH = Math.tan(pitch) * (d / 2);
  for (const side of [1, -1]) b.gable('adobe', d, ridgeH, t, at(side * (w / 2 - t / 2), h, 0), q);
  if (ruined) {
    for (let i = 0; i < 6; i++) {
      const rq = new THREE.Quaternion().setFromEuler(new THREE.Euler(rand() - 0.5, rand() * 3, rand() - 0.5));
      b.box(rand() > 0.5 ? 'roof' : 'wood', [0.6 + rand(), 0.1 + rand() * 0.1, 0.4 + rand()], at((rand() - 0.5) * w * 0.7, 0.2, (rand() - 0.5) * d * 0.7), rq, false);
    }
  }
}

function church(b: Builder, x: number, z: number, y: number, rot: number): void {
  const q = new THREE.Quaternion().setFromAxisAngle(UP, rot);
  const at = (lx: number, ly: number, lz: number) => new THREE.Vector3(lx, ly, lz).applyQuaternion(q).add(new THREE.Vector3(x, y, z));
  const w = 10, d = 22, h = 7, t = 0.8, sink = 1.2;
  b.wall('plaster', w, h + sink, t, at(0, -sink, d / 2), rot, [{ x: 0, w: 2.2, y: sink, h: 3.6 }]);
  b.wall('plaster', w, h + sink, t, at(0, -sink, -d / 2), rot + Math.PI);
  for (const s of [1, -1]) {
    const wins = [-6, 0, 6].map((p) => ({ x: p, w: 1.1, y: sink + 3, h: 2.4 }));
    b.wall('plaster', d - t, h + sink, t, at(s * (w / 2), -sink, 0), rot + s * Math.PI / 2, wins);
  }
  const pitch = 0.5, half = w / 2 + 0.6, slab = half / Math.cos(pitch);
  for (const s of [1, -1]) {
    const sq = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -s * pitch));
    b.box('roof', [slab, 0.2, d + 1.2], at(s * half / 2, h + Math.tan(pitch) * half / 2, 0), sq);
  }
  for (const s of [1, -1]) b.gable('plaster', w, Math.tan(pitch) * (w / 2), t, at(0, h, s * (d / 2)), q, true);
  const tw = 4.2, th = 15, tz = d / 2 + tw / 2 - 0.4, tx = w / 2 - tw / 2 + 0.6;
  b.box('plaster', [tw, th + sink, tw], at(tx, (th - sink) / 2, tz), q);
  b.box('plaster', [tw + 0.4, 0.4, tw + 0.4], at(tx, th, tz), q, false);
  for (const [px, pz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    b.box('plaster', [0.6, 2.6, 0.6], at(tx + px * (tw / 2 - 0.3), th + 1.5, tz + pz * (tw / 2 - 0.3)), q, false);
  }
  b.box('plaster', [tw + 0.4, 0.4, tw + 0.4], at(tx, th + 3, tz), q, false);
  b.box('roof', [tw - 0.4, 1.6, tw - 0.4], at(tx, th + 4, tz), q, false);
  b.box('wood', [0.15, 1.4, 0.15], at(tx, th + 5.4, tz), q, false);
  b.box('wood', [0.8, 0.15, 0.15], at(tx, th + 5.7, tz), q, false);
  b.box('stone', [w + 1, sink + 0.6, d + 1], at(0, -sink / 2 + 0.3, 0), q, false);
}

function buildPircas(b: Builder, hf: Heightfield, rand: () => number, v: NonNullable<ChapterDef['village']>, footprints: Footprint[]): void {
  for (let n = 0, tries = 0; n < 26 && tries < 400; tries++) {
    const a = rand() * Math.PI * 2, dist = v.radius * (0.6 + rand() * 1.6);
    let x = v.x + Math.cos(a) * dist, z = v.z + Math.sin(a) * dist;
    const dir = a + Math.PI / 2 + (rand() - 0.5) * 0.6;
    const len = 14 + rand() * 26;
    const ex = x + Math.cos(dir) * len, ez = z + Math.sin(dir) * len;
    const blocked = (px: number, pz: number) => hf.maskAt(px, pz, 0) > 0.05 || footprints.some((f) => Math.hypot(f.x - px, f.z - pz) < f.r + 1);
    if (blocked(x, z) || blocked(ex, ez) || blocked((x + ex) / 2, (z + ez) / 2)) continue;
    const yaw = -dir;
    const q = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
    for (let t = 0; t < len; t += 0.45 + rand() * 0.2) {
      const px = x + Math.cos(dir) * t, pz = z + Math.sin(dir) * t, gy = hf.heightAt(px, pz);
      for (let layer = 0; layer < 3; layer++) {
        const sq = new THREE.Quaternion().setFromEuler(new THREE.Euler((rand() - 0.5) * 0.3, yaw + (rand() - 0.5) * 0.4, (rand() - 0.5) * 0.3));
        const sz = 0.35 + rand() * 0.25;
        b.box('stone', [sz * 1.3, sz * 0.8, sz], new THREE.Vector3(px + (rand() - 0.5) * 0.15, gy + 0.15 + layer * 0.33, pz + (rand() - 0.5) * 0.15), sq, false);
      }
    }
    const mid = new THREE.Vector3((x + ex) / 2, hf.heightAt((x + ex) / 2, (z + ez) / 2) + 0.55, (z + ez) / 2);
    b.box('none', [len, 1.1, 0.6], mid, q, true);
    x = ex; z = ez;
    n++;
  }
}

export function buildVillage(hf: Heightfield, v: NonNullable<ChapterDef['village']>, terrain: ChapterDef['terrain'], lighting: Lighting, world: RAPIER.World): { group: THREE.Group; footprints: Footprint[] } {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const b = new Builder(world, body);
  const rand = mulberry32(terrain.seed + 7);
  const footprints: Footprint[] = [{ x: v.church.x, z: v.church.z, r: 16 }];
  church(b, v.church.x, v.church.z, hf.heightAt(v.church.x, v.church.z), v.church.rot);
  const tryHouse = (x: number, z: number, faceX: number, faceZ: number, row: number): boolean => {
    const w = 5 + rand() * 4, d = 4.5 + rand() * 2.5;
    const r = Math.max(w, d) / 2 + 0.6;
    if (Math.hypot(x - v.x, z - v.z) > v.radius) return false;
    if (hf.maskAt(x, z, 0) > 0.02 || footprints.some((f) => Math.hypot(f.x - x, f.z - z) < f.r + r)) return false;
    const rot = Math.atan2(faceX - x, faceZ - z) + (rand() - 0.5) * 0.08 * row;
    house(b, rand, x, z, hf.heightAt(x, z), rot, w, d, 2.7 + rand() * 0.6);
    footprints.push({ x, z, r });
    return true;
  };
  const road = terrain.road;
  let placed = 0;
  for (let i = 0; i < road.length - 1 && placed < v.houses; i++) {
    const [ax, az] = road[i], [bx, bz] = road[i + 1];
    const len = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / len, dz = (bz - az) / len;
    for (let t = 0; t < len && placed < v.houses; t += 9 + rand() * 4) {
      const px = ax + dx * t, pz = az + dz * t;
      for (const side of [1, -1]) {
        for (const row of [0, 1]) {
          if (rand() < (row ? 0.45 : 0.15)) continue;
          const off = (9.5 + row * 12 + rand() * 2) * side;
          if (tryHouse(px - dz * off, pz + dx * off, row ? px - dz * off * 0.5 : px, row ? pz + dx * off * 0.5 : pz, row)) placed++;
        }
      }
    }
  }
  buildPircas(b, hf, rand, v, footprints);
  const ad = adobe(), rf = roofTiles(), wd = wood(), st = rock();
  const std = (key: string, p: THREE.MeshStandardMaterialParameters) => lighting.setup(new THREE.MeshStandardMaterial(p), key);
  const mats = {
    adobe: std('adobe', { map: ad.map, normalMap: ad.normalMap, roughness: 0.92 }),
    plaster: std('plaster', { map: ad.map, normalMap: ad.normalMap, roughness: 0.9, color: '#efe6da' }),
    roof: std('roof', { map: rf.map, normalMap: rf.normalMap, roughness: 0.75 }),
    wood: std('wood', { map: wd.map, normalMap: wd.normalMap, roughness: 0.9 }),
    stone: std('stone', { map: st.map, normalMap: st.normalMap, roughness: 0.9, color: '#9a9088' }),
    floor: std('floor', { color: '#4a3c30', roughness: 1 }),
  };
  const group = new THREE.Group();
  group.add(...b.build(mats, 0.35));
  return { group, footprints };
}
