import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import { car, type CarKind } from '../urbanProps';
import { framer, yawQ, type CampusDef, type Rect } from './layout';

const KINDS: CarKind[] = ['sedan', 'sedan', 'wagon', 'tico', 'pickup', 'sedan', 'beetle'];
const PAINT = ['car0', 'car1', 'car2', 'car4', 'car5'];

/** Black iron bars on transparent ground (alpha-tested fence panel), one bar every 12 cm at uvScale 0.5. */
export function barsTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 16;
  const g = c.getContext('2d')!;
  g.fillStyle = '#1b1a19';
  for (let i = 0; i < 16; i++) g.fillRect(i * 8 + 3, 0, 2, 16);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Where the Av. Venezuela fence is open: road entries and Puerta 1's plaza. */
export function fenceGaps(def: CampusDef): [number, number][] {
  const v = def.venezuela, side = v.z - v.half - v.sidewalk;
  const gaps = def.roads.filter((r) => r.pts[r.pts.length - 1][1] > side - 3).map((r) => {
    const x = r.pts[r.pts.length - 1][0];
    return [x - r.w / 2 - 2.6, x + r.w / 2 + 2.6] as [number, number];
  });
  gaps.push([def.gate1.x - 27, def.gate1.x + 29]);
  if (def.gate2) gaps.push([def.gate2.x - 14, def.gate2.x + 16]);
  return gaps.sort((a, c) => a[0] - c[0]);
}

/** Campus perimeter on Av. Venezuela: yellow kerb, black bars between posts, porous collider. */
export function venezuelaFence(b: Builder, def: CampusDef): void {
  const v = def.venezuela, z = v.z - v.half - v.sidewalk - 0.5, Q = new THREE.Quaternion();
  let x0 = def.bounds.west - 0.3;
  const spans: [number, number][] = [];
  for (const [a, c] of fenceGaps(def)) {
    if (a > x0) spans.push([x0, a]);
    x0 = Math.max(x0, c);
  }
  spans.push([x0, def.bounds.x + 0.3]);
  for (const [a, c] of spans) {
    const len = c - a, mid = (a + c) / 2;
    b.box('kerbYellow', [len, 0.42, 0.36], new THREE.Vector3(mid, 0.21, z), Q, false);
    b.box('fenceBars', [len, 1.9, 0.02], new THREE.Vector3(mid, 1.4, z), Q, false);
    for (const y of [0.55, 2.3]) b.box('fenceIron', [len, 0.06, 0.05], new THREE.Vector3(mid, y, z), Q, false);
    const n = Math.max(1, Math.round(len / 2.6));
    for (let i = 0; i <= n; i++) b.box('fenceIron', [0.08, 2.05, 0.08], new THREE.Vector3(a + (i * len) / n, 1.42, z), Q, false);
    b.box('grate', [len, 2.4, 0.4], new THREE.Vector3(mid, 1.2, z), Q, true);
  }
}

/** Parking lot: asphalt pad, stall stripes, cars; aisle along local x, stalls on both long sides (one row if shallow). */
export function parkingLot(b: Builder, r: Rect, rand: () => number): void {
  const at = framer(r), q = yawQ(r.yaw), rows = r.d >= 14 ? [-(r.d / 2 - 2.6), r.d / 2 - 2.6] : [0];
  b.box('asphalt', [r.w, 0.25, r.d], at(0, -0.075, 0), q, false);
  const pitch = 2.7, n = Math.floor((r.w - 2) / pitch);
  for (const v of rows) {
    for (let i = 0; i <= n; i++) b.box('roadWhite', [0.12, 0.012, 4.8], at(-(n * pitch) / 2 + i * pitch, 0.056, v), q, false);
    for (let i = 0; i < n; i++) {
      if (rand() < 0.35) continue;
      const kind = KINDS[Math.floor(rand() * KINDS.length)], u = -(n * pitch) / 2 + (i + 0.5) * pitch;
      car(b, at(u, 0.05, v), (-r.yaw * Math.PI) / 180 + Math.PI / 2 + (rand() < 0.5 ? 0 : Math.PI), kind === 'tico' ? 'car3' : PAINT[Math.floor(rand() * PAINT.length)], kind);
    }
  }
}

/** Five-a-side pitch markings on artificial turf. */
function pitchTexture(w: number, d: number): THREE.CanvasTexture {
  const px = 24, c = document.createElement('canvas');
  c.width = Math.round(w * px);
  c.height = Math.round(d * px);
  const g = c.getContext('2d')!;
  for (let i = 0; i < 10; i++) {
    g.fillStyle = i % 2 ? '#3f7a34' : '#468739';
    g.fillRect(0, (i * c.height) / 10, c.width, c.height / 10 + 1);
  }
  g.strokeStyle = '#eef0e6';
  g.lineWidth = 0.12 * px;
  const m = 3 * px, W = c.width - 2 * m, H = c.height - 2 * m;
  g.strokeRect(m, m, W, H);
  g.beginPath();
  g.moveTo(m, c.height / 2);
  g.lineTo(m + W, c.height / 2);
  g.stroke();
  g.beginPath();
  g.arc(c.width / 2, c.height / 2, 3 * px, 0, Math.PI * 2);
  g.stroke();
  for (const s of [m, c.height - m]) {
    g.beginPath();
    g.arc(c.width / 2, s, 6 * px, s === m ? 0 : Math.PI, s === m ? Math.PI : Math.PI * 2);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Football pitch with goals and a chain-link enclosure (gate on the +x side). Returns the turf mesh. */
export function footballField(b: Builder, f: Rect, turf: THREE.MeshStandardMaterial): THREE.Mesh {
  const at = framer(f), q = yawQ(f.yaw), W = f.w + 6, D = f.d + 6;
  turf.map = pitchTexture(W, D);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2), turf);
  mesh.position.copy(at(0, 0.05, 0));
  mesh.quaternion.copy(q);
  mesh.receiveShadow = true;
  for (const s of [-1, 1]) {
    const z = s * (D / 2 - 3);
    for (const x of [-1.5, 1.5]) b.box('roadWhite', [0.1, 2, 0.1], at(x, 1, z), q, true);
    b.box('roadWhite', [3.1, 0.1, 0.1], at(0, 2, z), q, false);
    b.box('netWhite', [3, 2, 0.02], at(0, 1, z + s * 1), q, false);
    b.box('netWhite', [3, 0.02, 1], at(0, 2, z + s * 0.5), q, false);
  }
  const H = 4, fence = (len: number, x: number, z: number, along: 'x' | 'z') => {
    const size: [number, number, number] = along === 'x' ? [len, H, 0.03] : [0.03, H, len];
    b.box('chainFence', size, at(x, H / 2, z), q, false);
    b.box('grate', along === 'x' ? [len, H, 0.3] : [0.3, H, len], at(x, H / 2, z), q, true);
    const n = Math.max(1, Math.round(len / 3));
    for (let i = 0; i <= n; i++) {
      const u = -len / 2 + (i * len) / n;
      b.box('fenceIron', [0.07, H + 0.1, 0.07], along === 'x' ? at(x + u, H / 2, z) : at(x, H / 2, z + u), q, false);
    }
  };
  for (const s of [-1, 1]) fence(W, 0, s * D / 2, 'x');
  fence(D, -W / 2, 0, 'z');
  for (const s of [-1, 1]) fence(D / 2 - 1.5, W / 2, s * (D / 4 + 0.75), 'z');
  return mesh;
}
