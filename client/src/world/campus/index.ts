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
import { campusGraph, framer, inRect, northAt, type CampusDef } from './layout';
import { buildCampusRoads } from './roads';
import { pavilion, type NameSign } from './pavilion';
import { comedor } from './comedor';
import { minasPortal, puerta1, puerta2 } from './gates';
import { industrial } from './industrial';
import { fisicasRotunda, mathEntrance } from './faculties';
import { cie } from './cie';
import { fisInst } from './fisInst';
import { multired } from './kiosk';
import { stall } from './stalls';
import { SwingGates } from './swingGates';
import { studentLife, studentWalks } from './student';
import { plazuela } from './plazuela';
import { patioDetail } from './patio';
import { footballField, parkingLot, venezuelaFence } from './grounds';
import { perimeter } from './perimeter';
import { campusHard, comedorPark, paintCampusLawns, plantCampus } from './greens';
import { universitaria, venezuelaSouth } from './south';
import { stadium } from './stadium';
import { moreStudents } from './crowds';
import { facultyParks } from './parks';
import { campusMaterials, campusBake } from './materials';
import { campusSigns } from './signs';

/** Level 3: Ciudad Universitaria de San Marcos (UNMSM), southern sectors along Av. Venezuela, from the Huaca to Av. Universitaria. */
export function buildCampus(hf: Heightfield, def: CampusDef, lighting: Lighting, world: RAPIER.World): Barrio {
  const b = new Builder(world, world.createRigidBody(RAPIER.RigidBodyDesc.fixed()));
  const rand = mulberry32(def.seed);
  const atlas = new SignAtlas(), brands = atlas.brands;
  const mats = { ...barrioMaterials(lighting, atlas), ...campusMaterials(lighting) };
  const bake = campusBake(lighting);
  const plants: Plants = { palms: [], phoenix: [], trees: [], bent: [], pines: [], seats: [], standing: [], arch: [] };
  const group = new THREE.Group(), signs: NameSign[] = [];

  buildCampusRoads(b, def, rand);
  const v = def.venezuela, gate = puerta1(b, def.gate1, def.gate1.x - 28.2 - def.bounds.west);
  signs.push(gate.name, gate.plate);
  plants.palms.push(...gate.palms);
  const swing = new SwingGates(gate.leaves, world, lighting);
  group.add(swing.group);
  const seals: { pos: THREE.Vector3; q: THREE.Quaternion; size: number; silver?: boolean }[] = [gate.crest];
  if (def.gate2) {
    const g2 = puerta2(b, def.gate2);
    signs.push(g2.name, g2.label);
    seals.push({ ...g2.crest, silver: true });
  }
  for (const bd of def.buildings) {
    if (bd.key === 'comedor') {
      const c = comedor(b, bd, plants);
      signs.push(c.sign, c.inner);
      seals.push(c.seal);
      continue;
    }
    const s = bd.key === 'industrial' ? industrial(b, bd, rand) : bd.key === 'cie' ? cie(b, bd) : bd.key === 'fisinst' ? fisInst(b, bd, plants, rand) : pavilion(b, bd, rand);
    if (bd.key === 'fisicas') signs.push(fisicasRotunda(b, bd));
    if (bd.key === 'mate') signs.push(mathEntrance(b, bd));
    if (s) signs.push(s);
    if (bd.key === 'minas') signs.push(minasPortal(b, { yaw: bd.yaw, ...offsetFront(bd, 6) }));
  }
  for (const k of def.atms ?? []) signs.push(multired(b, k));
  venezuelaFence(b, def);
  for (const p of def.parkings) parkingLot(b, p, rand);
  const turf = lighting.setup(new THREE.MeshStandardMaterial({ roughness: 0.95 }), 'turf');
  group.add(footballField(b, def.field, turf));
  perimeter(b, def, mulberry32(def.seed + 3), group, lighting);
  venezuelaSouth(b, hf, def, rand, (pos, q, w) => atlas.add(pos, q, w, 'shop', rand, rand() < 0.6 ? brands[Math.floor(rand() * brands.length)] : undefined));
  signs.push(...stadium(b, def.stadium, plants));
  universitaria(b, def);

  const paths = comedorPark(b, hf, def, plants, rand);
  patioDetail(b, def, paths, plants, rand);
  for (const s of def.stalls ?? []) {
    signs.push(stall(b, s, plants, rand));
    paths.discs.push({ x: s.x, z: s.z, r: s.kind === 'office' ? 6 : 4 });
  }
  facultyParks(b, hf, def, paths, plants, rand);
  if (def.plazuela) group.add(plazuela(b, hf, def.plazuela, plants, paths, lighting, rand));
  const walks = studentWalks(b, hf, def, paths);
  const hard = campusHard(def, paths, gate.hard);
  paintCampusLawns(hf, def, hard);
  if (def.politics) group.add(studentLife(b, def, def.politics, walks, hard, gate.hard, plants, lighting, mulberry32(def.seed + 9)));
  plantCampus(hf, def, hard, plants, rand);
  moreStudents(def, plants, rand, def.crowdFactor ?? 1);

  group.add(buildVegetation(b, plants, [], lighting));
  const bystanders = { onHurt: (_p: THREE.Vector3) => {} };
  group.add(crowd(plants.seats, plants.standing, lighting, world, bystanders, def.studentGear));
  group.add(campusSigns(signs, seals, lighting));
  group.add(...b.build(mats, 0.5, bake, 128));
  if (atlas.geometries.length) group.add(Object.assign(new THREE.Mesh(mergeGeometries(atlas.geometries), mats.signs), { receiveShadow: true }));

  const solid = (x: number, z: number) => def.buildings.some((r) => inRect(r, x, z, 1)) || def.parkings.some((r) => inRect(r, x, z, 0)) || inRect(def.field, x, z, 3.2);
  const graph = campusGraph(def, solid, walks);
  const B = def.bounds;
  return { group, materials: mats, bake, station: null, graph, bystanders, tick: (dt, movers) => swing.update(dt, movers),
    blocked: (x, z) => solid(x, z) || z > v.z + v.half + v.sidewalk,
    inside: (x, z) => x > B.west + 4 && x < B.x - 4 && z > northAt(B, x) + 4 && z < v.z - v.half - v.sidewalk - 1 };
}

/** Centre of a point `ahead` metres in front of a footprint's +z face (for porches, portals). */
function offsetFront(r: CampusDef['buildings'][number], ahead: number): { x: number; z: number } {
  const p = framer(r)(0, 0, r.d / 2 + ahead);
  return { x: p.x, z: p.z };
}
