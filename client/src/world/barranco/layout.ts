import * as THREE from 'three';
import type { Heightfield } from '../heightfield';
import type { StreetGraph } from '../barrio';
import { edgeZ, ravineCentre, ravineFloor, ravineHalf, type CoastDef } from '../coast';

/**
 * Barranco (chapter 4) in metres. +z runs toward the sea (real west), the Bajada de Baños is the coast's first
 * ravine (`terrain.coast.ravines[0]`): shallow from its head by Av. Pedro de Osma, crossed by the Puente de los
 * Suspiros, then steeply down the cliff to the beach road.
 */
export interface BarrancoDef {
  seed: number;
  extent: number;
  avenues: { z: number; half: number; x0?: number; x1?: number }[];
  streets: { x: number; half: number; z0: number; z1: number }[];
  bridge: { z: number };
  mural: { z: number; half: number };
  park: { x0: number; x1: number; z0: number; z1: number };
  church: { x: number; z: number; yaw: number };
  library: { x: number; z: number; yaw: number };
  ermita: { x: number; z: number; yaw: number };
  mirador: { x: number; z: number };
  tram: { x: number };
  prison: { side: 1 | -1; z: number };
  beachRoad: { z: number; half: number };
}

export const SIDEWALK = 2.4, KERB = 0.16, DECK = 0.25;

export const ravineOf = (c: CoastDef) => c.ravines![0];

/** True within the bajada's cut (plus `margin`), from its head to the beach. */
export function overRavine(c: CoastDef, x: number, z: number, margin = 0): boolean {
  const r = ravineOf(c), mouth = edgeZ(c, r.x) + c.run;
  if (z < r.head - margin || z > mouth + margin) return false;
  const zz = Math.min(Math.max(z, r.head + 0.5), mouth);
  return Math.abs(x - ravineCentre(r, zz)) < ravineHalf(c, r, zz) + margin;
}

/** The Puente de los Suspiros: from lip to lip of the cut at its z. */
export function bridgeSpan(c: CoastDef, def: BarrancoDef): { x0: number; x1: number; z: number } {
  const r = ravineOf(c), x = ravineCentre(r, def.bridge.z), h = ravineHalf(c, r, def.bridge.z);
  return { x0: x - h - 1.2, x1: x + h + 1.2, z: def.bridge.z };
}

/** The street bridge over the bajada (with the painted vault under it). */
export function muralSpan(c: CoastDef, def: BarrancoDef): { x0: number; x1: number; z: number } {
  const r = ravineOf(c), x = ravineCentre(r, def.mural.z), h = ravineHalf(c, r, def.mural.z);
  return { x0: x - h - 1.5, x1: x + h + 1.5, z: def.mural.z };
}

/** Walkable height at (x, z): bridge decks over the cut, the paved floor of the bajada, else the terrain. */
export function walkHeight(def: BarrancoDef, c: CoastDef, hf: Heightfield, x: number, z: number): number {
  const b = bridgeSpan(c, def), m = muralSpan(c, def);
  if (Math.abs(z - b.z) < 1.6 && x > b.x0 && x < b.x1) return DECK;
  if (Math.abs(z - m.z) < def.mural.half + 2 && x > m.x0 && x < m.x1) return 0.15;
  const r = ravineOf(c);
  if (z > r.head && z < edgeZ(c, r.x) + c.run && Math.abs(x - ravineCentre(r, z)) < (r.floorHalf ?? 8) - 0.3) return ravineFloor(c, r, z) + 0.06;
  return hf.heightAt(x, z);
}

/** Lot footprints are kept off streets, the cut, the park and the cliff. */
export function blockedForBuilding(def: BarrancoDef, c: CoastDef, x: number, z: number, m: number): boolean {
  if (Math.abs(x) > def.extent - 4 || Math.abs(z) > def.extent - 4) return true;
  if (z > edgeZ(c, x) - 8 - m) return true;
  if (overRavine(c, x, z, 3 + m)) return true;
  const br = bridgeSpan(c, def);
  if (Math.abs(z - br.z) < 25 + m && x > br.x0 - 18 - m && x < br.x0 + 1 + m) return true;
  if (Math.abs(z - br.z) < 22 + m && x > br.x1 - 1 - m && x < br.x1 + 16 + m) return true;
  if (def.avenues.some((a) => Math.abs(z - a.z) < a.half + SIDEWALK + m && x > (a.x0 ?? -1e9) - m && x < (a.x1 ?? 1e9) + m)) return true;
  if (Math.abs(z - def.mural.z) < def.mural.half + SIDEWALK + m) return true;
  if (def.streets.some((s) => Math.abs(x - s.x) < s.half + SIDEWALK + m && z > s.z0 - m && z < s.z1 + m)) return true;
  for (const k of [def.church, def.library, def.ermita, def.mirador]) if (Math.abs(x - k.x) < 22 + m && Math.abs(z - k.z) < 22 + m) return true;
  const p = def.park;
  return x > p.x0 - m && x < p.x1 + m && z > p.z0 - m && z < p.z1 + m;
}

/**
 * Pedestrian graph: both sidewalks of every street, the bajada floor from its head down to the beach road, both
 * bridges, the park's paths and the beach promenade; nearby nodes join when the step between them is short, level
 * and does not cross the cut.
 */
