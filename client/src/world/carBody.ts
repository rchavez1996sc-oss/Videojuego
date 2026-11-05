import * as THREE from 'three';

type Pt = [number, number];

/** Highest point of the silhouette polygon at length `z` (its upper outline). */
export function topAt(shape: Pt[], z: number): number {
  let top = -Infinity;
  for (let i = 0; i < shape.length; i++) {
    const [z0, y0] = shape[i], [z1, y1] = shape[(i + 1) % shape.length];
    if ((z < Math.min(z0, z1)) || (z > Math.max(z0, z1)) || z0 === z1) continue;
    top = Math.max(top, y0 + ((z - z0) / (z1 - z0)) * (y1 - y0));
  }
  return top;
}

/** Plan-view rounding: the half width shrinks along a quarter ellipse over the last `r` metres of each end. */
function planHalf(z: number, half: number, zMin: number, zMax: number, r: number): number {
  const d = Math.min(z - zMin, zMax - z);
  if (d >= r) return half;
  const t = 1 - Math.max(d, 0) / r;
  return half * Math.sqrt(Math.max(0.0, 1 - t * t * 0.55));
}

/**
 * Lofted surface: rings of a rounded section (bottom y0, top y1, half width at the bottom and the top, corner radius)
 * swept along z; ends closed. Smooth normals, a proper curved body instead of an extruded slab.
 */
