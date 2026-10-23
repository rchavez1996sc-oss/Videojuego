import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import RAPIER from '@dimforge/rapier3d-compat';
import { mulberry32 } from '../../core/rng';
import type { Heightfield } from '../heightfield';
import type { Lighting } from '../../render/lighting';
import { Builder } from '../buildingKit';
import { materials as barrioMaterials, type Barrio } from '../barrio';
import { bakeGroups } from '../bake';
import { SignAtlas } from '../signs';
import { PAINTS } from '../houses';
import { concrete, plaster, brick, slabs } from '../../render/urbanTextures';
import { deck, parquet, rock, wood, type PbrSet } from '../../render/textures';
import { edgeZ } from '../coast';
import { buildOcean } from '../ocean';
import { Paragliders } from '../../fx/paragliders';
import { apartment, curtain, flagstone, mosaic, lattice, confetti, foliage, checker } from './textures';
import { maleconGraph, type MaleconDef } from './layout';
import { buildTowers, FACADES } from './towers';
import { buildBoulevard } from './boulevard';
import { streetDetail } from './streetDetail';
import { buildRoads } from './roads';
import { buildPark, bench } from './park';
import { buildMonuments } from './monuments';
import { buildPropaganda } from './propaganda';
import { crowd, surfers } from './people';
import { buildLandmarks } from './landmarks';
import { rosaNautica } from './rosaNautica';
import { buildBorder } from './border';
import { buildLarcomar } from './larcomar';
import { buildVegetation } from './vegetation';

type Tex = Record<'apt' | 'co' | 'pl' | 'br' | 'wd' | 'fo', PbrSet>;

