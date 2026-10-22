import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { mulberry32 } from '../../core/rng';
import type { Heightfield } from '../heightfield';
import type { Lighting } from '../../render/lighting';
import { Builder } from '../buildingKit';
import { materials as barrioMaterials, type Barrio } from '../barrio';
import { bakeGroups } from '../bake';
import { SignAtlas } from '../signs';
import { PAINTS } from '../houses';
import { concrete, plaster, brick } from '../../render/urbanTextures';
import { rock, wood } from '../../render/textures';
import { edgeZ } from '../coast';
import { buildOcean } from '../ocean';
import { paragliders } from '../../fx/paragliders';
import { apartment, curtain, flagstone, mosaic, lattice, confetti, foliage } from './textures';
import { maleconGraph, type MaleconDef } from './layout';
import { buildTowers } from './towers';
import { buildRoads } from './roads';
import { buildPark, bench } from './park';
import { buildMonuments } from './monuments';
import { buildPropaganda } from './propaganda';
import { seatedCrowd, surfers } from './people';
import { buildLandmarks } from './landmarks';
import { buildLarcomar } from './larcomar';
import { buildVegetation } from './vegetation';

function maleconMaterials(lighting: Lighting): Record<string, THREE.Material> {
  const std = (key: string, p: THREE.MeshStandardMaterialParameters) => lighting.setup(new THREE.MeshStandardMaterial(p), key);
  const apt = apartment(), cw = curtain(), co = concrete(), pl = plaster(), fs = flagstone(), mo = mosaic(), la = lattice(), cf = confetti(), fo = foliage(), rk = rock(), wd = wood(), br = brick();
  const m: Record<string, THREE.Material> = {
    glassWall: std('glassWall', { map: cw.map, normalMap: cw.normalMap, roughness: 0.12, metalness: 0.65 }),
    slab: std('slab', { map: co.map, normalMap: co.normalMap, color: '#eceae4', roughness: 0.85 }),
    railGlass: std('railGlass', { color: '#6f8f99', roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.25, depthWrite: false }),
    alu: std('alu', { color: '#b9bec2', roughness: 0.35, metalness: 0.8 }),
    lobby: std('lobby', { color: '#1d262b', roughness: 0.1, metalness: 0.6 }),
    roofTile: std('roofTile', { color: '#9c5a3c', roughness: 0.85 }),
    pavement: std('pavement', { map: co.map, normalMap: co.normalMap, color: '#c9c4ba', roughness: 0.9 }),
    paving: std('paving', { map: co.map, normalMap: co.normalMap, color: '#b3aea4', roughness: 0.9 }),
    flagstone: std('flagstone', { map: fs.map, normalMap: fs.normalMap, roughness: 0.9 }),
    boulder: std('boulder', { map: rk.map, normalMap: rk.normalMap, color: '#8f8a83', roughness: 0.95 }),
    railGreen: std('railGreen', { color: '#24503f', roughness: 0.45, metalness: 0.5 }),
    lampPole: std('lampPole', { color: '#1d3129', roughness: 0.5, metalness: 0.5 }),
    globe: std('globe', { color: '#f7f2e4', roughness: 0.3, emissive: '#fff1d0', emissiveIntensity: 0.35 }),
    benchWood: std('benchWood', { map: wd.map, color: '#a07a52', roughness: 0.8 }),
    hedge: std('hedge', { map: fo.map, normalMap: fo.normalMap, roughness: 0.95 }),
    flowers: std('flowers', { map: fo.map, normalMap: fo.normalMap, color: '#ffb3d6', emissive: '#4a0e2a', emissiveIntensity: 0.4, roughness: 0.95 }),
    lawnRoof: std('lawnRoof', { map: fo.map, normalMap: fo.normalMap, color: '#9fd06a', roughness: 0.95 }),
    lhRed: std('lhRed', { map: br.map, normalMap: br.normalMap, color: '#c0604a', roughness: 0.9 }),
    lhBlack: std('lhBlack', { color: '#19191b', roughness: 0.5, metalness: 0.2 }),
    lhWhite: std('lhWhite', { color: '#f3f2ee', roughness: 0.7 }),
    lanternGlass: std('lanternGlass', { color: '#e8e2c8', roughness: 0.1, metalness: 0.4, emissive: '#fff4c0', emissiveIntensity: 0.5 }),
    mosaic: std('mosaic', { map: mo.map, normalMap: mo.normalMap, roughness: 0.45 }),
    poolRim: std('poolRim', { map: co.map, color: '#d6d0c2', roughness: 0.85 }),
    poolWater: std('poolWater', { color: '#2f7f92', roughness: 0.05, metalness: 0.3 }),
    terracotta: std('terracotta', { map: pl.map, normalMap: pl.normalMap, color: '#b9603f', roughness: 0.85 }),
    bridgeConcrete: std('bridgeConcrete', { map: co.map, normalMap: co.normalMap, color: '#cdc3b0', roughness: 0.9 }),
    confetti: std('confetti', { map: cf.map, normalMap: cf.normalMap, color: '#cfcbc3', roughness: 0.6 }),
    lattice: std('lattice', { map: la.map, normalMap: la.normalMap, color: '#dcdad4', roughness: 0.75 }),
    mallWhite: std('mallWhite', { map: pl.map, normalMap: pl.normalMap, color: '#d8d5ce', roughness: 0.85 }),
    shopGlass: std('shopGlass', { color: '#5d7480', roughness: 0.05, metalness: 0.5, transparent: true, opacity: 0.45, depthWrite: false }),
    awningRed: std('awningRed', { color: '#c0261e', roughness: 0.8 }),
    umbrella: std('umbrella', { color: '#f1ece0', roughness: 0.9, side: THREE.DoubleSide }),
    chair: std('chair', { color: '#3a3a3c', roughness: 0.6 }),
    planter: std('planter', { map: co.map, color: '#6b6560', roughness: 0.9 }),
    sail: std('sail', { color: '#ece4d2', roughness: 0.9, side: THREE.DoubleSide }),
    granite: std('granite', { map: co.map, normalMap: co.normalMap, color: '#9d988f', roughness: 0.7 }),
    bronze: std('bronze', { color: '#6a5634', roughness: 0.42, metalness: 0.75 }),
    flagMast: std('flagMast', { color: '#e9e9e6', roughness: 0.4, metalness: 0.5 }),
    steelDark: std('steelDark', { color: '#2b2e31', roughness: 0.5, metalness: 0.6 }),
    columnGreen: std('columnGreen', { color: '#1f3a2e', roughness: 0.5, metalness: 0.4 }),
  };
  [['aptWhite', '#f6f4ee'], ['aptCream', '#ecdfc4'], ['aptSand', '#dcc9a4'], ['aptGray', '#c9cbcc'], ['aptBlue', '#c5d5e6']].forEach(([k, c]) => (m[k] = std(k, { map: apt.map, normalMap: apt.normalMap, color: c, roughness: 0.85 })));
  return m;
}