export function barrancoGraph(def: BarrancoDef, c: CoastDef, hf: Heightfield): StreetGraph {
  const nodes: THREE.Vector3[] = [], edges: [number, number][] = [], E = def.extent - 6;
  const ground = (x: number, z: number) => walkHeight(def, c, hf, x, z);
  const add = (x: number, z: number) => nodes.push(new THREE.Vector3(x, ground(x, z), z)) - 1;
  const chain = (ids: number[]) => ids.forEach((id, i) => i && edges.push([ids[i - 1], id]));
  const ok = (x: number, z: number) => Math.abs(x) < E && Math.abs(z) < E && !overRavine(c, x, z, 1.5) && z < edgeZ(c, x) - 3;
  for (const a of [...def.avenues, { z: def.mural.z, half: def.mural.half, x0: undefined, x1: undefined }]) for (const s of [-1, 1]) {
    const row: number[] = [];
    for (let x = -E; x <= E; x += 8) {
      const z = a.z + s * (a.half + SIDEWALK / 2);
      if (x < (a.x0 ?? -1e9) || x > (a.x1 ?? 1e9)) [chain(row), row.length = 0];
      else if (ok(x, z) || (a.z === def.mural.z && Math.abs(z - def.mural.z) < 9)) row.push(add(x, z));
      else [chain(row), row.length = 0];
    }
    chain(row);
  }
  for (const st of def.streets) for (const s of [-1, 1]) {
    const row: number[] = [];
    for (let z = st.z0; z <= st.z1; z += 8) {
      const x = st.x + s * (st.half + SIDEWALK / 2);
      if (ok(x, z)) row.push(add(x, z));
      else [chain(row), row.length = 0];
    }
    chain(row);
  }
  const r = ravineOf(c), mouth = edgeZ(c, r.x) + c.run, floor: number[] = [];
  for (let z = r.head - 5; z < def.beachRoad.z - def.beachRoad.half - 1; z += 5) {
    const x = ravineCentre(r, Math.min(z, mouth)), under = z > r.head && z < mouth;
    floor.push(under ? nodes.push(new THREE.Vector3(x, ravineFloor(c, r, z) + 0.06, z)) - 1 : add(x, z));
  }
  chain(floor);
  for (const sd of [-1, 1]) {
    const lip: number[] = [];
    for (let z = r.head + 3; z < def.mirador.z - 8; z += 6) {
      const x = ravineCentre(r, z) + sd * (ravineHalf(c, r, z) + 2), b = bridgeSpan(c, def);
      if (Math.abs(z - b.z) < 3 && x > b.x0 - 2 && x < b.x1 + 2) [chain(lip), lip.length = 0];
      else lip.push(add(x, z));
    }
    chain(lip);
  }
  const b = bridgeSpan(c, def), deck: number[] = [];
  for (let x = b.x0 - 3; x <= b.x1 + 3; x += 4) deck.push(add(x, b.z));
  chain(deck);
  const p = def.park, ring: number[] = [];
  for (const [x, z] of [[p.x0 + 4, p.z0 + 4], [(p.x0 + p.x1) / 2, p.z0 + 4], [p.x1 - 4, p.z0 + 4], [p.x1 - 4, (p.z0 + p.z1) / 2], [p.x1 - 4, p.z1 - 4], [(p.x0 + p.x1) / 2, p.z1 - 4], [p.x0 + 4, p.z1 - 4], [p.x0 + 4, (p.z0 + p.z1) / 2]]) ring.push(add(x, z));
  chain([...ring, ring[0]]);
  const beach: number[] = [];
  for (let x = -E; x <= E; x += 8) beach.push(add(x, def.beachRoad.z - def.beachRoad.half - 1));
  chain(beach);
  const linked = new Set(edges.map(([a, b]) => `${Math.min(a, b)}:${Math.max(a, b)}`));
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const a = nodes[i], bb = nodes[j], d = Math.hypot(a.x - bb.x, a.z - bb.z);
    if (d > 9.5 || Math.abs(a.y - bb.y) > 1.2 || linked.has(`${i}:${j}`)) continue;
    const mx = (a.x + bb.x) / 2, mz = (a.z + bb.z) / 2, onDeck = (n: THREE.Vector3) => Math.abs(n.z - b.z) < 0.5 && n.x > b.x0 - 3.5 && n.x < b.x1 + 3.5;
    const deckHop = onDeck(a) || onDeck(bb), endOf = (n: THREE.Vector3) => n.x < b.x0 + 1 || n.x > b.x1 - 1;
    if (deckHop && !(onDeck(a) && onDeck(bb)) && !endOf(onDeck(a) ? a : bb)) continue;
    if (!deckHop && overRavine(c, mx, mz, 0.5) && Math.abs(ground(mx, mz) - a.y) > 1) continue;
    edges.push([i, j]);
    linked.add(`${i}:${j}`);
  }
  const exits = nodes.map((n, i) => (Math.abs(n.x) > E - 4 || n.z < -E + 4 ? i : -1)).filter((i) => i >= 0);
  return { nodes, edges, exits, ground };
}
