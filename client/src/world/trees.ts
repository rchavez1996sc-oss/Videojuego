import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../core/rng';
import type { Lighting } from '../render/lighting';
import { wood } from '../render/textures';

function leafTexture(): THREE.CanvasTexture {
  const s = 256, c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d')!;
  const r = mulberry32(5);
  for (let i = 0; i < 260; i++) {
    const x = s / 2 + (r() - 0.5) * s * 0.85 * Math.sqrt(r()), y = s / 2 + (r() - 0.5) * s * 0.85 * Math.sqrt(r());
    const g = 70 + r() * 60;
    ctx.fillStyle = `rgb(${g * 0.55},${g},${g * 0.38})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 4 + r() * 5, 2 + r() * 2, r() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function branch(from: THREE.Vector3, dir: THREE.Vector3, len: number, rad: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rad * 0.6, rad, len, 7, 3);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()));
  g.translate(from.x, from.y, from.z);
  return g;
}

function canopy(centers: THREE.Vector3[], r: () => number, radius: number): THREE.BufferGeometry {
  const cards: THREE.BufferGeometry[] = [];
  for (const c of centers) {
    for (let i = 0; i < 14; i++) {
      const g = new THREE.PlaneGeometry(radius * 1.3, radius * 1.3);
      g.rotateX((r() - 0.5) * Math.PI);
      g.rotateY(r() * Math.PI);
      const off = new THREE.Vector3(r() - 0.5, (r() - 0.3) * 0.6, r() - 0.5).multiplyScalar(radius * 1.2);
      g.translate(c.x + off.x, c.y + off.y, c.z + off.z);
      const p = g.attributes.position as THREE.BufferAttribute, n = g.attributes.normal as THREE.BufferAttribute;
      for (let k = 0; k < p.count; k++) {
        const d = new THREE.Vector3(p.getX(k) - c.x, (p.getY(k) - c.y) * 0.7 + radius * 0.4, p.getZ(k) - c.z).normalize();
        n.setXYZ(k, d.x, d.y, d.z);
      }
      cards.push(g);
    }
  }
  return mergeGeometries(cards);
}

export interface TreePart { trunk: THREE.BufferGeometry; canopy: THREE.BufferGeometry; barkMat: THREE.Material; leafMat: THREE.Material }

export function treeParts(lighting: Lighting): TreePart[] {
  const bark = wood();
  const barkMat = lighting.setup(new THREE.MeshStandardMaterial({ map: bark.map, normalMap: bark.normalMap, color: '#8a7a6a', roughness: 0.95 }), 'bark');
  const leafMat = lighting.setup(new THREE.MeshStandardMaterial({
    map: leafTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8, color: '#a8b890',
  }), 'leaf');
  return [3, 4, 5].map((seed) => {
    const r = mulberry32(seed * 31);
    const h = 4 + r() * 3;
    const lean = new THREE.Vector3((r() - 0.5) * 0.25, 1, (r() - 0.5) * 0.25);
    const parts = [branch(new THREE.Vector3(), lean, h, 0.24)];
    const tips: THREE.Vector3[] = [lean.clone().normalize().multiplyScalar(h)];
    for (let i = 0; i < 4; i++) {
      const start = lean.clone().normalize().multiplyScalar(h * (0.45 + r() * 0.35));
      const dir = new THREE.Vector3(Math.cos(i * 1.7 + r()), 0.8 + r() * 0.6, Math.sin(i * 1.7 + r()));
      const len = 1.5 + r() * 1.5;
      parts.push(branch(start, dir, len, 0.1));
      tips.push(start.clone().add(dir.normalize().multiplyScalar(len)));
    }
    return { trunk: mergeGeometries(parts), canopy: canopy(tips, r, 1.8 + r() * 0.6), barkMat, leafMat };
  });
}