/** Level 2: Miraflores-style seafront (towers, avenue, clifftop park, mall in the cliff, beach road, Pacific). */
export function buildMalecon(hf: Heightfield, def: MaleconDef, lighting: Lighting, world: RAPIER.World): Barrio {
  const c = hf.def.coast!;
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const b = new Builder(world, body), t = new Builder(world, body);
  const rand = mulberry32(def.seed);
  const mats = { ...barrioMaterials(lighting, new SignAtlas()), ...maleconMaterials(lighting) };
  const bake = bakeGroups(lighting, ['alu', 'railGreen', 'lampPole', 'chair', 'awningRed', 'lobby', 'steelDark', 'columnGreen', 'flagMast']);
  const fronts = buildTowers(t, b, def, PAINTS, rand);
  const streetTrees = buildRoads(b, hf, def, c, rand);
  const plants = buildPark(b, hf, def, c, rand);
  buildLandmarks(b, hf, def, c);
  const group = new THREE.Group();
  group.add(buildLarcomar(b, def, c, lighting, plants, rand));
  group.add(buildMonuments(b, hf, def, lighting, plants.seats, (at, yaw) => bench(b, at, yaw)));
  group.add(buildPropaganda(b, hf, def, lighting, fronts, rand));
  group.add(buildVegetation(b, plants, streetTrees, lighting));
  group.add(seatedCrowd(plants.seats, lighting));
  group.add(surfers(def.surfers ?? 0, c, lighting));
  group.add(...b.build(mats, 0.5, bake, 128), ...t.build(mats, 1 / 6, bake, 128));
  group.add(buildOcean(hf, c, lighting));
  group.add(paragliders(def.paragliders, c.edge, lighting));
  return { group, materials: mats, bake, station: null, graph: maleconGraph(def, c, hf), blocked: (x, z) => z < edgeZ(c, x) + 2 };
}
