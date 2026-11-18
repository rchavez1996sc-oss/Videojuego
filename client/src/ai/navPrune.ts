import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { StreetGraph } from '../world/barrio';
import { surfaceOf } from '../world/surfaces';

const SOLID = RAPIER.QueryFilterFlags.ONLY_FIXED | RAPIER.QueryFilterFlags.EXCLUDE_SENSORS;

/**
 * Cleans the walking graph once the level's colliders exist: nudges a node off a trunk or post to free ground
 * within 1.5 m, drops nodes standing inside a larger solid (a plaza laid over
 * a casona's plinth, a bench, a kiosk) and edges that cross a wall or fence at waist or chest height, and nodes left without
 * any edge. Police, squad, civilians, pigeons and spawns all walk this graph, so a node inside a
 * building used to trap whoever was routed through it. Mutates `g` in place (its arrays are shared).
 */
export function pruneGraph(g: StreetGraph, world: RAPIER.World, apply = true): string {
  const ball = new RAPIER.Ball(0.22), rot = { x: 0, y: 0, z: 0, w: 1 };
  const notGround = (c: RAPIER.Collider) => c.shape.type !== RAPIER.ShapeType.HeightField;
  const inside = (p: THREE.Vector3) => [0.55, 1.1, 1.6].some((h) => !!world.intersectionWithShape({ x: p.x, y: p.y + h, z: p.z }, rot, ball, SOLID, undefined, undefined, undefined, notGround));
  const crosses = (a: THREE.Vector3, b: THREE.Vector3) => {
    const d = new THREE.Vector3().subVectors(b, a), len = d.length();
    if (len <= 0.3) return false;
    d.divideScalar(len);
    const side = new THREE.Vector3(-d.z, 0, d.x).normalize();
    return [0.6, 1.2].every((h) => [-0.45, 0, 0.45].every((o) => !!world.castRay(new RAPIER.Ray({ x: a.x + side.x * o, y: a.y + h, z: a.z + side.z * o }, d), len, true, SOLID, undefined, undefined, undefined, notGround)));
  };
  const pieces = (es: [number, number][], skip: boolean[]) => {
    const adj = g.nodes.map(() => [] as number[]), seen = new Uint8Array(g.nodes.length), sizes: number[] = [];
    for (const [a, b] of es) adj[a].push(b), adj[b].push(a);
    g.nodes.forEach((_, s) => {
      if (seen[s] || skip[s] || !adj[s].length) return;
      let n = 1;
      seen[s] = 1;
      for (const st = [s]; st.length; ) for (const t of adj[st.pop()!]) if (!seen[t]) (seen[t] = 1), st.push(t), n++;
      sizes.push(n);
    });
    return sizes.sort((a, b) => b - a).join('/');
  };
  const bad = g.nodes.map((p) => {
    if (!inside(p)) return false;
    for (const r of [0.7, 1.1, 1.5]) for (let k = 0; k < 8; k++) {
      const q = p.clone().add(new THREE.Vector3(Math.cos((k * Math.PI) / 4) * r, 0, Math.sin((k * Math.PI) / 4) * r));
      if (!inside(q)) return p.copy(q), false;
    }
    return true;
  });
  const blocked: [number, number][] = [], edges = g.edges.filter((e) => !bad[e[0]] && !bad[e[1]] && (!crosses(g.nodes[e[0]], g.nodes[e[1]]) || (blocked.push(e), false)));
  const root = g.nodes.map((_, i) => i), find = (i: number): number => (root[i] === i ? i : (root[i] = find(root[i])));
  for (const [a, b] of edges) root[find(a)] = find(b);
  const links: string[] = [];
  for (const [a, b] of blocked) if (find(a) !== find(b)) (root[find(a)] = find(b)), edges.push([a, b]), links.push(`${g.nodes[a].x.toFixed(0)},${g.nodes[a].z.toFixed(0)}→${g.nodes[b].x.toFixed(0)},${g.nodes[b].z.toFixed(0)}`);
  if (links.length) console.info("[nav] blocked but only link", links.join(' '));
  const deg = new Uint16Array(g.nodes.length);
  for (const [a, b] of edges) deg[a]++, deg[b]++;
  const keep = g.nodes.map((_, i) => !bad[i] && deg[i] > 0);
  const report = `nodes ${g.nodes.length} inside ${bad.filter(Boolean).length} edges ${g.edges.length} cut ${g.edges.length - edges.length} pieces ${pieces(g.edges, [])} → ${pieces(edges, bad)} dropped ${keep.filter((k) => !k).length}`;
  if (location.search.includes('navlog')) {
    const tally: Record<string, number> = {};
    for (const [a, b] of g.edges) {
      const A = g.nodes[a], B = g.nodes[b], d = new THREE.Vector3().subVectors(B, A), len = d.length();
      if (bad[a] || bad[b] || len <= 0.3) continue;
      const hit = world.castRay(new RAPIER.Ray({ x: A.x, y: A.y + 1.2, z: A.z }, d.divideScalar(len)), len, true, SOLID, undefined, undefined, undefined, notGround);
      const low = world.castRay(new RAPIER.Ray({ x: A.x, y: A.y + 0.6, z: A.z }, d.clone()), len, true, SOLID, undefined, undefined, undefined, notGround);
      if (!hit || !low) continue;
      const c = hit.collider, h = c.shape.type === RAPIER.ShapeType.Cuboid ? (c.shape as RAPIER.Cuboid).halfExtents : null, t = c.translation();
      const k = `${surfaceOf(c.handle)} ${h ? `${(h.x * 2).toFixed(1)}x${(h.y * 2).toFixed(1)}x${(h.z * 2).toFixed(1)}` : c.shape.type} @${t.x.toFixed(0)},${t.y.toFixed(1)},${t.z.toFixed(0)}`;
      tally[k] = (tally[k] ?? 0) + 1;
    }
    const ins: Record<string, number> = {};
    g.nodes.forEach((p, i) => {
      if (!bad[i]) return;
      for (const h of [0.55, 1.1, 1.6]) {
        const c = world.intersectionWithShape({ x: p.x, y: p.y + h, z: p.z }, rot, ball, SOLID, undefined, undefined, undefined, notGround);
        if (c) { const k = `${surfaceOf(c.handle)} ${c.shape.type} node ${p.x.toFixed(0)},${p.y.toFixed(1)},${p.z.toFixed(0)} h${h}`; ins[k] = 1; break; }
      }
    });
    console.info('[nav] inside', Object.keys(ins).slice(0, 25).join(' | '));
    console.info('[nav] cuts', JSON.stringify(Object.entries(tally).sort((x, y) => y[1] - x[1]).slice(0, 25)));
  }
  if (!apply) return report;
  const map = new Int32Array(g.nodes.length).fill(-1);
  const nodes = g.nodes.filter((_, i) => keep[i] && ((map[i] = 0), true));
  let k = 0;
  g.nodes.forEach((_, i) => keep[i] && (map[i] = k++));
  const kept = edges.filter(([a, b]) => keep[a] && keep[b]).map(([a, b]) => [map[a], map[b]] as [number, number]);
  const exits = g.exits.filter((i) => keep[i]).map((i) => map[i]);
  g.nodes.splice(0, g.nodes.length, ...nodes);
  g.edges.splice(0, g.edges.length, ...kept);
  g.exits.splice(0, g.exits.length, ...exits);
  return report;
}
