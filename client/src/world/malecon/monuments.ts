import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import type { Heightfield } from '../heightfield';
import type { Lighting } from '../../render/lighting';
import { canvasTexture } from './textures';
import { innerPathZ, type MaleconDef } from './layout';

export interface BustDef { name: string; years: string; x: number; look: 'beard' | 'kepi' | 'woman' | 'plain' }

const Q = new THREE.Quaternion();

/** Bronze bust on a granite pedestal facing the path, with an engraved plaque. */
function bust(b: Builder, at: THREE.Vector3, d: BustDef, signs: THREE.Group, lighting: Lighting): void {
  b.box('granite', [1.2, 0.2, 1.2], at.clone().setY(at.y + 0.1), Q, true);
  b.box('granite', [0.8, 1.4, 0.8], at.clone().setY(at.y + 0.9), Q, true);
  b.box('granite', [0.95, 0.12, 0.95], at.clone().setY(at.y + 1.66), Q, false);
  const m = new THREE.Matrix4().makeTranslation(at.x, at.y + 1.72, at.z);
  const g = (geo: THREE.BufferGeometry) => b.geometry('bronze', geo, m);
  g(new THREE.SphereGeometry(1, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.36, 0.34, 0.21));
  g(new THREE.CylinderGeometry(0.065, 0.075, 0.16, 12).translate(0, 0.38, -0.01));
  g(new THREE.SphereGeometry(0.115, 20, 16).scale(1, 1.22, 1.08).translate(0, 0.56, -0.02));
  g(new THREE.ConeGeometry(0.022, 0.06, 8).rotateX(-Math.PI / 2).translate(0, 0.55, -0.15));
  for (const s of [-1, 1]) g(new THREE.SphereGeometry(0.025, 8, 6).scale(0.6, 1, 0.6).translate(s * 0.115, 0.56, 0));
  if (d.look === 'beard') g(new THREE.SphereGeometry(0.1, 14, 10).scale(1, 0.9, 0.8).translate(0, 0.45, -0.07));
  if (d.look === 'kepi') {
    g(new THREE.CylinderGeometry(0.1, 0.12, 0.13, 16).translate(0, 0.72, -0.01));
    g(new THREE.BoxGeometry(0.2, 0.015, 0.09).translate(0, 0.66, -0.13));
  }
  if (d.look === 'woman') {
    g(new THREE.SphereGeometry(0.125, 18, 12).scale(1, 1.05, 1.1).translate(0, 0.6, 0.02));
    g(new THREE.SphereGeometry(0.07, 12, 10).translate(0, 0.6, 0.13));
  } else g(new THREE.SphereGeometry(0.118, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.9, 1.1).translate(0, 0.61, 0));
  const tex = canvasTexture((ctx, w, h) => {
    ctx.fillStyle = '#4b3b22';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#a8894f';
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = '#e2c47e';
    ctx.textAlign = 'center';
    ctx.font = `700 ${h * 0.22}px Georgia, "Times New Roman", serif`;
    ctx.fillText(d.name, w / 2, h * 0.48, w * 0.88);
    ctx.font = `${h * 0.14}px Georgia, serif`;
    ctx.fillText(d.years, w / 2, h * 0.76);
  }, 512, 256);
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.31), lighting.setup(new THREE.MeshStandardMaterial({ map: tex, metalness: 0.6, roughness: 0.4 }), 'plaque'));
  plaque.position.set(at.x, at.y + 1.15, at.z - 0.41);
  plaque.rotation.y = Math.PI;
  signs.add(plaque);
}

/** Peruvian flag on a white mast. */
export function flagpole(b: Builder, at: THREE.Vector3, signs: THREE.Group, flag: THREE.Material): void {
  b.geometry('flagMast', new THREE.CylinderGeometry(0.05, 0.08, 9, 8).translate(0, 4.5, 0), new THREE.Matrix4().makeTranslation(at.x, at.y, at.z));
  b.box('none', [0.2, 9, 0.2], at.clone().setY(at.y + 4.5), Q, true);
  const g = new THREE.PlaneGeometry(2.4, 1.6, 12, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getX(i) + 1.2) * 2.4) * 0.12 * (p.getX(i) + 1.2) / 2.4);
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g.translate(1.25, 0, 0), flag);
  mesh.position.set(at.x, at.y + 8.1, at.z);
  mesh.rotation.y = Math.PI / 2;
  signs.add(mesh);
}

export function flagMaterial(lighting: Lighting): THREE.Material {
  const tex = canvasTexture((ctx, w, h) => {
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = k === 1 ? '#f4f2ee' : '#d21f2b';
      ctx.fillRect((k * w) / 3, 0, w / 3 + 1, h);
    }
  }, 192, 128);
  return lighting.setup(new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.85 }), 'flag-pe');
}

/** Busts of national figures along the park's inner path, each with a pair of benches and two flags. */
export function buildMonuments(b: Builder, hf: Heightfield, def: MaleconDef, lighting: Lighting, seats: { pos: THREE.Vector3; yaw: number }[], bench: (at: THREE.Vector3, yaw: number) => void): THREE.Group {
  const signs = new THREE.Group(), flag = flagMaterial(lighting);
  for (const d of def.busts ?? []) {
    const z = innerPathZ(def, d.x) + 5, at = new THREE.Vector3(d.x, hf.heightAt(d.x, z), z);
    bust(b, at, d, signs, lighting);
    for (const s of [-1, 1]) {
      const p = new THREE.Vector3(d.x + s * 3.2, at.y, z + 0.4);
      bench(p, Math.PI);
      if (s > 0) seats.push({ pos: p, yaw: Math.PI });
      flagpole(b, new THREE.Vector3(d.x + s * 1.6, at.y, z + 1.8), signs, flag);
    }
  }
  return signs;
}
