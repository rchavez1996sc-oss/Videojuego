import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Lighting } from '../render/lighting';
import type { StreetGraph } from './barrio';
import { mulberry32 } from '../core/rng';

type Draw = (g: CanvasRenderingContext2D, r: () => number) => void;
const C = 128;
/** Small things on the ground: crumpled paper, plastic bag, cigarette butts, caps and grit, dry leaves, flattened cardboard, a crushed can. */
const ITEMS: [Draw, number, number][] = [
  [(g, r) => { g.fillStyle = '#e9e6dc'; g.beginPath(); for (let k = 0; k < 9; k++) { const a = (k / 9) * 6.28, d = 30 + r() * 22; g.lineTo(64 + Math.cos(a) * d, 64 + Math.sin(a) * d); } g.fill(); g.strokeStyle = 'rgba(120,115,100,0.6)'; for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(40 + r() * 48, 40 + r() * 48); g.lineTo(40 + r() * 48, 40 + r() * 48); g.stroke(); } }, 0.18, 0.32],
  [(g, r) => { g.fillStyle = ['#2b3f74', '#1c1c1e', '#d8d8d4', '#3e6b3a'][Math.floor(r() * 4)]; g.beginPath(); g.ellipse(64, 64, 44, 30, r(), 0, 6.28); g.fill(); g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.ellipse(56, 56, 20, 9, 0.6, 0, 6.28); g.fill(); }, 0.3, 0.55],
  [(g, r) => { for (let k = 0; k < 6; k++) { const x = 20 + r() * 88, y = 20 + r() * 88, a = r() * 6.28; g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = '#efe9da'; g.fillRect(-14, -3, 20, 6); g.fillStyle = '#c98a43'; g.fillRect(6, -3, 9, 6); g.restore(); } }, 0.25, 0.35],
  [(g, r) => { for (let k = 0; k < 40; k++) { g.fillStyle = ['#6b655c', '#8a8174', '#4b4741', '#b8a98c'][k % 4]; g.beginPath(); g.arc(10 + r() * 108, 10 + r() * 108, 2 + r() * 4, 0, 6.28); g.fill(); } g.fillStyle = '#b21d1d'; g.beginPath(); g.arc(70, 60, 9, 0, 6.28); g.fill(); }, 0.35, 0.6],
  [(g, r) => { for (let k = 0; k < 4; k++) { g.save(); g.translate(30 + r() * 68, 30 + r() * 68); g.rotate(r() * 6.28); g.fillStyle = ['#8b5a2b', '#a5773d', '#6e4a22'][k % 3]; g.beginPath(); g.ellipse(0, 0, 22, 9, 0, 0, 6.28); g.fill(); g.strokeStyle = 'rgba(60,40,20,0.7)'; g.beginPath(); g.moveTo(-22, 0); g.lineTo(22, 0); g.stroke(); g.restore(); } }, 0.3, 0.5],
  [(g, r) => { g.fillStyle = '#a98a5d'; g.fillRect(14, 26, 100, 76); g.fillStyle = 'rgba(70,50,30,0.5)'; g.fillRect(14, 60, 100, 4); g.fillStyle = '#c23b2a'; g.fillRect(30 + r() * 30, 36, 30, 14); }, 0.45, 0.8],
  [(g) => { g.fillStyle = '#b8231d'; g.beginPath(); g.ellipse(64, 64, 30, 14, 0.4, 0, 6.28); g.fill(); g.fillStyle = '#d7d9db'; g.beginPath(); g.ellipse(84, 52, 9, 7, 0.4, 0, 6.28); g.fill(); g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(44, 56, 34, 3); }, 0.14, 0.2],
];

function atlas(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = C * ITEMS.length;
  cv.height = C;
  const g = cv.getContext('2d')!, r = mulberry32(77);
  ITEMS.forEach(([draw], i) => { g.save(); g.translate(i * C, 0); draw(g, r); g.restore(); });
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/**
 * Street litter scattered along the pedestrian graph (`perEdge` items per 10 m), each laid on whatever surface is
 * there (pavement, kerb, grass) by a downward ray; one instanced mesh per kind, receiving shadows only.
 */
export function litter(graph: StreetGraph, world: RAPIER.World, perTen: number, lighting: Lighting): THREE.Group {
  const g = new THREE.Group(), r = mulberry32(4242), tex = atlas();
  const mat = lighting.setup(new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, roughness: 0.85, side: THREE.DoubleSide }), 'litter');
  const spots: { p: THREE.Vector3; k: number; s: number; a: number }[] = [];
  for (const [a, b] of graph.edges) {
    const A = graph.nodes[a], B = graph.nodes[b], len = A.distanceTo(B), n = Math.round((len / 10) * perTen * (0.5 + r()));
    const side = new THREE.Vector3(-(B.z - A.z), 0, B.x - A.x).normalize();
    for (let i = 0; i < n; i++) {
      const p = A.clone().lerp(B, r()).addScaledVector(side, (r() - 0.5) * 7);
      const hit = world.castRay(new RAPIER.Ray({ x: p.x, y: p.y + 3, z: p.z }, { x: 0, y: -1, z: 0 }), 6, true);
      if (!hit) continue;
      const top = p.y + 3 - hit.timeOfImpact;
      if (Math.abs(top - p.y) > 0.6) continue;
      p.y = top + 0.015;
      const k = Math.floor(r() * ITEMS.length);
      spots.push({ p, k, s: ITEMS[k][1] + r() * (ITEMS[k][2] - ITEMS[k][1]), a: r() * 6.28 });
    }
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), flat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  ITEMS.forEach((_, k) => {
    const mine = spots.filter((s) => s.k === k);
    if (!mine.length) return;
    const geo = new THREE.PlaneGeometry(1, 1), uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setX(i, (k + uv.getX(i)) / ITEMS.length);
    const inst = new THREE.InstancedMesh(geo, mat, mine.length);
    mine.forEach((s, i) => inst.setMatrixAt(i, m.compose(s.p, q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.a).multiply(flat), new THREE.Vector3(s.s, s.s, s.s))));
    inst.receiveShadow = true;
    inst.computeBoundingSphere();
    g.add(inst);
  });
  return g;
}
