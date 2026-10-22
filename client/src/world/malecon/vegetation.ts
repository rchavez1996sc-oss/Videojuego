import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../../core/rng';
import type { Lighting } from '../../render/lighting';
import type { Builder } from '../buildingKit';
import { treeParts } from '../trees';
import { wood } from '../../render/textures';
import type { Plants } from './park';

function frondTexture(): THREE.CanvasTexture {
  const w = 128, h = 512, c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!, r = mulberry32(17);
  ctx.strokeStyle = '#6b6a3a';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(w / 2, h); ctx.lineTo(w / 2, 0); ctx.stroke();
  for (let y = h - 20; y > 6; y -= 7) {
    const len = (w / 2 - 4) * Math.sin(((h - y) / h) * Math.PI * 0.95 + 0.15);
    for (const s of [-1, 1]) {
      const g = 90 + r() * 50;
      ctx.strokeStyle = `rgb(${g * 0.55},${g},${g * 0.35})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(w / 2, y);
      ctx.quadraticCurveTo(w / 2 + s * len * 0.5, y - 6, w / 2 + s * len, y - 14 - r() * 6);
      ctx.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** One frond: a strip arching out and drooping, rotated around the crown. */
function frond(len: number, width: number, yaw: number, pitch: number, droop: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(width, len, 1, 8).translate(0, len / 2, 0).rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = -p.getZ(i) / len;
    p.setY(i, p.getY(i) - droop * t * t * len);
    p.setX(i, p.getX(i) * (1 - Math.abs(t - 0.5) * 0.6));
  }
  g.rotateX(pitch).rotateY(yaw);
  g.computeVertexNormals();
  return g;
}

function palmParts(height: number, radius: number, fronds: number, len: number, seed: number): { trunk: THREE.BufferGeometry; crown: THREE.BufferGeometry } {
  const r = mulberry32(seed);
  const trunk = new THREE.CylinderGeometry(radius * 0.8, radius, height, 9, 6).translate(0, height / 2, 0);
  const tp = trunk.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const t = tp.getY(i) / height;
    tp.setX(i, tp.getX(i) + Math.sin(t * 2.2) * height * 0.03);
  }
  trunk.computeVertexNormals();
  const top = Math.sin(2.2) * height * 0.03;
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < fronds; i++) {
    const yaw = (i / fronds) * Math.PI * 2 + r() * 0.3, up = i % 3 === 0;
    parts.push(frond(len * (0.8 + r() * 0.3), len * 0.28, yaw, up ? 0.5 : -0.05 - r() * 0.3, up ? 0.25 : 0.55).translate(top, height, 0));
  }
  return { trunk, crown: mergeGeometries(parts) };
}

function araucaria(): { trunk: THREE.BufferGeometry; crown: THREE.BufferGeometry } {
  const h = 15;
  const trunk = new THREE.CylinderGeometry(0.12, 0.32, h, 8).translate(0, h / 2, 0);
  const cards: THREE.BufferGeometry[] = [];
  for (let y = 3.2; y < h; y += 1.1) {
    const reach = (1 - (y - 3) / (h - 2)) * 3.6 + 0.4;
    for (let k = 0; k < 5; k++) cards.push(frond(reach, 0.9, (k / 5) * Math.PI * 2 + y, 0.08, 0.12).translate(0, y, 0));
  }
  return { trunk, crown: mergeGeometries(cards) };
}

function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, mats: THREE.Matrix4[]): THREE.InstancedMesh {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, mats.length));
  mats.forEach((x, i) => m.setMatrixAt(i, x));
  m.count = mats.length;
  m.castShadow = m.receiveShadow = true;
  m.computeBoundingSphere();
  return m;
}

/** Palms, shade trees, Norfolk pines and sea-wind-bent trees, instanced; trunks get small colliders. */
export function buildVegetation(b: Builder, plants: Plants, streetTrees: THREE.Vector3[], lighting: Lighting): THREE.Group {
  const g = new THREE.Group(), r = mulberry32(91), bark = wood();
  const barkMat = lighting.setup(new THREE.MeshStandardMaterial({ map: bark.map, normalMap: bark.normalMap, color: '#9a8b78', roughness: 0.95 }), 'palm-bark');
  const frondMat = lighting.setup(new THREE.MeshStandardMaterial({ map: frondTexture(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75, color: '#c9d3a0' }), 'frond');
  const pineMat = lighting.setup(new THREE.MeshStandardMaterial({ map: frondTexture(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85, color: '#6f8a5a' }), 'pine');
  const at = (p: THREE.Vector3, s: number, lean = 0) => {
    b.box('none', [0.5, 3, 0.5], p.clone().setY(p.y + 1.5), new THREE.Quaternion(), true);
    return new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(lean, r() * Math.PI * 2, 0)), new THREE.Vector3(s, s * (0.9 + r() * 0.2), s));
  };
  const kinds: [ReturnType<typeof palmParts>, THREE.Vector3[], THREE.Material][] = [
    [palmParts(13, 0.24, 16, 2.6, 3), plants.palms, frondMat],
    [palmParts(5.5, 0.5, 26, 4.2, 5), plants.phoenix, frondMat],
    [araucaria(), plants.pines, pineMat],
  ];
  for (const [parts, list, mat] of kinds) {
    const mats = list.map((p) => at(p, 0.8 + r() * 0.45, (r() - 0.5) * 0.06));
    g.add(instanced(parts.trunk, barkMat, mats), instanced(parts.crown, mat, mats));
  }
  const broad = treeParts(lighting);
  const shear = new THREE.Matrix4().set(1, 0, 0, 0, 0, 1, 0, 0, 0, -0.55, 1, 0, 0, 0, 0, 1);
  const buckets: THREE.Matrix4[][] = broad.map(() => []);
  [...plants.trees, ...streetTrees].forEach((p, i) => buckets[i % broad.length].push(at(p, 0.9 + r() * 0.5)));
  plants.bent.forEach((p, i) => buckets[i % broad.length].push(new THREE.Matrix4().makeTranslation(p.x, p.y, p.z).multiply(shear).multiply(new THREE.Matrix4().makeScale(1.6, 0.65, 1.3))));
  plants.arch.forEach(({ pos, lean }, i) => {
    b.box('none', [0.6, 3, 0.6], pos.clone().setY(pos.y + 1.5), new THREE.Quaternion(), true);
    const bend = new THREE.Matrix4().set(1, 0, 0, 0, 0, 1, 0, 0, 0, lean, 1, 0, 0, 0, 0, 1);
    const turn = new THREE.Matrix4().makeRotationY(r() * Math.PI * 2), size = 1.5 + r() * 0.4;
    buckets[i % broad.length].push(new THREE.Matrix4().makeTranslation(pos.x, pos.y, pos.z).multiply(bend).multiply(new THREE.Matrix4().makeScale(size * 1.15, size, size * 1.15)).multiply(turn));
  });
  broad.forEach((t, i) => g.add(instanced(t.trunk, t.barkMat, buckets[i]), instanced(t.canopy, t.leafMat, buckets[i])));
  return g;
}
