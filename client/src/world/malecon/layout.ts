import * as THREE from 'three';
import { edgeZ, type CoastDef } from '../coast';
import type { Heightfield } from '../heightfield';
import type { StreetGraph } from '../barrio';

/** Seafront district: towers inland (−z), the avenue, the clifftop park, a mall cut into the cliff and the beach road. */
export interface MaleconDef {
  seed: number;
  avenue: { z: number; half: number };
  /** Streets along x (z centres) and along z (x centres) of the tower blocks. */
  streets: { z: number[]; x: number[]; half: number };
  /** Street along x turned into a dual carriageway with a tree-lined promenade (berma) in the middle. */
  boulevard?: { z: number; median: number };
  beachRoad: { z: number; half: number };
  lighthouse: { x: number; z: number };
  amor: { x: number; w: number };
  bridge: { z: number; width: number };
  larcomar: { x0: number; x1: number; z0: number; y: number };
  launch: { x: number; w: number };
  paragliders: number;
  surfers?: number;
  busts?: import('./monuments').BustDef[];
  propaganda?: import('./propaganda').PropagandaDef;
  parkedCars: number;
}

export const EXTENT = 232;
export const SIDEWALK = 4.5;

/** Half width of the street along x at `z` (a boulevard counts both carriageways and the median). */
export function streetHalf(def: MaleconDef, z: number): number {
  return def.boulevard?.z === z ? def.boulevard.median / 2 + 7 : def.streets.half;
}

/** Main promenade: runs a few metres inside the cliff fence, wandering a little. */
export function promenadeZ(c: CoastDef, x: number): number {
  return edgeZ(c, x) - 7 - 2.5 * Math.sin(x / 23);
}

/** Inner path along the park, next to the avenue's sea-side pavement. */
export function innerPathZ(def: MaleconDef, x: number): number {
  return def.avenue.z + def.avenue.half + SIDEWALK + 6 + 3 * Math.sin(x / 31 + 1);
}

/** Does x fall on the ravine (where only the bridge crosses)? */
export function overRavine(c: CoastDef, x: number, z: number, margin = 0): boolean {
  return (c.ravines ?? []).some((r) => z > r.head - 14 && Math.abs(x - r.x) < r.width / 2 * (0.32 + 0.68 * Math.max(0, Math.min(1, (z - r.head) / (edgeZ(c, r.x) + c.run - r.head)))) + margin);
}

/** Ravine half width where the bridge crosses. */
export function bridgeSpan(c: CoastDef, def: MaleconDef): { x0: number; x1: number } {
  const r = c.ravines![0];
  let x0 = r.x, x1 = r.x;
  while (overRavine(c, x0, def.bridge.z, 3)) x0 -= 1;
  while (overRavine(c, x1, def.bridge.z, 3)) x1 += 1;
  return { x0, x1 };
}

export function inLarcomar(def: MaleconDef, c: CoastDef, x: number, z: number, margin = 0): boolean {
  const l = def.larcomar;
  return x > l.x0 - margin && x < l.x1 + margin && z > l.z0 - margin && z < edgeZ(c, x) + margin;
}

