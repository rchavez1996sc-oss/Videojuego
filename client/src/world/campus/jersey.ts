import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Builder } from '../buildingKit';
import type { Lighting } from '../../render/lighting';
import type { CampusDef } from './layout';
import { venezuelaSpan } from './roads';

const SEG = 3, H = 0.81, Q = new THREE.Quaternion();
/** New Jersey profile (half-width, height): wide foot, steep upper face. */
const PROFILE: [number, number][] = [[0.3, 0], [0.3, 0.075], [0.2, 0.33], [0.075, H]];
const SLOPE = Math.atan2(0.2 - 0.075, H - 0.33), FACE_Y = (0.33 + H) / 2, FACE_Z = (0.2 + 0.075) / 2 + 0.006;
const POSTERS: [string, string, string, string][] = [
  ['VOTA', 'FONSECA', '#1f4e9a', '#f2f2ee'], ['TODOS CON', 'QUISPE 2036', '#f2f2ee', '#b3121b'],
  ['GRAN BAILE', 'LOS ANDINOS DEL SOL', '#e8c12e', '#c2187a'], ['ORDEN Y', 'PROGRESO', '#1d2a3a', '#f2c230'],
];
const TAGS = ['CHALACO', 'SM 1551', 'PKC', 'LA U', 'FLS', 'K-RIMBA'];

function atlas(): THREE.CanvasTexture {
  const c = Object.assign(document.createElement('canvas'), { width: 1024, height: 512 }), g = c.getContext('2d')!;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  POSTERS.forEach(([top, name, bg, fg], i) => {
    const x = i * 256;
    g.fillStyle = bg; g.fillRect(x + 8, 8, 240, 240);
    g.fillStyle = fg; g.textAlign = 'center';
    g.font = '800 34px "Barlow Condensed", Arial'; g.fillText(top, x + 128, 70, 220);
    g.font = '800 46px "Barlow Condensed", Arial'; g.fillText(name, x + 128, 140, 226);
    g.fillRect(x + 40, 170, 176, 10);
    g.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < 14; k++) { g.beginPath(); g.arc(x + 8 + rnd() * 240, 8 + (rnd() < 0.5 ? rnd() * 50 : 190 + rnd() * 58), 6 + rnd() * 30, 0, 7); g.fill(); }
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = 'rgba(205,200,188,0.35)'; g.fillRect(x + 8, 8, 240, 240);
  });
  TAGS.forEach((t, i) => {
    const x = (i % 3) * 341, y = 256 + Math.floor(i / 3) * 128;
    g.save(); g.translate(x + 170, y + 70); g.rotate((rnd() - 0.5) * 0.15);
    g.font = `italic 800 ${60 + rnd() * 20}px "Permanent Marker", "Barlow Condensed", Arial`; g.textAlign = 'center';
    g.lineWidth = 7; g.strokeStyle = ['#111', '#2a2a6a', '#5a1010'][i % 3]; g.strokeText(t, 0, 0, 320);
    g.fillStyle = ['#d8d8d8', '#c22a22', '#1f5fae', '#e8c12e', '#111', '#3d7a45'][i]; g.fillText(t, 0, 0, 320);
    g.restore();
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Quad lying on one sloped upper face of the barrier, `u0..u1`, `v0..v1` in the atlas. */
function decal(x: number, z: number, side: 1 | -1, w: number, h: number, uv: [number, number, number, number]): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(w, h), a = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < a.count; i++) a.setXY(i, uv[0] + a.getX(i) * (uv[1] - uv[0]), uv[2] + a.getY(i) * (uv[3] - uv[2]));
  g.rotateX(-SLOPE);
  if (side < 0) g.rotateY(Math.PI);
  return g.translate(x, FACE_Y, z + side * FACE_Z);
}

/**
 * Av. Venezuela's median as on Street View (2023–24): a run of worn precast New Jersey barriers, gaps at the crossings,
 * rows of wheat-pasted election and concert posters half torn off, and spray tags. Barriers collide (cover).
 */
export function jerseyMedian(b: Builder, def: CampusDef, lighting: Lighting, rand: () => number): THREE.Mesh | null {
  const v = def.venezuela, { X, entries } = venezuelaSpan(def), gaps = entries.map(([a, c]) => [(a + c) / 2 - 4, (a + c) / 2 + 4] as const);
  const shape = new THREE.Shape([...PROFILE.map(([w, y]) => new THREE.Vector2(w, y)), ...[...PROFILE].reverse().map(([w, y]) => new THREE.Vector2(-w, y))]);
  const seg = new THREE.ExtrudeGeometry(shape, { depth: SEG - 0.03, bevelEnabled: false }).rotateY(Math.PI / 2).translate(-(SEG - 0.03) / 2, 0, 0);
  const decals: THREE.BufferGeometry[] = [];
  let run0 = -X;
  const close = (x1: number) => { if (x1 - run0 > 1) b.box('none', [x1 - run0, H, 0.55], new THREE.Vector3((run0 + x1) / 2, H / 2, v.z), Q, true); };
  for (let x = -X + SEG / 2; x < X; x += SEG) {
    if (gaps.some(([a, c]) => x > a && x < c)) { close(x - SEG / 2); run0 = x + SEG / 2; continue; }
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, 0.12, v.z + (rand() - 0.5) * 0.04), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (rand() - 0.5) * 0.012), new THREE.Vector3(1, 1, 1));
    b.geometry('concrete', seg.clone(), m);
    for (const side of [1, -1] as const) {
      const r = rand();
      if (r < 0.22) {
        const k = Math.floor(rand() * POSTERS.length), n = 2 + Math.floor(rand() * 6);
        for (let i = 0; i < n; i++) decals.push(decal(x - SEG / 2 + 0.25 + i * 0.36, v.z, side, 0.34, 0.34, [k / 4 + 0.008, (k + 1) / 4 - 0.008, 0.508, 0.992]).translate(0, 0.12 + (rand() - 0.5) * 0.02, 0));
      } else if (r < 0.34) {
        const k = Math.floor(rand() * TAGS.length);
        decals.push(decal(x + (rand() - 0.5) * 0.6, v.z, side, 1.7, 0.5, [(k % 3) / 3, (k % 3 + 1) / 3, 0.5 - (Math.floor(k / 3) + 1) * 0.25, 0.5 - Math.floor(k / 3) * 0.25]).translate(0, 0.12, 0));
      }
    }
  }
  close(X);
  if (!decals.length) return null;
  const mat = lighting.setup(new THREE.MeshStandardMaterial({ map: atlas(), transparent: true, alphaTest: 0.3, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false }), 'jersey-posters');
  return Object.assign(new THREE.Mesh(mergeGeometries(decals)!, mat), { receiveShadow: true, name: 'jersey-posters' });
}
