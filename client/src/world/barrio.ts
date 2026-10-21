import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../core/rng';
import type { Heightfield } from './heightfield';
import type { Lighting } from '../render/lighting';
import { Builder } from './buildingKit';
import { cityHouse, hillHouse, PAINTS, type Lot } from './houses';
import { powerLine, cable, mototaxi, sandbags, stairway, car, billboard, type CarKind } from './urbanProps';
import { SignAtlas } from './signs';
import { buildStation, type StationDef, type StationInfo } from './station';
import { buildLadder } from './ladders';
import { flsMarks, poleMarks } from './flsMarks';
import { alleyLife } from './alleys';
import { STREET_COLORS, stall, trashPile, roadMarkings } from './streetLife';
import { brick, concrete, plaster, corrugated, estera } from '../render/urbanTextures';
import { rock, wood } from '../render/textures';

export interface BarrioDef {
  seed: number;
  x0: number; cols: number; blockW: number; blockD: number; street: number; gap: number;
  hills: { zMin: number; zMax: number; count: number; xMax: number };
  stairs: [number, number, number][];
  landmark: { x: number; z: number; w: number; d: number; floors: number; facing: number };
  station?: StationDef;
  barricades: [number, number, number, number][];
  mototaxis: number;
  cars: number;
  billboardEvery: number;
  hillLetters: [number, number, number][];
  hillEmblems?: [number, number, number][];
}

export interface StreetGraph { nodes: THREE.Vector3[]; edges: [number, number][]; exits: number[] }

export interface Barrio {
  group: THREE.Group;
  graph: StreetGraph;
  blocked: (x: number, z: number) => boolean;
  materials: Record<string, THREE.Material>;
  bake: { material: THREE.Material; keys: string[] }[];
  station: StationInfo | null;
}

const PAINT_COLORS = ['#9fc3d6', '#e3c46a', '#d9a3a0', '#9cc29a', '#e6dac0', '#d99a63'];

