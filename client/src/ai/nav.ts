import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { StreetGraph } from '../world/barrio';

/** A* over the street graph: turns "go there" into a list of street corners to walk through. */
export class StreetNav {
  private neighbors: number[][];
  /** Optional line-of-sight test: the start/end corner must be reachable in a straight line (not behind a fence or wall). */
  clear: ((a: THREE.Vector3, b: THREE.Vector3) => boolean) | null = null;

  constructor(private g: StreetGraph) {
    this.neighbors = g.nodes.map(() => []);
    for (const [a, b] of g.edges) {
      this.neighbors[a].push(b);
      this.neighbors[b].push(a);
    }
  }

  get nodes(): THREE.Vector3[] {
    return this.g.nodes;
  }

  nearest(p: THREE.Vector3): number {
    const near: [number, number][] = [];
    this.g.nodes.forEach((n, i) => {
      const d = (n.x - p.x) ** 2 + (n.z - p.z) ** 2;
      if (near.length < 6 || d < near[near.length - 1][1]) {
        near.push([i, d]);
        near.sort((a, b) => a[1] - b[1]);
        if (near.length > 6) near.pop();
      }
    });
    if (!this.clear) return near[0][0];
    return near.find(([i]) => this.clear!(p, this.g.nodes[i]))?.[0] ?? near[0][0];
  }

  /** Corners between `from` and `to` (excluding `to` itself). Empty when both are by the same corner. */
  route(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] {
    const start = this.nearest(from), goal = this.nearest(to);
    if (start === goal) return [this.g.nodes[start].clone()];
    const nodes = this.g.nodes;
    const gScore = new Map<number, number>([[start, 0]]);
    const came = new Map<number, number>();
    const open = new Set([start]);
    const h = (i: number) => nodes[i].distanceTo(nodes[goal]);
    while (open.size) {
      let cur = -1, bestF = Infinity;
      for (const i of open) {
        const f = (gScore.get(i) ?? Infinity) + h(i);
        if (f < bestF) {
          bestF = f;
          cur = i;
        }
      }
      if (cur === goal) break;
      open.delete(cur);
      for (const n of this.neighbors[cur]) {
        const tentative = (gScore.get(cur) ?? Infinity) + nodes[cur].distanceTo(nodes[n]);
        if (tentative < (gScore.get(n) ?? Infinity)) {
          came.set(n, cur);
          gScore.set(n, tentative);
          open.add(n);
        }
      }
    }
    const path: THREE.Vector3[] = [];
    for (let c: number | undefined = goal; c !== undefined; c = came.get(c)) path.unshift(nodes[c].clone());
    return path;
  }
}

/** Straight-line walkability between two points: no fixed collider (wall, fence, building) at waist height. */
export function walkClear(world: RAPIER.World): (a: THREE.Vector3, b: THREE.Vector3) => boolean {
  return (a, b) => {
    const from = { x: a.x, y: a.y + 1, z: a.z }, d = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z), len = d.length();
    if (len < 0.5) return true;
    d.divideScalar(len);
    return !world.castRay(new RAPIER.Ray(from, d), len, true, RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC | RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC | RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);
  };
}
