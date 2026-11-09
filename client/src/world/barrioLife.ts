import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { Builder } from './buildingKit';
import type { Heightfield } from './heightfield';
import type { Lighting } from '../render/lighting';
import { busStop, roadWorks, scenePlates, type SceneLife } from './streetScenes';
import { crowd, type Bystanders } from './malecon/people';
import { roofPeople } from './roofClutter';
import { Shutters } from './shutters';

/** Grid numbers of the barrio the scenes need. */
interface Grid { cols: number; gap: number; blockD: number; street: number; road2?: { z: number; half: number } }

/**
 * Paraderos with queues along the avenue (one after every other crossing, alternating sides) and SEDAPAL works on a
 * few side streets. Their footprints go into `taken` so parked cars and mototaxis keep clear; returns the people.
 */
export function barrioScenes(b: Builder, hf: Heightfield, g: Grid, crossX: number[], rand: () => number, taken: THREE.Vector2[]): SceneLife & { stops: number[] } {
  const life: SceneLife = { seats: [], standing: [] }, stops: number[] = [];
  for (let k = 0; k < g.cols; k++) {
    const s = (k + (rand() < 0.2 ? 1 : 0)) % 2 ? 1 : -1, x = crossX[k] + 12 + rand() * 6, z = s * 9.6;
    busStop(b, hf, new THREE.Vector3(x, hf.heightAt(x, z) + 0.15, z), s > 0 ? Math.PI : 0, s > 0 ? -1 : 1, rand, life);
    stops.push(x);
    for (let d = 0; d < 8; d += 2) taken.push(new THREE.Vector2(x + d, s * 6.8));
  }
  for (let n = 0, tries = 0; n < 4 && tries < 40; tries++) {
    const k = Math.floor(rand() * crossX.length), s = rand() < 0.5 ? 1 : -1, far = rand() < 0.5;
    const z = s * (g.gap + (far ? g.blockD + g.street : 0) + 7 + rand() * (g.blockD - 14));
    const x = crossX[k] + (rand() < 0.5 ? -2.2 : 2.2);
    if ((g.road2 && Math.abs(z - g.road2.z) < g.road2.half + 9) || taken.some((p) => Math.hypot(p.x - x, p.y - z) < 9)) continue;
    roadWorks(b, hf, new THREE.Vector3(x, 0, z), 0, rand, life);
    for (let d = -7; d <= 7; d += 2) taken.push(new THREE.Vector2(x, z + d));
    n++;
  }
  const ROOF = ['civ_idle', 'look_around', 'texting'];
  for (const r of roofPeople.splice(0)) life.standing.push({ pos: r.pos, yaw: r.yaw, key: ROOF[Math.floor(rand() * ROOF.length)] });
  if (location.search.includes('shot')) Object.assign(window, { __scenes: life });
  return { ...life, stops };
}

/** The scenes' shootable people and their plates; `bystanders` is what the populace hooks for casualties and alarms. */
export function barrioCrowd(life: SceneLife, lighting: Lighting, world: RAPIER.World, shutter: THREE.Material): { group: THREE.Group; bystanders: Bystanders } {
  const bystanders: Bystanders = { onHurt: () => {} }, group = new THREE.Group();
  group.add(crowd(life.seats, life.standing, lighting, world, bystanders));
  const shutters = new Shutters(shutter), alarm = bystanders.alarm;
  bystanders.alarm = (at, r) => (alarm?.(at, r), shutters.alarm(at, r));
  group.add(shutters.mesh);
  const plates = scenePlates(lighting);
  if (plates) group.add(plates);
  return { group, bystanders };
}
