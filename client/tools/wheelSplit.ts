import * as THREE from 'three';

interface Island { mesh: THREE.Mesh; tris: number[]; box: THREE.Box3 }

/** Connected pieces of a non-indexed mesh (triangles welded by position, 1 mm). */
function islands(mesh: THREE.Mesh): Island[] {
  const pos = mesh.geometry.attributes.position, tris = pos.count / 3, parent = new Int32Array(tris).map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const seen = new Map<string, number>();
  for (let t = 0; t < tris; t++)
    for (let k = 0; k < 3; k++) {
      const v = t * 3 + k, key = `${Math.round(pos.getX(v) * 1000)},${Math.round(pos.getY(v) * 1000)},${Math.round(pos.getZ(v) * 1000)}`, o = seen.get(key);
      if (o === undefined) seen.set(key, t);
      else parent[find(t)] = find(o);
    }
  const by = new Map<number, Island>(), p = new THREE.Vector3();
  for (let t = 0; t < tris; t++) {
    const r = find(t);
    if (!by.has(r)) by.set(r, { mesh, tris: [], box: new THREE.Box3() });
    const isl = by.get(r)!;
    isl.tris.push(t);
    for (let k = 0; k < 3; k++) isl.box.expandByPoint(p.fromBufferAttribute(pos, t * 3 + k));
  }
  return [...by.values()];
}

/** Round, upright and narrow, touching the ground: a tyre or a rim. */
function wheelish(b: THREE.Box3): boolean {
  const s = b.getSize(new THREE.Vector3());
  return s.y > 0.3 && s.y < 1.3 && s.z / s.y > 0.75 && s.z / s.y < 1.3 && s.x < s.y * 0.8 && b.min.y < 0.06;
}

/** Triangles `tris` of `g` as a new geometry (all attributes), moved by `-at`. */
function take(g: THREE.BufferGeometry, tris: number[], at: THREE.Vector3): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  for (const [name, a] of Object.entries(g.attributes)) {
    const s = a.itemSize, arr = new Float32Array(tris.length * 3 * s);
    tris.forEach((t, i) => { for (let k = 0; k < 3 * s; k++) arr[i * 3 * s + k] = (a.array as ArrayLike<number>)[t * 3 * s + k]; });
    out.setAttribute(name, new THREE.BufferAttribute(arr, s));
  }
  return out.translate(-at.x, -at.y, -at.z);
}

/**
 * Wheels fused into a model's meshes (Sketchfab vehicles) taken out as nodes `<key>_wheelN` centred on their axle,
 * like the car pack, so the game can spin and steer them: round pieces at the bottom are grouped per wheel (twin
 * rear tyres together) and every smaller piece inside a wheel (hub, nuts) goes with it.
 */
export function splitWheels(out: THREE.Group, key: string): number {
  const meshes = out.children.filter((o): o is THREE.Mesh => (o as THREE.Mesh).isMesh && !(o as THREE.Mesh).geometry.index);
  const all = meshes.flatMap(islands), wheels: { box: THREE.Box3; parts: Island[] }[] = [];
  for (const isl of all.filter((i) => wheelish(i.box))) {
    const c = isl.box.getCenter(new THREE.Vector3()), r = isl.box.getSize(new THREE.Vector3()).y / 2;
    const w = wheels.find((w) => { const d = w.box.getCenter(new THREE.Vector3()); return Math.hypot(d.y - c.y, d.z - c.z) < r * 0.4 && Math.abs(d.x - c.x) < 0.6; });
    if (w) [w.parts.push(isl), w.box.union(isl.box)];
    else wheels.push({ box: isl.box.clone(), parts: [isl] });
  }
  if (wheels.length < 3) return 0;
  for (const isl of all) {
    if (wheels.some((w) => w.parts.includes(isl))) continue;
    const w = wheels.find((w) => w.box.clone().expandByScalar(0.03).containsBox(isl.box));
    if (w) w.parts.push(isl);
  }
  const cut = new Map<THREE.Mesh, Set<number>>();
  wheels.forEach((w, i) => {
    const node = new THREE.Group(), at = w.box.getCenter(new THREE.Vector3());
    node.name = `${key}_wheel${i}`;
    node.position.copy(at);
    for (const m of meshes) {
      const tris = w.parts.filter((p) => p.mesh === m).flatMap((p) => p.tris);
      if (!tris.length) continue;
      const piece = new THREE.Mesh(take(m.geometry, tris, at), m.material);
      piece.name = `${node.name}_${(m.material as THREE.Material).name}_part`;
      node.add(piece);
      if (!cut.has(m)) cut.set(m, new Set());
      tris.forEach((t) => cut.get(m)!.add(t));
    }
    out.add(node);
  });
  for (const [m, gone] of cut) {
    const keep = [...Array(m.geometry.attributes.position.count / 3).keys()].filter((t) => !gone.has(t));
    m.geometry = take(m.geometry, keep, new THREE.Vector3());
  }
  return wheels.length;
}