function materials(lighting: Lighting, atlas: SignAtlas): Record<string, THREE.Material> {
  const br = brick(), co = concrete(), pl = plaster(), ca = corrugated(), es = estera(), st = rock(), wd = wood();
  const std = (key: string, p: THREE.MeshStandardMaterialParameters) => lighting.setup(new THREE.MeshStandardMaterial(p), key);
  const m: Record<string, THREE.Material> = {
    brick: std('brick', { map: br.map, normalMap: br.normalMap, roughness: 0.92 }),
    concrete: std('concrete', { map: co.map, normalMap: co.normalMap, roughness: 0.95, color: '#a39d92' }),
    wood: std('beam', { map: co.map, normalMap: co.normalMap, roughness: 0.95, color: '#cfcac0' }),
    calamina: std('calamina', { map: ca.map, normalMap: ca.normalMap, roughness: 0.6, metalness: 0.5 }),
    estera: std('estera', { map: es.map, normalMap: es.normalMap, roughness: 1 }),
    stone: std('stone-b', { map: st.map, normalMap: st.normalMap, roughness: 0.9, color: '#a59c90' }),
    door: std('door', { map: ca.map, roughness: 0.55, metalness: 0.6, color: '#3d5a52' }),
    shutter: std('shutter', { map: ca.map, normalMap: ca.normalMap, roughness: 0.5, metalness: 0.6, color: '#8d8f90' }),
    glass: std('glass', { color: '#1a2026', roughness: 0.15, metalness: 0.6 }),
    bars: std('bars', { color: '#202224', roughness: 0.5, metalness: 0.7 }),
    rebar: std('rebar', { color: '#5a3d2c', roughness: 0.8, metalness: 0.4 }),
    tankBlack: std('tankBlack', { color: '#1b1b1d', roughness: 0.45 }),
    tankBlue: std('tankBlue', { color: '#2a5794', roughness: 0.45 }),
    pole: std('pole', { map: wd.map, color: '#7b6a58', roughness: 0.9 }),
    cable: std('cable', { color: '#111111', roughness: 0.6 }),
    paintYellow: std('paintYellow', { color: '#d9b42a', roughness: 0.7 }),
    canopy: std('canopy', { color: '#2b2f6b', roughness: 0.7 }),
    seat: std('seat', { color: '#2a2a2a', roughness: 0.6 }),
    tire: std('tire', { color: '#151515', roughness: 0.85 }),
    policeGreen: std('policeGreen', { map: pl.map, normalMap: pl.normalMap, roughness: 0.9, color: '#4f7a5c' }),
    armsCrate: std('arms-crate', { map: wd.map, color: '#3e4228', roughness: 0.8 }),
    doorRed: std('doorRed', { map: ca.map, roughness: 0.55, metalness: 0.5, color: '#8e1b14' }),
    sandbag: std('sandbag', { map: es.map, color: '#a69673', roughness: 1 }),
    moto0: std('moto0', { color: '#b3221d', roughness: 0.35, metalness: 0.3 }),
    moto1: std('moto1', { color: '#1f5fa8', roughness: 0.35, metalness: 0.3 }),
    moto2: std('moto2', { color: '#d4a21c', roughness: 0.35, metalness: 0.3 }),
    stripe: std('stripe', { color: '#b8261b', roughness: 0.5 }),
    checker: std('checker', { color: '#111111', roughness: 0.5 }),
    light: std('light', { color: '#f4efe0', roughness: 0.2, emissive: '#3a3628' }),
    rim: std('rim', { color: '#9a9ea3', roughness: 0.35, metalness: 0.8 }),
    plate: std('plate', { color: '#e8e4d2', roughness: 0.5 }),
    tail: std('tail', { color: '#9c1a14', roughness: 0.3, emissive: '#2a0402' }),
    plastic: std('plastic', { color: '#1d1e20', roughness: 0.7 }),
    car0: std('car0', { color: '#c9c6bf', roughness: 0.3, metalness: 0.4 }),
    car1: std('car1', { color: '#2a2c30', roughness: 0.3, metalness: 0.4 }),
    car2: std('car2', { color: '#7a1d1a', roughness: 0.35, metalness: 0.4 }),
    car3: std('car3', { color: '#e2c22e', roughness: 0.35, metalness: 0.3 }),
    car4: std('car4', { color: '#2b4c7a', roughness: 0.35, metalness: 0.4 }),
    car5: std('car5', { color: '#eeeeea', roughness: 0.35, metalness: 0.3 }),
    signs: std('signs', { map: atlas.texture, transparent: true, alphaTest: 0.1, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2 }),
  };
  PAINTS.forEach((k, i) => (m[k] = std(k, { map: pl.map, normalMap: pl.normalMap, roughness: 0.9, color: PAINT_COLORS[i] })));
  for (const [k, c] of Object.entries(STREET_COLORS)) m[k] = std(k, { color: c, roughness: 0.7 });
  return m;
}