function maleconMaterials(lighting: Lighting, { apt, co, pl, br, wd, fo }: Tex): Record<string, THREE.Material> {
  const std = (key: string, p: THREE.MeshStandardMaterialParameters) => lighting.setup(new THREE.MeshStandardMaterial(p), key);
  const cw = curtain(), fs = flagstone(), mo = mosaic(), la = lattice(), cf = confetti(), rk = rock();
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
    greenGlass: std('greenGlass', { color: '#5fa88a', roughness: 0.08, metalness: 0.4, transparent: true, opacity: 0.6, emissive: '#1e4a3a', emissiveIntensity: 0.4 }),
    pathChecker: std('pathChecker', { map: checker().map, roughness: 0.8 }),
    gravel: std('gravel', { map: co.map, color: '#d9cbb0', roughness: 0.95 }),
    flowerRed: std('flowerRed', { map: fo.map, normalMap: fo.normalMap, color: '#ff6a6a', emissive: '#3a0606', roughness: 0.95 }),
    flowerPurple: std('flowerPurple', { map: fo.map, normalMap: fo.normalMap, color: '#c87ae8', emissive: '#22062e', roughness: 0.95 }),
    roofRed: std('roofRed', { color: '#b8483a', roughness: 0.7 }),
    roofGreen: std('roofGreen', { color: '#3f7a5a', roughness: 0.6 }),
    bikeRed: std('bikeRed', { map: rk.map, normalMap: rk.normalMap, color: '#b25a48', roughness: 0.9 }),
    boulder: std('boulder', { map: rk.map, normalMap: rk.normalMap, color: '#8f8a83', roughness: 0.95 }),
    breakRock: std('breakRock', { map: rk.map, normalMap: rk.normalMap, color: '#5e564d', roughness: 0.95 }),
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
    creamWall: std('creamWall', { map: pl.map, normalMap: pl.normalMap, color: '#efe6cf', roughness: 0.85 }),
    roofSlate: std('roofSlate', { color: '#5f7389', roughness: 0.6 }),
    awningStripe: std('awningStripe', { color: '#d8c27a', roughness: 0.8 }),
    flatRoof: std('flatRoof', { color: '#a7a49c', roughness: 0.9 }),
    barrierRed: std('barrierRed', { color: '#b8322a', roughness: 0.8 }),
    barrierWhite: std('barrierWhite', { color: '#e8e4dc', roughness: 0.8 }),
    glassClear: std('glassClear', { color: '#cfe3ea', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.22, depthWrite: false }),
    chairGreen: std('chairGreen', { color: '#2e3a2b', roughness: 0.6 }),
    cushionOrange: std('cushionOrange', { color: '#b8662e', roughness: 0.9 }),
    greenTrim: std('greenTrim', { color: '#2b3527', roughness: 0.55 }),
    columnWood: std('columnWood', { map: wd.map, color: '#c0603a', roughness: 0.5 }),
    lampShade: std('lampShade', { color: '#f4efe4', emissive: '#fff2d6', emissiveIntensity: 0.35, roughness: 0.6 }),
    ceilingWhite: std('ceilingWhite', { color: '#cfc9bc', roughness: 0.85 }),
    linen: std('linen', { color: '#dcd8ce', roughness: 0.9 }),
    lampGold: std('lampGold', { color: '#d9a640', emissive: '#ffb84a', emissiveIntensity: 0.55, roughness: 0.4 }),
    parquet: std('parquet', { map: parquet().map, normalMap: parquet().normalMap, color: '#b08a70', roughness: 0.45 }),
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
    railBlue: std('railBlue', { color: '#3f7f9e', roughness: 0.05, metalness: 0.5, transparent: true, opacity: 0.55, depthWrite: false }),
    houseBrick: std('houseBrick', { map: br.map, normalMap: br.normalMap, color: '#d4876c', roughness: 0.9 }),
    brickRed: std('brickRed', { map: br.map, normalMap: br.normalMap, color: '#c25a3e', roughness: 0.9 }),
    woodSlat: std('woodSlat', { map: wd.map, color: '#8a5a36', roughness: 0.7 }),
    woodGate: std('woodGate', { map: wd.map, color: '#6e4a2f', roughness: 0.7 }),
    fenceIron: std('fenceIron', { color: '#2e2622', roughness: 0.55, metalness: 0.5 }),
    benchGreen: std('benchGreen', { color: '#24483a', roughness: 0.55, metalness: 0.3 }),
    kerbYellow: std('kerbYellow', { map: co.map, color: '#e0b830', roughness: 0.8 }),
    bollardGreen: std('bollardGreen', { color: '#2f6b55', roughness: 0.45, metalness: 0.3 }),
  };
  [['houseWhite', '#f4f2ed'], ['houseCream', '#ece2cf'], ['houseGray', '#d6d7d5'], ['houseWarm', '#e9d8c0']].forEach(([k, c]) => (m[k] = std(k, { map: pl.map, normalMap: pl.normalMap, color: c, roughness: 0.85 })));
  [['aptTerracotta', '#c98b70'], ['aptSalmon', '#dba58c'], ['aptWhite', '#f6f4ee'], ['aptCream', '#ecdfc4'], ['aptSand', '#dcc9a4'], ['aptGray', '#c9cbcc'], ['aptBlue', '#c5d5e6']].forEach(([k, c]) => (m[k] = std(k, { map: apt.map, normalMap: apt.normalMap, color: c, roughness: 0.85 })));
  return m;
}

