import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Heightfield } from './heightfield';
import type { BiomeDef } from '../data/types';
import type { Lighting } from '../render/lighting';
import { rock, soil } from '../render/textures';
import * as S from './terrainShader';
import { setSurface } from './surfaces';

const CHUNK = 32;
const LOD_STEPS = [1, 2, 4];
const LOD_DIST = [120, 300];

/** Grid patch from cell (cx, cz) with `step` cells per quad, plus a skirt to hide LOD cracks. */
function chunkGeometry(hf: Heightfield, cx: number, cz: number, step: number): THREE.BufferGeometry {
  const { half } = hf;
  const cells = CHUNK / step, verts = cells + 1;
  const pos: number[] = [], nor: number[] = [], idx: number[] = [];
  const push = (xi: number, zi: number, drop: number) => {
    const x = -half + xi * hf.step, z = -half + zi * hf.step;
    pos.push(x, hf.heights[zi * hf.n + xi] - drop, z);
    nor.push(...hf.normalAt(x, z, hf.step * step));
  };
  for (let j = 0; j < verts; j++) for (let i = 0; i < verts; i++) push(cx + i * step, cz + j * step, 0);
  for (let j = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) {
      const a = j * verts + i, b = a + 1, c = a + verts, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const edges: [number, number][][] = [[], [], [], []];
  for (let k = 0; k < verts; k++) {
    edges[0].push([k, 0]); edges[1].push([verts - 1, k]); edges[2].push([verts - 1 - k, verts - 1]); edges[3].push([0, verts - 1 - k]);
  }
  for (const edge of edges) {
    const base = pos.length / 3;
    for (const [i, j] of edge) push(cx + i * step, cz + j * step, 3);
    for (let k = 0; k < edge.length - 1; k++) {
      const top0 = edge[k][1] * verts + edge[k][0], top1 = edge[k + 1][1] * verts + edge[k + 1][0];
      idx.push(top0, top1, base + k, top1, base + k + 1, base + k);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

export class Terrain {
  readonly group = new THREE.Group();
  private chunks: { mesh: THREE.Mesh; lods: THREE.BufferGeometry[]; center: THREE.Vector3 }[] = [];

  constructor(hf: Heightfield, biome: BiomeDef, lighting: Lighting, world: RAPIER.World) {
    const mat = terrainMaterial(hf, biome, lighting);
    for (let cz = 0; cz < hf.n - 1; cz += CHUNK) {
      for (let cx = 0; cx < hf.n - 1; cx += CHUNK) {
        const lods = LOD_STEPS.map((st) => chunkGeometry(hf, cx, cz, st));
        const mesh = new THREE.Mesh(lods[0], mat);
        mesh.receiveShadow = true;
        this.group.add(mesh);
        this.chunks.push({ mesh, lods, center: lods[0].boundingSphere!.center.clone() });
      }
    }
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const col = world.createCollider(
      RAPIER.ColliderDesc.heightfield(hf.n - 1, hf.n - 1, hf.rapierHeights(), { x: hf.size, y: 1, z: hf.size }),
      body,
    );
    setSurface(col.handle, 'dirt');
  }

  update(cam: THREE.Vector3): void {
    for (const c of this.chunks) {
      const d = Math.hypot(c.center.x - cam.x, c.center.z - cam.z);
      const lod = LOD_DIST.findIndex((limit) => d < limit);
      const l = lod === -1 ? LOD_STEPS.length - 1 : lod;
      c.mesh.geometry = c.lods[l];
      c.mesh.castShadow = l <= 1;
    }
  }
}

function terrainMaterial(hf: Heightfield, biome: BiomeDef, lighting: Lighting): THREE.MeshStandardMaterial {
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
  return mat;
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
