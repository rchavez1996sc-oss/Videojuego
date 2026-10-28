import * as THREE from 'three';
import type { Ground } from '../audio/sfx';

/** Footstep ground of paths laid as flat strips over the terrain (no collider), by material name. */
export function groundOfMaterial(mat: string): Ground {
  return /gravel|pebble|sand/i.test(mat) ? 'dirt' : /lawn|turf|grass/i.test(mat) ? 'grass' : /wood|deck|plank/i.test(mat) ? 'wood' : 'hard';
}

const CELL = 8, grid = new Map<number, { a: THREE.Vector2; c: THREE.Vector2; hw: number; g: Ground; top: number }[]>();
const key = (i: number, j: number) => i * 4099 + j;

/**
 * Registers a strip (polyline with width) so footsteps over it sound like its material, not the ground below;
 * `top` is its walking height (NaN: follows the terrain), so strips only count for feet at that level.
 */
export function addStrip(pts: THREE.Vector2[], width: number, mat: string, top = NaN): void {
  const g = groundOfMaterial(mat), hw = width / 2;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], c = pts[i + 1], seg = { a, c, hw, g, top };
    const x0 = Math.floor((Math.min(a.x, c.x) - hw) / CELL), x1 = Math.floor((Math.max(a.x, c.x) + hw) / CELL);
    const z0 = Math.floor((Math.min(a.y, c.y) - hw) / CELL), z1 = Math.floor((Math.max(a.y, c.y) + hw) / CELL);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) (grid.get(key(x, z)) ?? grid.set(key(x, z), []).get(key(x, z))!).push(seg);
  }
}

/** Ground of the strip under the feet at (x, y, z), if any. */
export function stripAt(x: number, y: number, z: number): Ground | null {
  for (const s of grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL))) ?? []) {
    if (Math.abs(y - s.top) > 0.45) continue;
    const dx = s.c.x - s.a.x, dz = s.c.y - s.a.y, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - s.a.x) * dx + (z - s.a.y) * dz) / l2));
    if (Math.hypot(x - s.a.x - dx * t, z - s.a.y - dz * t) < s.hw) return s.g;
  }
  return null;
}

export function clearStrips(): void {
  grid.clear();
}
