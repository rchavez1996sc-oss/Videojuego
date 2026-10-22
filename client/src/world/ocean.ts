import * as THREE from 'three';
import { Noise, mulberry32 } from '../core/rng';
import type { Heightfield } from './heightfield';
import type { Lighting } from '../render/lighting';
import type { CoastDef } from './coast';
import { heightTexture } from './terrain';
import { rock } from '../render/textures';

const WATER_PARS = /* glsl */ `
uniform float uTime, uSea, uSize;
uniform sampler2D uHeights;
varying vec3 vWPos;
float waveH(vec2 p, float t) {
  return sin(dot(p, vec2(0.05, 0.12)) - t * 0.9) * 0.35 + sin(dot(p, vec2(-0.11, 0.07)) - t * 1.3) * 0.18
    + sin(dot(p, vec2(0.31, 0.22)) - t * 2.1) * 0.06 + sin(dot(p, vec2(-0.27, 0.41)) - t * 2.7) * 0.04;
}
`;

const WATER_MAP = /* glsl */ `
float ground = texture2D(uHeights, vWPos.xz / uSize + 0.5).r;
float depth = uSea - ground;
float inField = step(abs(vWPos.x), uSize * 0.5) * step(abs(vWPos.z), uSize * 0.5);
depth = mix(30.0, depth, inField);
vec2 e = vec2(0.6, 0.0);
float h0 = waveH(vWPos.xz, uTime);
vec3 nW = normalize(vec3(h0 - waveH(vWPos.xz + e.xy, uTime), e.x, h0 - waveH(vWPos.xz + e.yx, uTime)));
float camD = length(vWPos - cameraPosition);
nW = normalize(mix(nW, vec3(0.0, 1.0, 0.0), smoothstep(80.0, 900.0, camD)));
float shallow = 1.0 - smoothstep(0.0, 6.0, depth);
vec3 deep = vec3(0.04, 0.16, 0.2), mid = vec3(0.1, 0.32, 0.33);
vec3 waterC = mix(deep, mid, shallow * 0.8);
float surf = smoothstep(0.55, 0.95, sin(depth * 0.9 + uTime * 1.6 + vWPos.x * 0.02)) * (1.0 - smoothstep(1.5, 7.0, depth));
float edgeFoam = 1.0 - smoothstep(0.0, 0.9, depth + sin(uTime * 1.3 + vWPos.x * 0.15) * 0.25);
float foam = clamp(max(surf * 0.8, edgeFoam), 0.0, 1.0) * inField;
diffuseColor.rgb = mix(waterC, vec3(0.86, 0.9, 0.9), foam);
diffuseColor.a = mix(0.9, 1.0, foam) * smoothstep(-0.2, 0.25, depth);
`;

/** Pacific: animated waves, depth-tinted shallows and surf from the terrain heights, plus the far coast and headland. */
export function buildOcean(hf: Heightfield, c: CoastDef, lighting: Lighting): THREE.Group {
  const group = new THREE.Group();
  const uniforms = { uTime: { value: 0 }, uSea: { value: c.sea }, uSize: { value: hf.size }, uHeights: { value: heightTexture(hf) } };
  const mat = lighting.setup(new THREE.MeshStandardMaterial({ roughness: 0.06, metalness: 0.1, transparent: true }), 'ocean', (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${WATER_PARS}`)
      .replace('#include <map_fragment>', WATER_MAP)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(0.05, 0.9, foam);')
      .replace('#include <normal_fragment_maps>', 'normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);');
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000, 1, 1).rotateX(-Math.PI / 2), mat);
  water.position.set(0, c.sea, 4500 - hf.half + c.shore - 60);
  water.onBeforeRender = () => (uniforms.uTime.value = performance.now() / 1000);
  water.receiveShadow = true;
  group.add(water);
  group.add(farCoast(hf, c, lighting));
  return group;
}

/** Plateau, cliff band and a headland beyond the heightfield so the bay does not end in the void. */
function farCoast(hf: Heightfield, c: CoastDef, lighting: Lighting): THREE.Group {
  const g = new THREE.Group(), r = rock(), noise = new Noise(77), rand = mulberry32(3);
  const cliffMat = lighting.setup(new THREE.MeshStandardMaterial({ map: r.map, color: '#b3a084', roughness: 0.95 }), 'farcliff');
  const landMat = lighting.setup(new THREE.MeshStandardMaterial({ color: '#7d7a70', roughness: 1 }), 'farland');
  const h = hf.half - 1, far = 4500, coastZ = c.edge - 4;
  for (const [x0, x1, z0, z1] of [[-far, -h, -far, coastZ], [h, far, -far, coastZ], [-h, h, -far, -h]]) {
    const land = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), landMat);
    land.position.set((x0 + x1) / 2, -0.6, (z0 + z1) / 2);
    g.add(land);
  }
  const bay = (x: number) => c.edge + (x > 0 ? Math.pow(Math.max(0, x - hf.half) / 900, 2) * 520 : 0);
  for (const [x0, x1] of [[-4000, -hf.half + 2], [hf.half - 2, 1500]]) {
    const pos: number[] = [], uv: number[] = [];
    const steps = Math.ceil((x1 - x0) / 12);
    for (let i = 0; i <= steps; i++) {
      const x = x0 + ((x1 - x0) * i) / steps, z = bay(x) + noise.fbm(x, 0, 1 / 60, 3) * 8;
      for (const [dz, y] of [[0, 0], [c.run * 0.45, -c.drop * 0.55], [c.run, -c.drop], [c.run + 30, -c.drop - 1]]) pos.push(x, y + (dz && dz < c.run ? noise.fbm(x, dz, 1 / 15, 2) * 3 : 0), z + dz);
      for (const v of [0, 0.4, 1, 1.2]) uv.push(x / 25, v * 2);
    }
    const idx: number[] = [];
    for (let i = 0; i < steps; i++) for (let k = 0; k < 3; k++) {
      const a = i * 4 + k, b = a + 4;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, cliffMat));
  }
  const hill = new THREE.PlaneGeometry(900, 700, 70, 56).rotateX(-Math.PI / 2);
  const p = hill.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), d = Math.hypot(x / 450, z / 350);
    p.setY(i, d >= 1 ? -6 : Math.pow(1 - d, 0.55) * 190 * (0.8 + 0.3 * noise.ridged(x, z, 1 / 140, 4)) - 6 + rand() * 1.5);
  }
  hill.computeVertexNormals();
  const morro = new THREE.Mesh(hill, cliffMat);
  morro.position.set(1650, c.sea, 1150);
  g.add(morro);
  return g;
}