function loft(zs: number[], ring: (z: number) => { y0: number; y1: number; hb: number; ht: number; r: number; bulge: number } | null): THREE.BufferGeometry | null {
  const SEG = 3, pos: number[] = [], idx: number[] = [], rings: number[][] = [];
  for (const z of zs) {
    const s = ring(z);
    if (!s || s.y1 - s.y0 < 0.02) { rings.push([]); continue; }
    const r = Math.min(s.r, (s.y1 - s.y0) / 2.2), pts: Pt[] = [];
    const corner = (cx: number, cy: number, a0: number) => { for (let k = 0; k <= SEG; k++) { const a = a0 + (k / SEG) * (Math.PI / 2); pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
    corner(s.hb - r, s.y0 + r, -Math.PI / 2);
    pts.push([s.hb + s.bulge, (s.y0 + s.y1) / 2]);
    corner(s.ht - r, s.y1 - r, 0);
    corner(-s.ht + r, s.y1 - r, Math.PI / 2);
    pts.push([-s.hb - s.bulge, (s.y0 + s.y1) / 2]);
    corner(-s.hb + r, s.y0 + r, Math.PI);
    const base = pos.length / 3;
    for (const [x, y] of pts) pos.push(x, y, z);
    rings.push(pts.map((_, k) => base + k));
  }
  let n = 0;
  for (let i = 0; i + 1 < rings.length; i++) {
    const a = rings[i], b = rings[i + 1];
    if (!a.length || !b.length) continue;
    for (let k = 0; k < a.length; k++) {
      const k2 = (k + 1) % a.length;
      idx.push(a[k], a[k2], b[k], a[k2], b[k2], b[k]);
    }
    n++;
  }
  if (!n) return null;
  const cap = (r: number[], flip: boolean) => {
    const c = pos.length / 3;
    let cx = 0, cy = 0;
    for (const v of r) { cx += pos[v * 3]; cy += pos[v * 3 + 1]; }
    pos.push(cx / r.length, cy / r.length, pos[r[0] * 3 + 2]);
    for (let k = 0; k < r.length; k++) { const k2 = (k + 1) % r.length; flip ? idx.push(c, r[k2], r[k]) : idx.push(c, r[k], r[k2]); }
  };
  const live = rings.filter((r) => r.length);
  cap(live[0], true);
  cap(live[live.length - 1], false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export interface Body { lower: THREE.BufferGeometry; cabin: THREE.BufferGeometry | null; roof: THREE.BufferGeometry | null }

/**
 * Car body from the side silhouette: lower body (sill to belt) with bowed flanks and rounded corners, a glasshouse
 * from the belt to the roofline that narrows towards the top (tumblehome), and a painted roof skin over its top.
 * Local frame as the old extrusion: x across, y up, z along (front +z).
 */
export function carBody(shape: Pt[], width: number, belt: number, sill: number, boxy: boolean): Body {
  const zMin = Math.min(...shape.map((p) => p[0])), zMax = Math.max(...shape.map((p) => p[0])), N = 20;
  const zs = Array.from({ length: N + 1 }, (_, i) => zMin + 0.004 + (i / N) * (zMax - zMin - 0.008));
  const half = width / 2, endR = boxy ? 0.22 : 0.42, roofMax = Math.max(...shape.map((p) => p[1]));
  const lower = loft(zs, (z) => {
    const hw = planHalf(z, half, zMin, zMax, endR), top = Math.min(topAt(shape, z), belt);
    return { y0: sill, y1: top, hb: hw * 0.97, ht: hw * 0.985, r: boxy ? 0.06 : 0.11, bulge: boxy ? 0.005 : 0.025 };
  })!;
  const inCabin = (z: number) => topAt(shape, z) - belt > 0.06;
  const cz = zs.filter(inCabin);
  if (!cz.length) return { lower, cabin: null, roof: null };
  const lean = boxy ? 0.92 : 0.8;
  const cabin = loft(cz, (z) => {
    const hw = planHalf(z, half, zMin, zMax, endR);
    return { y0: belt - 0.02, y1: topAt(shape, z) - 0.035, hb: hw * 0.95, ht: hw * lean, r: boxy ? 0.05 : 0.1, bulge: 0 };
  });
  const roofZ = cz.filter((z) => topAt(shape, z) > roofMax - (boxy ? 0.25 : 0.12));
  const roof = roofZ.length > 1 ? loft(roofZ, (z) => {
    const hw = planHalf(z, half, zMin, zMax, endR), top = topAt(shape, z);
    return { y0: top - 0.07, y1: top + 0.005, hb: hw * lean + 0.012, ht: hw * lean - 0.02, r: 0.035, bulge: 0 };
  }) : null;
  return { lower, cabin, roof };
}

/** Tyre with a rounded sidewall (lathe) and a five-spoke rim with hub; axis along x. */
export function wheelParts(r: number, w: number): { tire: THREE.BufferGeometry; rim: THREE.BufferGeometry } {
  const prof: THREE.Vector2[] = [];
  for (let k = 0; k <= 6; k++) {
    const a = -Math.PI / 2 + (k / 6) * Math.PI, side = Math.cos(a);
    prof.push(new THREE.Vector2(r * 0.62 + (r * 0.38) * (0.8 + 0.2 * side), (w / 2) * Math.sin(a)));
  }
  const tire = new THREE.LatheGeometry([new THREE.Vector2(r * 0.6, -w / 2), ...prof, new THREE.Vector2(r * 0.6, w / 2)], 14).rotateZ(Math.PI / 2);
  const parts: THREE.BufferGeometry[] = [new THREE.CylinderGeometry(r * 0.6, r * 0.6, w * 0.5, 16).rotateZ(Math.PI / 2).translate(w * 0.2, 0, 0)];
  parts.push(new THREE.CylinderGeometry(r * 0.15, r * 0.17, w * 0.1, 12).rotateZ(Math.PI / 2).translate(w * 0.48, 0, 0));
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    parts.push(new THREE.BoxGeometry(w * 0.08, r * 0.46, r * 0.11).translate(0, r * 0.33, 0).rotateX(a).translate(w * 0.46, 0, 0));
  }
  const rim = mergeAll(parts);
  return { tire, rim };
}

function mergeAll(gs: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const flat = gs.map((g) => (g.index ? g.toNonIndexed() : g));
  for (const g of flat) for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  const total = flat.reduce((s, g) => s + g.attributes.position.count, 0), pos = new Float32Array(total * 3), nrm = new Float32Array(total * 3);
  let o = 0;
  for (const g of flat) { pos.set(g.attributes.position.array as Float32Array, o * 3); nrm.set(g.attributes.normal.array as Float32Array, o * 3); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  return out;
}
