import type * as THREE from 'three';

/**
 * A walk with a purpose: a destination node 40–160 m away (a shop, a bus stop, home) and the shortest hop path to it
 * over the street graph, so passers-by cross whole blocks instead of drifting node to node and doubling back.
 */
export function errand(neighbors: number[][], nodes: THREE.Vector3[], from: number, rand: () => number = Math.random): number[] {
  const prev = new Int32Array(nodes.length).fill(-1), queue = [from], far: number[] = [];
  prev[from] = from;
  for (let h = 0; h < queue.length; h++) {
    const n = queue[h], d = Math.hypot(nodes[n].x - nodes[from].x, nodes[n].z - nodes[from].z);
    if (d > 40 && d < 160) far.push(n);
    for (const m of neighbors[n]) if (prev[m] < 0) (prev[m] = n), queue.push(m);
  }
  const goal = far.length ? far[Math.floor(rand() * far.length)] : queue[queue.length - 1];
  const path: number[] = [];
  for (let n = goal; n !== from && n >= 0; n = prev[n]) path.push(n);
  return path.reverse();
}
