import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import RAPIER from '@dimforge/rapier3d-compat';
import { mulberry32 } from '../../core/rng';
import type { Heightfield } from '../heightfield';
import type { Lighting } from '../../render/lighting';
import { Builder } from '../buildingKit';
import { materials as barrioMaterials, type Barrio } from '../barrio';
import { SignAtlas } from '../signs';
import type { Plants } from '../malecon/park';
import { buildVegetation } from '../malecon/vegetation';
import { crowd } from '../malecon/people';
import { campusGraph, framer, inRect, type CampusDef } from './layout';
import { buildCampusRoads } from './roads';
import { pavilion, type NameSign } from './pavilion';
import { comedor } from './comedor';
import { minasPortal, puerta1 } from './gates';
import { footballField, hoarding, parkingLot, venezuelaFence } from './grounds';
import { campusHard, comedorPark, paintCampusLawns, plantCampus } from './greens';
import { stadium, venezuelaSouth } from './south';
import { campusMaterials, campusBake } from './materials';
import { campusSigns } from './signs';

/** Level 3: Ciudad Universitaria de San Marcos (UNMSM), south-west sector along Av. Venezuela. */
export function buildCampus(hf: Heightfield, def: CampusDef, lighting: Lighting, world: RAPIER.World): Barrio {
  const b = new Builder(world, world.createRigidBody(RAPIER.RigidBodyDesc.fixed()));
  const rand = mulberry32(def.seed);
  const atlas = new SignAtlas(), brands = atlas.brands;
  const mats = { ...barrioMaterials(lighting, atlas), ...campusMaterials(lighting) };
  const bake = campusBake(lighting);
  const plants: Plants = { palms: [], phoenix: [], trees: [], bent: [], pines: [], seats: [], standing: [], arch: [] };
  const group = new THREE.Group(), signs: NameSign[] = [];

  buildCampusRoads(b, def, rand);
  const v = def.venezuela, g = def.gate1, plazaDepth = v.z - v.half - v.sidewalk - g.z - 1.4;
  const gate = puerta1(b, g, plazaDepth);
  signs.push(gate.name);
  for (const bd of def.buildings) {
    const s = bd.key === 'comedor' ? comedor(b, bd) : pavilion(b, bd, rand);
    if (s) signs.push(s);
    if (bd.key === 'minas') signs.push(minasPortal(b, { yaw: bd.yaw, ...offsetFront(bd, 6) }));
  }
  venezuelaFence(b, def);
  for (const p of def.parkings) parkingLot(b, p, rand);
  const turf = lighting.setup(new THREE.MeshStandardMaterial({ roughness: 0.95 }), 'turf');
  group.add(footballField(b, def.field, turf));
  hoarding(b, -def.bounds.x - 8, def.bounds.x + 8, def.bounds.north);
  venezuelaSouth(b, hf, def, rand, (pos, q, w) => atlas.add(pos, q, w, 'shop', rand, rand() < 0.6 ? brands[Math.floor(rand() * brands.length)] : undefined));
  stadium(b, def.stadium);

  const paths = comedorPark(b, hf, def, plants, rand);
  const hard = campusHard(def, paths, plazaDepth);
  paintCampusLawns(hf, def, hard);
  plantCampus(hf, def, hard, plants, rand);

  group.add(buildVegetation(b, plants, [], lighting));
  const bystanders = { onHurt: (_p: THREE.Vector3) => {} };
  group.add(crowd(plants.seats, plants.standing, lighting, world, bystanders));
  group.add(campusSigns(signs, gate.crest, lighting));
  group.add(...b.build(mats, 0.5, bake, 128));
  if (atlas.geometries.length) group.add(Object.assign(new THREE.Mesh(mergeGeometries(atlas.geometries), mats.signs), { receiveShadow: true }));

  const solid = (x: number, z: number) => def.buildings.some((r) => inRect(r, x, z, 1)) || def.parkings.some((r) => inRect(r, x, z, 0)) || inRect(def.field, x, z, 3.2);
  const graph = campusGraph(def, solid);
  const B = def.bounds;
  return { group, materials: mats, bake, station: null, graph, bystanders,
    blocked: (x, z) => solid(x, z) || z > v.z + v.half + v.sidewalk,
    inside: (x, z) => Math.abs(x) < B.x - 4 && z > B.north + 4 && z < v.z - v.half - v.sidewalk - 1 };
}

/** Centre of a point `ahead` metres in front of a footprint's +z face (for porches, portals). */
function offsetFront(r: CampusDef['buildings'][number], ahead: number): { x: number; z: number } {
  const p = framer(r)(0, 0, r.d / 2 + ahead);
  return { x: p.x, z: p.z };
}
