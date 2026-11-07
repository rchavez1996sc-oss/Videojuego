import * as THREE from 'three';

/** Door box in car metres (+z forward, ground at 0); unset values come from the wheels and the body. */
export interface DoorSpec { z0?: number; z1?: number; len?: number; y0?: number; y1?: number; depth?: number }

type Vert = number[][];
type Poly = Vert[];

/** Splits a polygon (vertices = attribute arrays, position first) by the plane `axis` = `v`: [below, above]. */
function split(p: Poly, axis: number, v: number): [Poly, Poly] {
  const lo: Poly = [], hi: Poly = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length], da = a[0][axis] - v, db = b[0][axis] - v;
    (da < 0 ? lo : hi).push(a);
    if ((da < 0) !== (db < 0)) {
      const t = da / (da - db), m = a.map((attr, k) => attr.map((x, j) => x + (b[k][j] - x) * t));
      lo.push(m);
      hi.push(m);
    }
  }
  return [lo.length >= 3 ? lo : [], hi.length >= 3 ? hi : []];
}

const fan = (p: Poly): Vert[] => p.slice(1, -1).flatMap((_, i) => [p[0], p[i + 1], p[i + 2]]);

/** Every vertex of a non-indexed geometry as attribute arrays (position first), in car space. */
function verts(g: THREE.BufferGeometry, m: THREE.Matrix4): { names: string[]; sizes: number[]; list: Vert[] } {
  const names = ['position', ...Object.keys(g.attributes).filter((n) => n !== 'position')], sizes = names.map((n) => g.attributes[n].itemSize);
  const nm = new THREE.Matrix3().getNormalMatrix(m), p = new THREE.Vector3(), list: Vert[] = [];
  for (let i = 0; i < g.attributes.position.count; i++)
    list.push(names.map((n, k) => {
      const a = g.attributes[n], v = Array.from({ length: sizes[k] }, (_, j) => a.getComponent(i, j));
      if (n === 'position') return p.fromArray(v).applyMatrix4(m).toArray();
      if (n === 'normal') return p.fromArray(v).applyMatrix3(nm).normalize().toArray();
      return v;
    }));
  return { names, sizes, list };
}

function build(names: string[], sizes: number[], groups: Vert[][], at: THREE.Vector3): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry(), all = groups.flat();
  names.forEach((n, k) => {
    const arr = new Float32Array(all.length * sizes[k]);
    all.forEach((v, i) => arr.set(n === 'position' ? [v[k][0] - at.x, v[k][1] - at.y, v[k][2] - at.z] : v[k], i * sizes[k]));
    g.setAttribute(n, new THREE.BufferAttribute(arr, sizes[k]));
  });
  let start = 0;
  groups.forEach((t, i) => (g.addGroup(start, t.length, i), (start += t.length)));
  return g;
}

/**
 * Front doors cut out of a body that has them fused in (the packs and Sketchfab models): on each side the skin
 * triangles (facing sideways, near the outer shell at their height) are clipped exactly to the door box, the inside
 * pieces become a node `<key>_doorL`/`_doorR` hinged at the front edge, the rest stays in the body. By default the
 * door runs from just behind the front wheel arch, `len` long, from above the sill to under the roof.
 */
