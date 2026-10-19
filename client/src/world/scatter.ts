import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { createNoise3D } from 'simplex-noise';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32, Noise } from '../core/rng';
import type { Heightfield } from './heightfield';
import type { Lighting } from '../render/lighting';
import { rock } from '../render/textures';
import { treeParts } from './trees';

function rockGeometry(seed: number, detail: number): THREE.BufferGeometry {
  const n3 = createNoise3D(mulberry32(seed));
  const g = mergeVertices(new THREE.IcosahedronGeometry(1, detail).deleteAttribute('normal').deleteAttribute('uv'));
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const colors = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    let d = 1 + n3(v.x * 0.9, v.y * 0.9, v.z * 0.9) * 0.35 + n3(v.x * 2.5, v.y * 2.5, v.z * 2.5) * 0.12;
    d += Math.abs(n3(v.x * 6, v.y * 6, v.z * 6)) * 0.04;
    v.multiplyScalar(d);
    v.y = v.y < -0.2 ? -0.2 + (v.y + 0.2) * 0.2 : v.y;
    v.multiply(new THREE.Vector3(1.3, 0.75, 1));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const nrm = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const up = nrm.getY(i);
    const moss = THREE.MathUtils.smoothstep(up, 0.55, 0.9) * 0.6;
    const ao = 0.55 + 0.45 * THREE.MathUtils.smoothstep(p.getY(i), -0.2, 0.5);
    colors.set([ao * (1 - moss * 0.35), ao * (1 - moss * 0.05), ao * (1 - moss * 0.55)], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) uv.set([p.getX(i) * 0.5 + p.getZ(i) * 0.3, p.getY(i) * 0.5 + p.getZ(i) * 0.2], i * 2);
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

interface Placement { x: number; z: number; y: number; s: number; r: number }

function place(hf: Heightfield, count: number, rand: () => number, accept: (x: number, z: number, slope: number) => boolean): Placement[] {
  const out: Placement[] = [];
  const range = hf.def.playable / 2 + 120;
  for (let tries = 0; out.length < count && tries < count * 30; tries++) {
    const x = (rand() * 2 - 1) * range, z = (rand() * 2 - 1) * range;
    const slope = 1 - hf.normalAt(x, z)[1];
    if (!accept(x, z, slope)) continue;
    out.push({ x, z, y: hf.heightAt(x, z), s: rand(), r: rand() * Math.PI * 2 });
  }
  return out;
}

function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, items: THREE.Matrix4[], shadow = true): THREE.InstancedMesh {
  const m = new THREE.InstancedMesh(geo, mat, items.length);
  items.forEach((mx, i) => m.setMatrixAt(i, mx));
  m.castShadow = shadow;
  m.receiveShadow = true;
  m.computeBoundingSphere();
  return m;
}

export function buildScatter(hf: Heightfield, lighting: Lighting, world: RAPIER.World, opts: { rocks: number; trees: number; seed: number }, avoid: (x: number, z: number) => boolean): THREE.Group {
  const group = new THREE.Group();
  const rand = mulberry32(opts.seed);
  const noise = new Noise(opts.seed);
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const clear = (x: number, z: number) => hf.maskAt(x, z, 0) < 0.1 && hf.maskAt(x, z, 2) < 0.3 && !avoid(x, z);

  const rockTex = rock();
  const rockMat = lighting.setup(new THREE.MeshStandardMaterial({
    map: rockTex.map, normalMap: rockTex.normalMap, vertexColors: true, roughness: 0.88, color: '#b5ab9f',
  }), 'rock');
  const rocks = place(hf, opts.rocks, rand, (x, z, slope) => clear(x, z) && (slope > 0.12 || noise.fbm(x, z, 1 / 60, 2) > 0.25));
  const variants = [1, 2, 3].map((seed) => ({ big: rockGeometry(seed, 3), small: rockGeometry(seed, 1) }));
  const buckets = variants.map(() => ({ big: [] as THREE.Matrix4[], small: [] as THREE.Matrix4[] }));
  const q = new THREE.Quaternion(), e = new THREE.Euler();
  for (const p of rocks) {
    const big = p.s > 0.93;
    const s = big ? 2.5 + p.s * 3.5 : 0.25 + p.s * p.s * 1.6;
    const tilt = hf.normalAt(p.x, p.z);
    e.set(tilt[2] * 0.6, p.r, -tilt[0] * 0.6);
    q.setFromEuler(e);
    const mx = new THREE.Matrix4().compose(new THREE.Vector3(p.x, p.y - s * 0.12, p.z), q, new THREE.Vector3(s, s * (0.8 + p.s * 0.4), s));
    buckets[Math.floor(p.s * 997) % 3][s > 1.2 ? 'big' : 'small'].push(mx);
    if (s > 0.7) world.createCollider(RAPIER.ColliderDesc.ball(s * 0.8).setTranslation(p.x, p.y + s * 0.1, p.z), body);
  }
  variants.forEach((g, i) => {
    group.add(instanced(g.big, rockMat, buckets[i].big));
    group.add(instanced(g.small, rockMat, buckets[i].small, false));
  });

  const parts = treeParts(lighting);
  const trees = place(hf, opts.trees, rand, (x, z, slope) =>
    clear(x, z) && slope < 0.3 && noise.fbm(x + 99, z, 1 / 110, 3) > 0.05 && hf.heightAt(x, z) < hf.def.mountainHeight * 0.45);
  const trunkM: THREE.Matrix4[][] = parts.map(() => []);
  for (const p of trees) {
    const v = Math.floor(p.s * 1000) % parts.length;
    const s = 0.8 + p.s * 0.6;
    q.setFromEuler(e.set(0, p.r, 0));
    trunkM[v].push(new THREE.Matrix4().compose(new THREE.Vector3(p.x, p.y - 0.2, p.z), q, new THREE.Vector3(s, s, s)));
    world.createCollider(RAPIER.ColliderDesc.cylinder(2, 0.25 * s).setTranslation(p.x, p.y + 2, p.z), body);
  }
  parts.forEach((part, i) => {
    if (!trunkM[i].length) return;
    group.add(instanced(part.trunk, part.barkMat, trunkM[i]));
    group.add(instanced(part.canopy, part.leafMat, trunkM[i]));
  });
  return group;
}
