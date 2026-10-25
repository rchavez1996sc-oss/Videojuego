import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import type { Heightfield } from '../heightfield';
import type { Lighting } from '../../render/lighting';
import { bench, ribbon, type Plants } from '../malecon/park';
import { campusLamp } from './roads';
import type { Paths } from './greens';

/**
 * Corner park by Puerta 2 (from the user's aerial photos): an overgrown wood of broadleaf trees and shrubs on patchy
 * lawn, crossed by terracotta-coloured walks from its corners to a ring walk round a small green island; north of it
 * a concrete esplanade with a long bed where red plants spell UNMSM beside a narrow water channel.
 */
export interface PlazuelaDef {
  x: number; z: number; r: number; corners: [number, number][]; edges?: [number, number][][];
  esplanade?: { x0: number; x1: number; z0: number; z1: number };
}

function inside(poly: [number, number][], x: number, z: number): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit;
  }
  return hit;
}

/** Soil bed with UNMSM spelt in dark red foliage. */
function letterBed(w: number, d: number, lighting: Lighting): THREE.Mesh {
  const c = document.createElement('canvas'), g = c.getContext('2d')!;
  c.width = 1024; c.height = Math.round((1024 * d) / w);
  g.fillStyle = '#7d6a48'; g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = Math.random() < 0.6 ? `rgba(110,130,60,${0.3 + Math.random() * 0.4})` : `rgba(150,120,80,0.4)`;
    g.beginPath(); g.arc(Math.random() * c.width, Math.random() * c.height, 2 + Math.random() * 5, 0, Math.PI * 2); g.fill();
  }
  const mask = document.createElement('canvas'), m = mask.getContext('2d')!;
  mask.width = c.width; mask.height = c.height;
  m.font = `800 ${Math.round(c.height * 0.72)}px "Barlow Condensed", sans-serif`;
  m.textAlign = 'center'; m.textBaseline = 'middle'; m.fillStyle = '#fff';
  m.fillText('UNMSM', c.width * 0.62, c.height * 0.54);
  g.save(); g.font = m.font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#5e121c'; g.fillText('UNMSM', c.width * 0.62, c.height * 0.54); g.restore();
  const px = m.getImageData(0, 0, c.width, c.height).data;
  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * c.width, y = Math.random() * c.height;
    if (px[(Math.floor(y) * c.width + Math.floor(x)) * 4] < 128) continue;
    g.fillStyle = Math.random() < 0.5 ? '#6e1622' : '#8f2433';
    g.beginPath(); g.arc(x, y, 1.5 + Math.random() * 2.5, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), lighting.setup(new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }), 'unmsm-bed'));
  mesh.receiveShadow = true;
  return mesh;
}

export function plazuela(b: Builder, hf: Heightfield, p: PlazuelaDef, plants: Plants, paths: Paths, lighting: Lighting, rand: () => number): THREE.Group {
  const group = new THREE.Group(), c = new THREE.Vector2(p.x, p.z), ring = p.r + 2.8;
  b.geometry('pathRust', new THREE.RingGeometry(p.r, ring, 64).rotateX(-Math.PI / 2), new THREE.Matrix4().makeTranslation(p.x, 0.14, p.z));
  b.geometry('concrete', new THREE.CylinderGeometry(p.r, p.r, 0.3, 48, 1, true), new THREE.Matrix4().makeTranslation(p.x, 0.1, p.z));
  paths.discs.push({ x: p.x, z: p.z, r: ring + 0.2 });
  plants.trees.push(new THREE.Vector3(p.x + 1, 0, p.z - 0.5));
  const walks: THREE.Vector2[][] = [];
  for (const [x, z] of p.corners) {
    const end = new THREE.Vector2(x, z), dir = end.clone().sub(c).normalize(), start = c.clone().addScaledVector(dir, ring - 0.4);
    const pts = [start, end];
    ribbon(b, hf, pts, 3.2, 'pathRust', 0.1);
    paths.lines.push({ pts, w: 3.2 });
    walks.push(pts);
    const len = start.distanceTo(end), side = new THREE.Vector2(-dir.y, dir.x);
    for (let d = 14; d < len - 6; d += 26) {
      const at = start.clone().addScaledVector(dir, d).addScaledVector(side, 2.6);
      campusLamp(b, new THREE.Vector3(at.x, 0, at.y), Math.atan2(dir.x, dir.y));
      const seat = start.clone().addScaledVector(dir, d + 7).addScaledVector(side, -2.6), yaw = Math.atan2(side.x, side.y);
      bench(b, new THREE.Vector3(seat.x, 0.02, seat.y), yaw);
      if (rand() < 0.4) plants.seats.push({ pos: new THREE.Vector3(seat.x, 0.02, seat.y), yaw });
    }
  }
  for (const edge of p.edges ?? []) {
    const pts = edge.map(([x, z]) => new THREE.Vector2(x, z));
    ribbon(b, hf, pts, 2.6, 'pathRust', 0.06);
    paths.lines.push({ pts, w: 2.6 });
    walks.push(pts);
  }
  const clear = (x: number, z: number, m: number) => Math.hypot(x - p.x, z - p.z) > ring + m && walks.every(([a, e]) => {
    const dx = e.x - a.x, dz = e.y - a.y, t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.y) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(x - a.x - dx * t, z - a.y - dz * t) > m;
  });
  for (let n = 0, tries = 0; n < 70 && tries < 900; tries++) {
    const xs = p.corners.map((k) => k[0]), zs = p.corners.map((k) => k[1]);
    const x = Math.min(...xs) + rand() * (Math.max(...xs) - Math.min(...xs)), z = Math.min(...zs) + rand() * (Math.max(...zs) - Math.min(...zs));
    if (!inside(p.corners, x, z) || !clear(x, z, 3) || plants.trees.some((t) => Math.hypot(t.x - x, t.z - z) < 4.2)) continue;
    plants.trees.push(new THREE.Vector3(x, 0, z));
    if (rand() < 0.5) {
      const s = 1 + rand() * 1.6;
      b.box('hedge', [s, s * 0.7, s * 0.9], new THREE.Vector3(x + 2 * (rand() - 0.5), s * 0.3, z + 2 * (rand() - 0.5)), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 3), false);
    }
    n++;
  }
  const e = p.esplanade;
  if (e) {
    const cx = (e.x0 + e.x1) / 2, cz = (e.z0 + e.z1) / 2, w = e.x1 - e.x0, d = e.z1 - e.z0;
    b.box('parkPath', [w, 0.3, d], new THREE.Vector3(cx, 0.02, cz), new THREE.Quaternion(), true);
    const bw = w * 0.62, bd = 4;
    b.box('kerbYellow', [bw + 0.4, 0.42, bd + 0.4], new THREE.Vector3(cx, 0.21, cz), new THREE.Quaternion(), true);
    const bed = letterBed(bw, bd, lighting);
    bed.position.set(cx, 0.45, cz);
    group.add(bed);
    b.box('uniGrey', [bw * 0.38, 0.35, 0.9], new THREE.Vector3(cx - bw * 0.27, 0.5, cz), new THREE.Quaternion(), false);
    b.box('waterBlue', [bw * 0.36, 0.05, 0.6], new THREE.Vector3(cx - bw * 0.27, 0.66, cz), new THREE.Quaternion(), false);
    paths.lines.push({ pts: [new THREE.Vector2(e.x0, cz), new THREE.Vector2(e.x1, cz)], w: d });
  }
  return group;
}
