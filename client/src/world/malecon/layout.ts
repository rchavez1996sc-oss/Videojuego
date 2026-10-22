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
  beachRoad: { z: number; half: number };
  lighthouse: { x: number; z: number };
  amor: { x: number; w: number };
  bridge: { z: number; width: number };
  larcomar: { x0: number; x1: number; z0: number; y: number };
  launch: { x: number; w: number };
  paragliders: number;
  parkedCars: number;
}

export const EXTENT = 232;
export const SIDEWALK = 4.5;

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
  const rows: { z: (x: number) => number; ok: (x: number, z: number) => boolean }[] = [];
  const pave = def.avenue.half + 1.6;
  for (const sz of def.streets.z) for (const s of [-1, 1]) rows.push({ z: () => sz + s * (def.streets.half + 1.6), ok: () => true });
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
      const sameStreet = r < grid.length - 3 && Math.abs(nodes[a].z - nodes[b].z) < def.streets.half * 2 + 5;
      if (parkLink ? i % 3 === 1 : sameStreet || crossing(xs[i])) link(a, b);
    }
  }
  const plaza = [add((l.x0 + l.x1) / 2 - 15, l.z0 + 14, l.y), add((l.x0 + l.x1) / 2 + 15, l.z0 + 14, l.y), add((l.x0 + l.x1) / 2, l.z0 + 24, l.y)];
  link(plaza[0], plaza[1]); link(plaza[1], plaza[2]); link(plaza[2], plaza[0]);
  const top = add((l.x0 + l.x1) / 2, l.z0 - 6), stairFoot = add((l.x0 + l.x1) / 2, l.z0 + 6, l.y);
  link(top, stairFoot); link(stairFoot, plaza[0]); link(stairFoot, plaza[1]);
  const inner = grid[grid.length - 2];
  const near = inner.filter((k) => k >= 0).sort((a, b) => nodes[a].distanceTo(nodes[top]) - nodes[b].distanceTo(nodes[top]))[0];
  link(top, near);
  const ends = grid.flatMap((row) => [row.find((k) => k >= 0)!, [...row].reverse().find((k) => k >= 0)!]);
  return { nodes, edges, exits: ends };
}
