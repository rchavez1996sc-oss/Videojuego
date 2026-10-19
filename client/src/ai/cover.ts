import * as THREE from 'three';

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

  /** Candidates near `from` whose obstacle sits between the spot and `threat`, best first. */
  candidates(from: THREE.Vector3, threat: THREE.Vector3, radius: number, preferred: number, self: number): CoverPoint[] {
    const out: { c: CoverPoint; score: number }[] = [];
    const toThreat = new THREE.Vector3();
    for (const c of this.points) {
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
