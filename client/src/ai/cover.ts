import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export interface CoverPoint { pos: THREE.Vector3; normal: THREE.Vector3; owner: number }

/** Flat list of cover spots; `normal` points from the obstacle towards the spot. */
export class CoverIndex {
  readonly points: CoverPoint[] = [];

  add(x: number, z: number, nx: number, nz: number): void {
    this.points.push({ pos: new THREE.Vector3(x, 0, z), normal: new THREE.Vector3(nx, 0, nz).normalize(), owner: -1 });
  }

  /** Adds spots along both long faces of an oriented box footprint (XZ). */
  addBox(center: THREE.Vector3, size: [number, number, number], quat: THREE.Quaternion): void {
    if (size[1] < 0.9) return;
    const ax = new THREE.Vector3(1, 0, 0).applyQuaternion(quat).setY(0).normalize();
    const az = new THREE.Vector3(0, 0, 1).applyQuaternion(quat).setY(0).normalize();
    const faces: [THREE.Vector3, THREE.Vector3, number, number][] = [
      [az, ax, size[2] / 2, size[0]],
      [ax, az, size[0] / 2, size[2]],
    ];
    for (const [n, along, half, len] of faces) {
      if (len < 1.2) continue;
      const count = Math.max(1, Math.floor(len / 2.2));
      for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count - 0.5;
        for (const s of [1, -1]) {
          const p = center.clone().addScaledVector(along, t * len).addScaledVector(n, s * (half + 0.75));
          this.add(p.x, p.z, n.x * s, n.z * s);
        }
      }
    }
  }

  addRound(center: THREE.Vector3, radius: number): void {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      this.add(center.x + Math.cos(a) * (radius + 0.7), center.z + Math.sin(a) * (radius + 0.7), Math.cos(a), Math.sin(a));
    }
  }

  /**
   * Drops spots that are unusable: under a roof (inside a house), inside solid geometry,
   * or with no clear standing room. Call once the world is fully built.
   */
  prune(world: RAPIER.World, groundY: (x: number, z: number) => number): void {
    const up = { x: 0, y: 1, z: 0 }, origin = { x: 0, y: 0, z: 0 };
    const keep = this.points.filter((c) => {
      origin.x = c.pos.x;
      origin.y = groundY(c.pos.x, c.pos.z) + 0.9;
      origin.z = c.pos.z;
      return !world.castRay(new RAPIER.Ray(origin, up), 40, true);
    });
    this.points.length = 0;
    this.points.push(...keep);
    this.grid.clear();
    for (const c of this.points) {
      const k = this.key(c.pos.x, c.pos.z);
      (this.grid.get(k) ?? this.grid.set(k, []).get(k)!).push(c);
    }
  }

  private grid = new Map<string, CoverPoint[]>();
  private static CELL = 16;

  private key(x: number, z: number): string {
    return `${Math.floor(x / CoverIndex.CELL)},${Math.floor(z / CoverIndex.CELL)}`;
  }

  /** Points in grid cells overlapping a square of half-size `r` (all points before `prune` built the grid). */
  private near(x: number, z: number, r: number): CoverPoint[] {
    if (!this.grid.size) return this.points;
    const out: CoverPoint[] = [], C = CoverIndex.CELL;
    for (let gx = Math.floor((x - r) / C); gx <= Math.floor((x + r) / C); gx++) {
      for (let gz = Math.floor((z - r) / C); gz <= Math.floor((z + r) / C); gz++) out.push(...(this.grid.get(`${gx},${gz}`) ?? []));
    }
    return out;
  }

  /** Candidates near `from` whose obstacle sits between the spot and `threat`, best first. */
  candidates(from: THREE.Vector3, threat: THREE.Vector3, radius: number, preferred: number, self: number): CoverPoint[] {
    const out: { c: CoverPoint; score: number }[] = [];
    const toThreat = new THREE.Vector3();
    for (const c of this.near(from.x, from.z, radius)) {
      if (c.owner !== -1 && c.owner !== self) continue;
      const dE = Math.hypot(c.pos.x - from.x, c.pos.z - from.z);
      if (dE > radius) continue;
      toThreat.set(threat.x - c.pos.x, 0, threat.z - c.pos.z);
      const dP = toThreat.length();
      if (dP < 7) continue;
      if (c.normal.dot(toThreat.divideScalar(dP)) > -0.35) continue;
      out.push({ c, score: dE + Math.abs(dP - preferred) * 0.45 });
    }
    return out.sort((a, b) => a.score - b.score).slice(0, 8).map((o) => o.c);
  }
}

export const cover = new CoverIndex();
