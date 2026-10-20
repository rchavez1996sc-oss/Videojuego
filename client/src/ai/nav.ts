import * as THREE from 'three';
import type { StreetGraph } from '../world/barrio';

/** A* over the street graph: turns "go there" into a list of street corners to walk through. */
export class StreetNav {
  private neighbors: number[][];

  constructor(private g: StreetGraph) {
    this.neighbors = g.nodes.map(() => []);
    for (const [a, b] of g.edges) {
      this.neighbors[a].push(b);
      this.neighbors[b].push(a);
    }
  }

  nearest(p: THREE.Vector3): number {
    let best = 0, bd = Infinity;
    this.g.nodes.forEach((n, i) => {
      const d = (n.x - p.x) ** 2 + (n.z - p.z) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
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