export function buildBarrio(hf: Heightfield, def: BarrioDef, lighting: Lighting, world: RAPIER.World): Barrio {
  const b = new Builder(world, world.createRigidBody(RAPIER.RigidBodyDesc.fixed()));
  const rand = mulberry32(def.seed), deco = mulberry32(def.seed + 7), alley = mulberry32(def.seed + 13);
  const atlas = new SignAtlas();
  const pitch = def.blockW + def.street;
  const lm = def.landmark, st = def.station;
  const inLandmark = (x0: number, x1: number, z: number) => x1 > lm.x - lm.w / 2 - 1.6 && x0 < lm.x + lm.w / 2 + 1.6 && Math.abs(z - lm.z) < lm.d + 2 && Math.sign(z) === Math.sign(lm.z);
  const sign = (at: THREE.Vector3, q: THREE.Quaternion, w: number) => atlas.add(at, q, w, 'shop', rand);

  const rowsZ: [number, number][] = [];
  for (const s of [1, -1]) {
    for (let r = 0; r < 2; r++) {
      const a = s * (def.gap + r * (def.blockD + def.street)), c = a + s * def.blockD;
      rowsZ.push([Math.min(a, c), Math.max(a, c)]);
    }
  }
  for (let col = 0; col < def.cols; col++) {
    const bx0 = def.x0 + col * pitch, bx1 = bx0 + def.blockW;
    for (const [z0, z1] of rowsZ) {
      const special = inLandmark(bx0, bx1, z0) || inLandmark(bx0, bx1, z1) || (st && bx0 < st.x + st.w / 2 + 2 && bx1 > st.x - st.w / 2 - 2 && st.z > z0 - 6 && st.z < z1 + 6);
      const pass = special || alley() > 0.45 ? null : { at: bx0 + 12 + alley() * (def.blockW - 24), w: 2.4 + alley() * 0.8 };
      const backW = special || alley() > 0.35 ? 0 : 2.2 + alley() * 0.6;
      const spans = pass ? [[bx0, pass.at - pass.w / 2], [pass.at + pass.w / 2, bx1]] : [[bx0, bx1]];
      for (const [frontZ, facing] of [[z0, Math.PI], [z1, 0]] as const) for (const [s0, s1] of spans) {
        let x = s0;
        while (s1 - x > 4) {
          const w = s1 - x < 13 ? s1 - x : 6 + rand() * 3;
          const cx = x + w / 2;
          const worldSide = x === s0 ? -1 : x + w >= s1 - 0.01 ? 1 : 0;
          x += w;
          if (inLandmark(cx - w / 2, cx + w / 2, frontZ) || (st && x - w < st.x + st.w / 2 && x > st.x - st.w / 2 && Math.abs(frontZ - st.z) < 1)) continue;
          const lot: Lot = { x: cx, z: frontZ, y: hf.heightAt(cx, frontZ), facing, w, d: (z1 - z0 - backW) / 2 - 0.04 };
          const red = deco() < 0.12;
          flsMarks(b, hf, atlas, lot, cityHouse(b, lot, rand, sign, facing === 0 ? worldSide : -worldSide, red), red, worldSide, deco);
          if (rand() < 0.18) {
            const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), facing);
            atlas.add(new THREE.Vector3(0, 1.4 + rand() * 0.6, 0.03).applyQuaternion(q).add(new THREE.Vector3(cx, lot.y, frontZ)), q, Math.min(w - 1, 3.6), 'graffiti', rand);
          } else if (rand() < 0.45) {
            const l = -w / 2 + 2.15, r = Math.min(w / 4 - 0.7, w / 2 - 3.65), pw = Math.min(r - l, 2.4);
            const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), facing);
            if (pw > 1.3) atlas.add(new THREE.Vector3((l + r) / 2, 1.45, 0.03).applyQuaternion(q).add(new THREE.Vector3(cx, lot.y, frontZ)), q, pw, rand() < 0.5 ? 'concert' : 'red', rand);
          }
        }
      }
      alleyLife(b, hf, bx0, bx1, z0, z1, pass, backW, alley);
    }
  }
  cityHouse(b, { x: lm.x, z: lm.z, y: hf.heightAt(lm.x, lm.z), facing: lm.facing, w: lm.w, d: lm.d, floors: lm.floors }, rand, sign);
  const station = st ? buildStation(b, hf, atlas, st, rand) : null;
  const back = Math.sign(lm.z) || 1, lx = lm.x - lm.w / 2 - 0.3, lz = lm.z + back * 2.5;
  buildLadder(b, new THREE.Vector3(lx, hf.heightAt(lx, lz), lz), hf.heightAt(lm.x, lm.z) + lm.floors * 2.7, new THREE.Vector3(-1, 0, 0));

  const xEnd = def.x0 + def.cols * pitch - def.street;
  for (const s of [1, -1]) {
    for (let col = 0; col < def.cols; col++) {
      const bx0 = def.x0 + col * pitch;
      b.box('concrete', [def.blockW, 0.18, 2.4], new THREE.Vector3(bx0 + def.blockW / 2, hf.heightAt(bx0, s * 9.4) + 0.06, s * 9.4), new THREE.Quaternion());
    }
    const poles: THREE.Vector3[] = [];
    for (let x = def.x0 - 20; x < xEnd + 20; x += 31) poles.push(new THREE.Vector3(x, 0, s * 9.9));
    powerLine(b, hf, poles, rand);
    poleMarks(atlas, hf, poles, s, deco);
    for (const p of poles) {
      if (rand() < 0.5) continue;
      const top = new THREE.Vector3(p.x, hf.heightAt(p.x, p.z) + 6.8, p.z);
      cable(b, top, new THREE.Vector3(p.x + (rand() - 0.5) * 10, hf.heightAt(p.x, p.z) + 2.8 + rand() * 2.5, s * (def.gap + 0.1)), 0.4 + rand() * 0.6);
    }
  }

  const hillSpots: { x: number; z: number; r: number }[] = [];
  const nearStairs = (x: number) => def.stairs.some(([sx]) => Math.abs(sx - x) < 4);
  for (let i = 0, tries = 0; i < def.hills.count && tries < def.hills.count * 25; tries++) {
    const s = rand() < 0.5 ? 1 : -1;
    const x = (rand() * 2 - 1) * def.hills.xMax, z = s * (def.hills.zMin + rand() * (def.hills.zMax - def.hills.zMin));
    const w = 4.5 + rand() * 1.8, d = 5 + rand() * 1.5;
    if (nearStairs(x) || hillSpots.some((h) => Math.hypot(h.x - x, h.z - z) < h.r + 4.5)) continue;
    const hs = [[-w / 2, 0], [w / 2, 0], [-w / 2, s * d], [w / 2, s * d]].map(([dx, dz]) => hf.heightAt(x + dx, z + dz));
    const lo = Math.min(...hs), hi = Math.max(...hs);
    if (hi - lo > 3.4) continue;
    hillHouse(b, { x, z, y: hi, facing: s > 0 ? Math.PI : 0, w, d }, rand, lo);
    hillSpots.push({ x, z: z + s * d / 2, r: Math.max(w, d) / 2 + 1 });
    i++;
  }
  for (const [x, z0, z1] of def.stairs) stairway(b, hf, x, z0, z1);
  for (const [x, z, yaw, len] of def.barricades) sandbags(b, hf, x, z, yaw, len);

  const crossX = Array.from({ length: def.cols + 1 }, (_, k) => def.x0 - def.street / 2 + k * pitch);
  for (let i = 0; i < def.mototaxis; i++) {
    const onAvenue = rand() < 0.6;
    const x = onAvenue ? def.x0 + rand() * (xEnd - def.x0) : crossX[Math.floor(rand() * crossX.length)] + (rand() < 0.5 ? -3 : 3);
    const z = onAvenue ? (rand() < 0.5 ? -6.6 : 6.6) : (rand() < 0.5 ? 1 : -1) * (def.gap + rand() * def.blockD * 1.8);
    mototaxi(b, new THREE.Vector3(x, hf.heightAt(x, z), z), onAvenue ? Math.PI / 2 + (rand() < 0.5 ? 0 : Math.PI) : rand() < 0.5 ? 0 : Math.PI, `moto${i % 3}`);
  }

  const kinds: CarKind[] = ['sedan', 'sedan', 'tico', 'tico', 'wagon', 'pickup', 'combi'];
  const midZ = def.gap + def.blockD + def.street / 2;
  for (let i = 0; i < def.cars; i++) {
    const kind = kinds[Math.floor(rand() * kinds.length)];
    const paint = kind === 'tico' ? 'car3' : kind === 'combi' ? 'car5' : `car${Math.floor(rand() * 6)}`;
    const r = rand();
    let x: number, z: number, yaw: number;
    if (r < 0.45) {
      x = def.x0 + rand() * (xEnd - def.x0);
      z = (rand() < 0.5 ? -1 : 1) * 6.9;
      yaw = Math.PI / 2 + (z > 0 ? Math.PI : 0);
    } else if (r < 0.75) {
      x = crossX[Math.floor(rand() * crossX.length)] + (rand() < 0.5 ? -3.2 : 3.2);
      z = (rand() < 0.5 ? 1 : -1) * (def.gap + 4 + rand() * (def.blockD * 2 + def.street - 8));
      yaw = rand() < 0.5 ? 0 : Math.PI;
    } else {
      x = def.x0 + rand() * (xEnd - def.x0);
      z = (rand() < 0.5 ? 1 : -1) * (midZ + (rand() < 0.5 ? -3.2 : 3.2));
      yaw = Math.PI / 2 + (rand() < 0.5 ? 0 : Math.PI);
    }
    if (crossX.some((cx) => Math.abs(cx - x) < 6) && Math.abs(Math.abs(z) - 6.9) < 1) continue;
    car(b, new THREE.Vector3(x, hf.heightAt(x, z), z), yaw + (rand() - 0.5) * 0.06, paint, kind);
  }
  for (let x = def.x0 + 20, k = 0; x < xEnd - 10; x += def.billboardEvery, k++) {
    const side = k % 2 ? 1 : -1;
    if (crossX.some((cx) => Math.abs(cx - x) < 8) || (st && Math.abs(x - st.x) < st.w / 2 + 6 && side * st.z > 0)) continue;
    const bb = billboard(b, hf, x, side * 10.6, side > 0 ? Math.PI : 0);
    atlas.add(bb.pos, bb.q, 8, 'poster', rand);
  }
  for (const [x, z, w, kind] of [...def.hillLetters.map((h) => [...h, 'hill'] as const), ...(def.hillEmblems ?? []).map((h) => [...h, 'emblem'] as const)]) {
    const a = Math.atan2(hf.heightAt(x, z + 4) - hf.heightAt(x, z - 4), 8) * Math.sign(z);
    const X = new THREE.Vector3(-Math.sign(z), 0, 0), Y = new THREE.Vector3(0, Math.sin(a), Math.cos(a) * Math.sign(z));
    const Z = new THREE.Vector3().crossVectors(X, Y);
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
    atlas.add(new THREE.Vector3(x, hf.heightAt(x, z) + (kind === 'emblem' ? 3.5 + w * 0.12 : 3.5), z), q, w, kind, rand);
  }

  roadMarkings(b, hf, def.x0 - 10, xEnd + 10, crossX, 8);
  for (let x = def.x0 + 8; x < xEnd - 8; x += 18 + rand() * 20) {
    if (crossX.some((cx) => Math.abs(cx - x) < 6) || rand() < 0.35) continue;
    const s = rand() < 0.5 ? 1 : -1;
    stall(b, new THREE.Vector3(x, hf.heightAt(x, s * 9.3) + 0.15, s * 9.3), s > 0 ? Math.PI : 0, rand);
  }
  for (let i = 0; i < 90; i++) {
    const x = crossX[Math.floor(rand() * crossX.length)] + (rand() < 0.5 ? -1 : 1) * (3.6 + rand() * 0.6);
    const z = (rand() < 0.5 ? 1 : -1) * (def.gap + rand() * (def.blockD * 2 + def.street));
    trashPile(b, new THREE.Vector3(x, hf.heightAt(x, z), z), rand);
  }

  const group = new THREE.Group();
  const mats = materials(lighting, atlas);
  const pl = plaster();
  const bake = [
    { material: lighting.setup(new THREE.MeshStandardMaterial({ map: pl.map, normalMap: pl.normalMap, roughness: 0.9, vertexColors: true }), 'paint-baked'), keys: PAINTS },
    { material: lighting.setup(new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.35, vertexColors: true }), 'plain-baked'),
      keys: ['car0', 'car1', 'car2', 'car3', 'car4', 'car5', 'moto0', 'moto1', 'moto2', 'tankBlack', 'tankBlue', 'stripe', 'checker', 'canopy', 'seat', 'tire', 'bars', 'rebar', 'cable', 'paintYellow', 'light', 'glass', 'rim', 'plate', 'tail', 'plastic', ...Object.keys(STREET_COLORS)] },
  ];
  group.add(...b.build(mats, 0.5, bake, 128));
  if (atlas.geometries.length) {
    const signs = new THREE.Mesh(mergeGeometries(atlas.geometries), mats.signs);
    signs.receiveShadow = true;
    group.add(signs);
  }
  return { group, materials: mats, bake, station, graph: streetGraph(def, crossX, hf), blocked: (x, z) => Math.abs(z) < def.gap + 2 * def.blockD + def.street + 6 || hillSpots.some((h) => Math.hypot(h.x - x, h.z - z) < h.r + 1.5) };
}

function streetGraph(def: BarrioDef, crossX: number[], hf: Heightfield): StreetGraph {
  const outer = def.gap + 2 * def.blockD + def.street * 1.5, mid = def.gap + def.blockD + def.street / 2;
  const zs = [-outer, -mid, -9.4, 9.4, mid, outer];
  const nodes: THREE.Vector3[] = [], edges: [number, number][] = [];
  const id = (i: number, j: number) => i * zs.length + j;
  crossX.forEach((x) => zs.forEach((z) => nodes.push(new THREE.Vector3(x, hf.heightAt(x, z), z))));
  for (let i = 0; i < crossX.length; i++) {
    for (let j = 0; j < zs.length; j++) {
      if (i + 1 < crossX.length) edges.push([id(i, j), id(i + 1, j)]);
      if (j + 1 < zs.length) edges.push([id(i, j), id(i, j + 1)]);
    }
  }
  const exits = [id(0, 2), id(0, 3), id(crossX.length - 1, 2), id(crossX.length - 1, 3), id(0, 0), id(crossX.length - 1, zs.length - 1)];
  return { nodes, edges, exits };
}