/** Level 2: Miraflores-style seafront (towers, avenue, clifftop park, mall in the cliff, beach road, Pacific). */
export function buildMalecon(hf: Heightfield, def: MaleconDef, lighting: Lighting, world: RAPIER.World): Barrio {
  const c = hf.def.coast!;
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const b = new Builder(world, body), t = new Builder(world, body);
  const rand = mulberry32(def.seed);
  const tex: Tex = { apt: apartment(), co: concrete(), pl: plaster(), br: brick(), wd: wood(), fo: foliage() };
  const atlas = new SignAtlas(), brands = atlas.brands;
  const mats = { ...barrioMaterials(lighting, atlas), ...maleconMaterials(lighting, tex) };
  const textured = (key: string, set: PbrSet, keys: string[], roughness: number) => ({ material: lighting.setup(new THREE.MeshStandardMaterial({ map: set.map, normalMap: set.normalMap, roughness, vertexColors: true }), key), keys });
  const bake = [
    ...bakeGroups(lighting, ['alu', 'railGreen', 'lampPole', 'chair', 'awningRed', 'lobby', 'steelDark', 'columnGreen', 'flagMast', 'fenceIron', 'benchGreen', 'bollardGreen', 'lhBlack', 'lhWhite', 'roofTile', 'poolWater', 'roofSlate', 'awningStripe', 'flatRoof', 'ceilingWhite', 'linen', 'chairGreen', 'cushionOrange', 'greenTrim', 'barrierRed', 'barrierWhite']),
    textured('apt-baked', tex.apt, [...new Set(FACADES)], 0.85),
    textured('plaster-baked', tex.pl, ['houseWhite', 'houseCream', 'houseGray', 'houseWarm', 'mallWhite', 'terracotta', 'creamWall'], 0.85),
    textured('slabs-baked', slabs(), ['pavement'], 0.9),
    textured('concrete-baked', tex.co, ['slab', 'paving', 'bridgeConcrete', 'granite', 'poolRim', 'planter', 'kerbYellow', 'concrete'], 0.9),
    textured('brick-baked', tex.br, ['lhRed', 'houseBrick', 'brickRed', 'brick'], 0.9),
    textured('deck-baked', deck(), ['benchWood', 'woodSlat'], 0.75),
    textured('wood-baked', tex.wd, ['woodGate', 'pole'], 0.8),
    textured('foliage-baked', tex.fo, ['hedge', 'flowers', 'lawnRoof'], 0.95),
  ];
  const gardens: THREE.Vector3[] = [];
  const guards: { pos: THREE.Vector3; yaw: number }[] = [];
  const fronts = buildTowers(t, b, def, PAINTS, rand, gardens, guards, (pos, q, w) => atlas.add(pos, q, w, 'shop', rand, rand() < 0.7 ? brands[Math.floor(rand() * brands.length)] : undefined));
  const streetTrees = [...buildRoads(b, hf, def, c, rand), ...gardens];
  streetDetail(b, hf, def, rand);
  const plants = buildPark(b, hf, def, c, rand);
  buildBoulevard(b, hf, def, plants, rand);
  plants.standing.push(...guards.map((g) => ({ ...g, key: rand() < 0.5 ? 'civ_idle' : 'texting' })));
  buildLandmarks(b, hf, def, c, plants.palms);
  const station = rosaNautica(b, hf, def, c);
  buildBorder(b, hf, def, c, hf.def.playable / 2);
  const group = new THREE.Group();
  group.add(buildLarcomar(b, def, c, lighting, plants, rand));
  group.add(buildMonuments(b, hf, def, lighting, plants.seats, (at, yaw) => bench(b, at, yaw)));
  group.add(buildPropaganda(b, hf, def, lighting, fronts, rand));
  group.add(buildVegetation(b, plants, streetTrees, lighting));
  const bystanders = { onHurt: (_p: THREE.Vector3) => {} };
  group.add(crowd(plants.seats, plants.standing, lighting, world, bystanders));
  group.add(surfers(def.surfers ?? 0, c, lighting));
  group.add(...b.build(mats, 0.5, bake, 128), ...t.build(mats, 1 / 6, bake, 128));
  if (atlas.geometries.length) group.add(Object.assign(new THREE.Mesh(mergeGeometries(atlas.geometries), mats.signs), { receiveShadow: true }));
  group.add(buildOcean(hf, c, lighting));
  const fliers = new Paragliders(def.paragliders, c.edge, lighting, world, (x, z) => Math.max(hf.heightAt(x, z), c.sea));
  fliers.onDown = (p) => bystanders.onHurt(p);
  group.add(fliers.group);
  return { group, materials: mats, bake, station, graph: maleconGraph(def, c, hf), blocked: (x, z) => z < edgeZ(c, x) + 2, bystanders };
}
