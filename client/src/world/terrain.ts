import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Heightfield } from './heightfield';
import type { BiomeDef } from '../data/types';
import type { Lighting } from '../render/lighting';
import { rock, soil } from '../render/textures';
import * as S from './terrainShader';

export function buildTerrain(hf: Heightfield, biome: BiomeDef, lighting: Lighting, world: RAPIER.World): THREE.Mesh {
  const { n, step, half, heights } = hf;
  const pos = new Float32Array(n * n * 3);
  const nor = new Float32Array(n * n * 3);
  for (let zi = 0; zi < n; zi++) {
    for (let xi = 0; xi < n; xi++) {
      const k = zi * n + xi, x = -half + xi * step, z = -half + zi * step;
      pos.set([x, heights[k], z], k * 3);
      nor.set(hf.normalAt(x, z), k * 3);
    }
  }
  const idx = new Uint32Array((n - 1) * (n - 1) * 6);
  let o = 0;
  for (let zi = 0; zi < n - 1; zi++) {
    for (let xi = 0; xi < n - 1; xi++) {
      const a = zi * n + xi, b = a + 1, c = a + n, d = c + 1;
      idx.set([a, c, b, b, c, d], o);
      o += 6;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeBoundingSphere();

  const maskTex = maskTexture(hf);
  const c = biome.colors;
  const uniforms = {
    uMask: { value: maskTex },
    uSoil: { value: soil().map },
    uRock: { value: rock().map },
    uSize: { value: hf.size },
    uSnowLine: { value: biome.snowLine },
    uGrassLush: { value: new THREE.Color(c.grassLush) },
    uGrassDry: { value: new THREE.Color(c.grassDry) },
    uDirt: { value: new THREE.Color(c.dirt) },
    uRoad: { value: new THREE.Color(c.road) },
    uRockTint: { value: new THREE.Color(c.rock) },
    uSnow: { value: new THREE.Color(c.snow) },
  };
  const mat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
  lighting.setup(mat, 'terrain', (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${S.TERRAIN_VERT_PARS}`)
      .replace('#include <fog_vertex>', `#include <fog_vertex>\n${S.TERRAIN_VERT_MAIN}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${S.TERRAIN_FRAG_PARS}`)
      .replace('#include <map_fragment>', S.TERRAIN_FRAG_MAP)
      .replace('#include <roughnessmap_fragment>', S.TERRAIN_FRAG_ROUGH)
      .replace('#include <normal_fragment_maps>', S.TERRAIN_FRAG_NORMAL);
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = true;

  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(
    RAPIER.ColliderDesc.heightfield(n - 1, n - 1, hf.rapierHeights(), { x: hf.size, y: 1, z: hf.size }),
    body,
  );
  return mesh;
}

export function maskTexture(hf: Heightfield): THREE.DataTexture {
  const t = new THREE.DataTexture(hf.mask, hf.n, hf.n, THREE.RGBAFormat);
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

export function heightTexture(hf: Heightfield): THREE.DataTexture {
  const t = new THREE.DataTexture(hf.heights, hf.n, hf.n, THREE.RedFormat, THREE.FloatType);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}