/** Walkable network: pavements of every street, the two park paths with cross links, bridge and mall plaza. */
export function maleconGraph(def: MaleconDef, c: CoastDef, hf: Heightfield): StreetGraph {
  const nodes: THREE.Vector3[] = [], edges: [number, number][] = [];
  const add = (x: number, z: number, y?: number) => nodes.push(new THREE.Vector3(x, y ?? hf.heightAt(x, z), z)) - 1;
  const link = (a: number, b: number) => edges.push([a, b]);
  const xs: number[] = [];
  for (let x = -EXTENT + 8; x <= EXTENT - 8; x += 16) xs.push(x);
  const bs = bridgeSpan(c, def), l = def.larcomar;
  const onBridge = (x: number) => x > bs.x0 - 4 && x < bs.x1 + 4;
  const rows: { z: (x: number) => number; ok: (x: number, z: number) => boolean; street?: number; paseo?: boolean }[] = [];
  const pave = def.avenue.half + 1.6;
  for (const sz of def.streets.z) for (const s of [-1, 1]) {
    rows.push({ z: () => sz + s * (streetHalf(def, sz) + 1.6), ok: () => true, street: sz });
    if (s < 0 && def.boulevard?.z === sz) rows.push({ z: () => sz, ok: () => true, street: sz, paseo: true });
  }
  rows.push({ z: () => def.avenue.z - pave, ok: () => true });
  rows.push({ z: () => def.avenue.z + pave, ok: () => true });
  rows.push({ z: (x) => innerPathZ(def, x), ok: (x, z) => !overRavine(c, x, z, 2) && !inLarcomar(def, c, x, z, 2) });
  rows.push({ z: (x) => (onBridge(x) ? def.bridge.z : promenadeZ(c, x)), ok: (x, z) => onBridge(x) || (!overRavine(c, x, z, 2) && !inLarcomar(def, c, x, z, 3)) });
  const last = rows.length - 1;
  const grid = rows.map((r, ri) => xs.map((x) => {
    const z = r.z(x);
    return r.ok(x, z) ? add(x, z, ri === last && onBridge(x) ? 0.35 : undefined) : -1;
  }));
  for (const row of grid) for (let i = 0; i + 1 < row.length; i++) if (row[i] >= 0 && row[i + 1] >= 0) link(row[i], row[i + 1]);
  const crossing = (x: number) => def.streets.x.some((sx) => Math.abs(sx - x) < 9);
  for (let i = 0; i < xs.length; i++) {
    for (let r = 0; r + 1 < grid.length; r++) {
      const a = grid[r][i], b = grid[r + 1][i];
      if (a < 0 || b < 0) continue;
      const parkLink = r >= grid.length - 3;
      const sameStreet = r < grid.length - 3 && rows[r].street !== undefined && rows[r].street === rows[r + 1].street && !rows[r].paseo && !rows[r + 1].paseo;
      if (parkLink ? i % 3 === 1 : sameStreet || crossing(xs[i])) link(a, b);
    }
  }
  const cx = (l.x0 + l.x1) / 2, zEdge = Math.min(edgeZ(c, l.x0 + 8), edgeZ(c, l.x1 - 8), edgeZ(c, cx)) - 0.8;
  const stairEnd = l.z0 + 0.6 + Math.ceil(-l.y / 0.25) * 0.4;
  const ring = [add(cx - 24, l.z0 + 10, l.y), add(cx - 2, stairEnd + 1.5, l.y), add(cx + 2, zEdge - 5, l.y), add(cx - 24, zEdge - 5, l.y)];
  ring.forEach((a, k) => link(a, ring[(k + 1) % ring.length]));
  const top = add(cx - 2, l.z0 - 4, 0);
  link(top, ring[1]);
  const inner = grid[grid.length - 2];
  const near = inner.filter((k) => k >= 0).sort((a, b) => nodes[a].distanceTo(nodes[top]) - nodes[b].distanceTo(nodes[top]))[0];
  link(top, near);
  const beach = xs.map((x) => add(x, def.beachRoad.z - def.beachRoad.half - 1.6));
  for (let i = 0; i + 1 < beach.length; i++) link(beach[i], beach[i + 1]);
  const ends = [...grid, beach].flatMap((row) => [row.find((k) => k >= 0)!, [...row].reverse().find((k) => k >= 0)!]);
  const ground = (x: number, z: number) => {
    if (Math.abs(z - def.bridge.z) < def.bridge.width / 2 && onBridge(x)) return 0.35;
    if (x > l.x0 + 12 && x < l.x1 - 12 && z > l.z0 && z < zEdge) {
      if (Math.abs(x - (cx - 2)) < 1.8 && z < stairEnd) return Math.min(0, Math.max(l.y, l.y * (z - l.z0 - 0.6) / (stairEnd - l.z0 - 0.6)));
      return l.y;
    }
    return hf.heightAt(x, z);
  };
  return { nodes, edges, exits: ends, ground };
}
