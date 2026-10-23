import * as THREE from 'three';
import { mulberry32 } from '../core/rng';
import type { Heightfield } from './heightfield';
import type { Lighting } from '../render/lighting';

export interface FarCityDef { inner: number; outer: number; count: number; maxHeight: number; seed: number; avenueHalf: number; tall?: boolean; innerNorth?: number }

const TALL_COLORS = ['#ebe8e1', '#ddd5c4', '#cfd1d3', '#c8d5e2', '#e6dccb', '#b7c4cc'];

/** Windows by world position (6 m tiles) so towers of any size keep storey-sized windows. */
const WORLD_UV = /* glsl */ `
vec3 an = abs(vWN);
vec2 wuv = (an.x > an.z ? vWP.zy : vWP.xy) / 6.0;
diffuseColor.rgb *= texture2D(map, wuv).rgb;
`;

const COLORS = ['#8c5440', '#7f4c3b', '#93593f', '#7a4636', '#8c5440', '#86817a', '#9a958c', '#7c8c96', '#b09a62', '#a8807a', '#a39c8a'];

/** Pale facade with a grid of dark windows and slab lines; instance colour tints it. */
function facadeTexture(): THREE.CanvasTexture {
  const s = 256, c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#d8d4cc';
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.08})`;
    ctx.fillRect(Math.random() * s, Math.random() * s, 2 + Math.random() * 8, 2 + Math.random() * 4);
  }
  for (let f = 0; f < 3; f++) {
    ctx.fillStyle = 'rgba(120,115,108,0.9)';
    ctx.fillRect(0, f * 85, s, 7);
    for (let w = 0; w < 3; w++) {
      if (Math.random() < 0.25) continue;
      ctx.fillStyle = '#23272b';
      ctx.fillRect(20 + w * 80, f * 85 + 26, 40, 34);
      ctx.fillStyle = 'rgba(40,40,40,0.9)';
      for (let k = 1; k < 5; k++) ctx.fillRect(20 + w * 80 + k * 8, f * 85 + 26, 2, 34);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Decorative city beyond the playable edge: thousands of instanced houses climbing the hills,
 * leaving the avenue corridor open so the street keeps going into the haze. No colliders.
 */
export function buildFarCity(hf: Heightfield, def: FarCityDef, lighting: Lighting): THREE.InstancedMesh {
  const rand = mulberry32(def.seed);
  const tex = facadeTexture();
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const mat = lighting.setup(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }), def.tall ? 'farcity-tall' : 'farcity', def.tall ? (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nvarying vec3 vWN;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nvWP = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\nvWN = mat3(modelMatrix * instanceMatrix) * objectNormal;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nvarying vec3 vWN;').replace('#include <map_fragment>', WORLD_UV);
  } : undefined);
  const coast = hf.def.coast;
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), mat, def.count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), color = new THREE.Color();
  let n = 0;
  for (let tries = 0; n < def.count && tries < def.count * 6; tries++) {
    const x = (rand() * 2 - 1) * def.outer, z = (rand() * 2 - 1) * def.outer;
    if (Math.max(Math.abs(x), Math.abs(z)) < def.inner && !(def.innerNorth && z < -def.innerNorth)) continue;
    if (Math.abs(z) < def.avenueHalf && Math.abs(x) > def.inner - 10) continue;
    if (coast && z > coast.edge - 25) continue;
    const ground = hf.heightAt(x, z);
    if (ground > def.maxHeight || hf.normalAt(x, z, 4)[1] < 0.55) continue;
    const nearAvenue = Math.abs(z) < 60;
    const w = def.tall ? 14 + rand() * 12 : 5 + rand() * 4, d = def.tall ? 14 + rand() * 10 : 6 + rand() * 6;
    const floors = def.tall ? 5 + Math.floor(rand() * rand() * 22) : nearAvenue && rand() < 0.2 ? 3 + Math.floor(rand() * 3) : 1 + Math.floor(rand() * 2.4);
    const yaw = nearAvenue ? (rand() < 0.5 ? 0 : Math.PI) + (rand() - 0.5) * 0.05 : (rand() - 0.5) * 0.6 + (z > 0 ? Math.PI : 0);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    m.compose(new THREE.Vector3(x, ground - 1.2, z), q, new THREE.Vector3(w, floors * (def.tall ? 3 : 2.7) + 1.2, d));
    mesh.setMatrixAt(n, m);
    const palette = def.tall ? TALL_COLORS : COLORS;
    mesh.setColorAt(n, color.set(palette[Math.floor(rand() * palette.length)]).multiplyScalar(0.75 + rand() * 0.25));
    n++;
  }
  mesh.count = n;
  mesh.receiveShadow = false;
  mesh.castShadow = false;
  mesh.frustumCulled = false;
  return mesh;
}