export function cutDoors(car: THREE.Group, key: string, spec: DoorSpec = {}): string {
  car.updateMatrixWorld(true);
  const inv = car.matrixWorld.clone().invert(), local = (o: THREE.Object3D) => inv.clone().multiply(o.matrixWorld);
  const wheels = car.children.filter((o) => /_wheel\d$/.test(o.name)), bodies = car.children.filter((o): o is THREE.Mesh => (o as THREE.Mesh).isMesh);
  if (wheels.length < 4 || !bodies.length) return `${key}: no doors`;
  const data = bodies.map((m) => ({ m, g: m.geometry.index ? m.geometry.toNonIndexed() : m.geometry, mat: local(m) }));
  const box = new THREE.Box3();
  for (const d of data) box.union(new THREE.Box3().setFromBufferAttribute(d.g.attributes.position as THREE.BufferAttribute).applyMatrix4(d.mat));
  for (const w of wheels) box.union(new THREE.Box3().setFromObject(w).applyMatrix4(inv));
  const ground = box.min.y, hubs = wheels.map((w) => new THREE.Vector3().setFromMatrixPosition(local(w)));
  const zf = Math.max(...hubs.map((h) => h.z)), zr = Math.min(...hubs.map((h) => h.z)), r = Math.max(0.2, Math.min(...hubs.map((h) => h.y)) - ground), height = box.max.y - ground;
  const z1 = spec.z1 ?? zf - r * 1.12, z0 = spec.z0 ?? z1 - (spec.len ?? Math.min(1.12, 0.46 * (zf - zr)));
  const y0 = ground + (spec.y0 ?? r * 0.72), y1 = ground + (spec.y1 ?? height * 0.87), depth = spec.depth ?? 0.17;
  const prof = new Map<number, number>(), bucket = (y: number) => Math.round(y / 0.05);
  for (const d of data) for (const v of verts(d.g, d.mat).list) if (v[0][2] > z0 + 0.1 && v[0][2] < (z0 + z1) / 2) prof.set(bucket(v[0][1]), Math.max(prof.get(bucket(v[0][1])) ?? 0, Math.abs(v[0][0])));
  const raw = (y: number) => Math.max(prof.get(bucket(y)) ?? 0, prof.get(bucket(y) - 1) ?? 0, prof.get(bucket(y) + 1) ?? 0);
  let flank = 0;
  for (let y = y0; y < (y0 + y1) / 2; y += 0.05) flank = Math.max(flank, raw(y));
  /** The body's half width at a height, without the mirrors (capped at the flank of the lower half of the door). */
  const outer = (y: number) => Math.min(raw(y), flank);
  const doors = new Map<number, { parts: { m: THREE.Mesh; tris: Vert[][]; names: string[]; sizes: number[] }[] }>([[1, { parts: [] }], [-1, { parts: [] }]]);
  let cut = 0;
  for (const d of data) {
    const { names, sizes, list } = verts(d.g, d.mat), groups = d.g.groups.length ? d.g.groups : [{ start: 0, count: list.length, materialIndex: 0 }];
    const keep: Vert[][] = [], take = new Map<number, Vert[][]>([[1, []], [-1, []]]);
    for (const gr of groups) {
      const mi = gr.materialIndex ?? 0, k: Vert[] = (keep[mi] ??= []);
      const mat = ([] as THREE.Material[]).concat(d.m.material)[mi], reach = /glass/i.test(mat?.name ?? '') ? depth + 0.2 : depth;
      for (const s of [1, -1]) take.get(s)![mi] ??= [];
      for (let i = gr.start; i < gr.start + gr.count; i += 3) {
        const tri = [list[i], list[i + 1], list[i + 2]], [a, b, c] = tri.map((v) => new THREE.Vector3().fromArray(v[0]));
        const n = b.clone().sub(a).cross(c.clone().sub(a)).normalize(), mid = a.clone().add(b).add(c).divideScalar(3), s = Math.sign(mid.x) || 1;
        const side = Math.abs(n.x) > 0.25 && tri.every((v) => Math.sign(v[0][0]) === s || Math.abs(v[0][0]) < 0.02) && Math.abs(mid.x) > outer(mid.y) - reach;
        if (!side || Math.max(a.z, b.z, c.z) < z0 || Math.min(a.z, b.z, c.z) > z1 || Math.max(a.y, b.y, c.y) < y0 || Math.min(a.y, b.y, c.y) > y1) {
          k.push(...tri);
          continue;
        }
        let rest: Poly = tri, inside: Poly = [];
        const out: Poly[] = [];
        for (const [axis, v, keepLow] of [[2, z0, false], [2, z1, true], [1, y0, false], [1, y1, true]] as [number, number, boolean][]) {
          const [lo, hi] = split(rest, axis, v);
          out.push(keepLow ? hi : lo);
          rest = keepLow ? lo : hi;
          inside = rest;
          if (!rest.length) break;
        }
        for (const p of out) if (p.length) k.push(...fan(p));
        if (inside.length) (take.get(s)![mi].push(...fan(inside)), cut++);
      }
    }
    d.m.geometry = build(names, sizes, keep.map((t) => t ?? []), new THREE.Vector3());
    d.m.matrix.identity().decompose(d.m.position, d.m.quaternion, d.m.scale);
    for (const s of [1, -1]) doors.get(s)!.parts.push({ m: d.m, tris: take.get(s)!.map((t) => t ?? []), names, sizes });
  }
  for (const [s, door] of doors) {
    const node = new THREE.Group(), hinge = new THREE.Vector3(s * outer((y0 + y1) / 2), ground, z1);
    node.name = `${key}_door${s > 0 ? 'L' : 'R'}`;
    node.position.copy(hinge);
    for (const p of door.parts) if (p.tris.some((t) => t.length)) {
      const mesh = new THREE.Mesh(build(p.names, p.sizes, p.tris, hinge), p.m.material);
      mesh.name = `${node.name}_${p.m.name}_part`;
      node.add(mesh);
    }
    if (node.children.length) car.add(node);
  }
  return `${key}: doors z ${z0.toFixed(2)}…${z1.toFixed(2)} y ${(y0 - ground).toFixed(2)}…${(y1 - ground).toFixed(2)} r ${r.toFixed(2)} cut ${cut} tris`;
}
