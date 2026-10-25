import * as THREE from 'three';
import type { StreetGraph } from '../barrio';

/** A footprint: centre, width along its own x, depth, rotation (degrees from +x towards +z). */
export interface Rect { x: number; z: number; w: number; d: number; yaw: number }
export interface CampusRoad { name: string; w: number; pts: [number, number][] }
export interface CampusBuilding extends Rect {
  floors: number;
  style: 'courtyard' | 'single';
  skin?: 'band' | 'frame' | 'punched' | 'panels' | 'grid' | 'bio' | 'framed';
  /** Wall colour key (cream, grey, white, yellow, stone); spandrel colour (orange…) and ground-floor colour override it. */
  color: string;
  spandrel?: string;
  base?: string;
  accent?: 'red';
  name?: string;
  key?: string;
}

/** Ciudad Universitaria (UNMSM) sector, from the user's Google Maps sketches; Av. Venezuela runs along +x at `venezuela.z`. */
export interface CampusDef {
  seed: number;
  venezuela: { z: number; half: number; median: number; sidewalk: number };
  /** Walkable campus: west < x < x (east), z > north (walled on the north and east, open towards the Huaca); `south` bounds the avenue side. */
  bounds: { x: number; west: number; north: number; south: number };
  gate1: { x: number; z: number; yaw: number };
  gate2?: { x: number; z: number; yaw: number };
  plazuela?: import('./plazuela').PlazuelaDef;
  /** Av. Universitaria beyond the east fence: centre x and half width (decor only). */
  universitaria?: { x: number; half: number };
  field: Rect;
  parkings: Rect[];
  /** Parque del Comedor: local −z side runs along the dining hall. */
  park: Rect;
  roads: CampusRoad[];
  buildings: CampusBuilding[];
  stadium: { x: number; z: number; rx: number; rz: number };
  huaca: { x: number; z: number; rx: number; rz: number; h: number };
}

export const UP = new THREE.Vector3(0, 1, 0);
export const yawQ = (deg: number) => new THREE.Quaternion().setFromAxisAngle(UP, (-deg * Math.PI) / 180);

/** Local → world for a footprint: x along its width, z along its depth, y above `y0`. */
export function framer(r: { x: number; z: number; yaw: number }, y0 = 0): (x: number, y: number, z: number) => THREE.Vector3 {
  const q = yawQ(r.yaw), o = new THREE.Vector3(r.x, y0, r.z);
  return (x, y, z) => new THREE.Vector3(x, y, z).applyQuaternion(q).add(o);
}

export function inRect(r: Rect, x: number, z: number, margin = 0): boolean {
  const a = (r.yaw * Math.PI) / 180, dx = x - r.x, dz = z - r.z;
  return Math.abs(dx * Math.cos(a) + dz * Math.sin(a)) < r.w / 2 + margin && Math.abs(-dx * Math.sin(a) + dz * Math.cos(a)) < r.d / 2 + margin;
}

/** Points every `step` metres along a polyline (ends included). */
export function sample(pts: [number, number][], step: number): THREE.Vector2[] {
  const out: THREE.Vector2[] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = new THREE.Vector2(...pts[i]), b = new THREE.Vector2(...pts[i + 1]), n = Math.max(1, Math.round(a.distanceTo(b) / step));
    for (let k = i ? 1 : 0; k <= n; k++) out.push(a.clone().lerp(b, k / n));
  }
  return out;
}

/** The same polyline shifted sideways by `off` (left of travel when positive). */
export function offset(pts: [number, number][], off: number): [number, number][] {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
    return [p[0] + (dz / l) * off, p[1] - (dx / l) * off];
  });
}

/**
 * Walkable graph: the sidewalks on both sides of every campus road and Av. Venezuela's north sidewalk, sampled
 * every ~8 m, joined where they come close; nodes inside buildings are dropped.
 */
export function campusGraph(def: CampusDef, solid: (x: number, z: number) => boolean): StreetGraph {
  const nodes: THREE.Vector3[] = [], edges: [number, number][] = [];
  const b = def.bounds, v = def.venezuela;
  const side = v.z - v.half - v.sidewalk;
  const lines: [number, number][][] = [[[-b.x + 4, side + v.sidewalk / 2], [b.x - 4, side + v.sidewalk / 2]]];
  for (const r of def.roads) for (const s of [-1, 1]) lines.push(offset(r.pts, s * (r.w / 2 + 1.4)));
  const ok = (p: THREE.Vector2) => Math.abs(p.x) < b.x - 3 && p.y < b.south && !solid(p.x, p.y) && (p.y > side || (p.x > b.west + 3 && p.y > b.north + 3));
  for (const line of lines) {
    let prev = -1;
    for (const p of sample(line, 8)) {
      if (!ok(p)) {
        prev = -1;
        continue;
      }
      const k = nodes.push(new THREE.Vector3(p.x, 0, p.y)) - 1;
      if (prev >= 0) edges.push([prev, k]);
      prev = k;
    }
  }
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const d = nodes[i].distanceTo(nodes[j]);
    if (d < 9 && !edges.some(([a, c]) => (a === i && c === j) || (a === j && c === i))) {
      const mid = nodes[i].clone().lerp(nodes[j], 0.5);
      if (!solid(mid.x, mid.z)) edges.push([i, j]);
    }
  }
  const exits = nodes.map((n, k) => [n, k] as const).filter(([n]) => Math.abs(n.x) > b.x - 14).map(([, k]) => k);
  return { nodes, edges, exits };
}
