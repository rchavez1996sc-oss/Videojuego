import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import RAPIER from '@dimforge/rapier3d-compat';
import { mulberry32 } from '../../core/rng';
import type { Heightfield } from '../heightfield';
import type { Lighting } from '../../render/lighting';
import { Builder } from '../buildingKit';
import { materials as barrioMaterials, type Barrio } from '../barrio';
import { autoBake, bakeGroups } from '../bake';
import { SignAtlas } from '../signs';
import { edgeZ } from '../coast';
import { buildOcean } from '../ocean';
import { buildVegetation } from '../malecon/vegetation';
import { crowd } from '../malecon/people';
import type { Plants } from '../malecon/park';
import { barrancoMaterials } from './materials';
import { barrancoGraph, bridgeSpan, type BarrancoDef } from './layout';
import { suspiros } from './bridge';
import { bajadaDeBanos } from './bajada';
import { buildLandmarks } from './landmarks';
import { buildStreets } from './streets';
import { streetLayer } from './streetLayer';

/**
 * Level 4: Barranco around the Puente de los Suspiros — republican casonas on a grid of kerbed streets, the
 * Bajada de Baños cutting down to the beach under the wooden bridge, La Ermita, the park with the church and the
 * library, the mirador over the Pacific; the objective is the Junta's detention house on the lip of the bajada.
 */
export function buildBarranco(hf: Heightfield, def: BarrancoDef, lighting: Lighting, world: RAPIER.World): Barrio {
  const c = hf.def.coast!;
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const ground = (x: number, z: number) => hf.heightAt(x, z);
  const b = Object.assign(new Builder(world, body), { ground }), t = Object.assign(new Builder(world, body), { ground });
  const rand = mulberry32(def.seed), atlas = new SignAtlas();
  const mats = { ...barrioMaterials(lighting, atlas), ...barrancoMaterials(lighting) };
  const bake = bakeGroups(lighting, ['lampPole', 'alu', 'steelDark', 'fenceIron', 'lhBlack', 'trimWhite', 'awningRed', 'tentWhite', 'poolWater']);
  bake.push(...autoBake(lighting, mats, bake));
  const plants: Plants = { palms: [], phoenix: [], trees: [], bent: [], pines: [], seats: [], standing: [], arch: [] };
  const group = new THREE.Group();
  suspiros(b, hf, bridgeSpan(c, def));
  group.add(bajadaDeBanos(t, hf, def, c, plants, lighting));
  buildLandmarks(b, hf, def, plants, rand);
  const { station, trees, fronts } = buildStreets(b, def, c, plants, rand);
  streetLayer(t, def, c, fronts, rand);
  group.add(buildVegetation(b, plants, trees, lighting));
  const bystanders = { onHurt: (_p: THREE.Vector3) => {} };
  group.add(crowd(plants.seats, plants.standing, lighting, world, bystanders));
  group.add(...b.build(mats, 0.5, bake, 128), ...t.build(mats, 1 / 6, bake, 128));
  if (atlas.geometries.length) group.add(Object.assign(new THREE.Mesh(mergeGeometries(atlas.geometries), mats.signs), { receiveShadow: true }));
  group.add(buildOcean(hf, c, lighting));
  const graph = barrancoGraph(def, c, hf), E = def.extent - 4;
  return {
    group, materials: mats, bake, station: null, graph, bystanders, entry: station?.entrance,
    blocked: (x, z) => z < edgeZ(c, x) + 2,
    inside: (x, z) => Math.abs(x) < E && z > -E && z < edgeZ(c, x) - 4,
  };
}
