import * as THREE from 'three';
import type { Lighting } from '../render/lighting';
import { buildAK } from './akModel';

export type GunModel = 'ak' | 'pistol' | 'smg';
type Built = { group: THREE.Group; muzzle: THREE.Object3D; ejector: THREE.Object3D };

/** Origin sits on top of the grip (where the right hand closes), +z forward, like the AK. */
export function buildWeapon(kind: GunModel, lighting: Lighting): Built {
  return kind === 'pistol' ? pistol(lighting) : kind === 'smg' ? smg(lighting) : buildAK(lighting);
}

function kit(lighting: Lighting) {
  const metal = lighting.setup(new THREE.MeshStandardMaterial({ color: '#232427', roughness: 0.38, metalness: 0.85 }), 'gun-metal');
  const polymer = lighting.setup(new THREE.MeshStandardMaterial({ color: '#1b1b1c', roughness: 0.7, metalness: 0.05 }), 'gun-polymer');
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rx = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.x = rx;
    m.castShadow = true;
    g.add(m);
    return m;
  };
  const cyl = (r: number, len: number, seg = 12) => new THREE.CylinderGeometry(r, r, len, seg).rotateX(Math.PI / 2);
  const point = (x: number, y: number, z: number) => {
    const o = new THREE.Object3D();
    o.position.set(x, y, z);
    g.add(o);
    return o;
  };
  return { metal, polymer, g, add, cyl, point };
}

function pistol(lighting: Lighting): Built {
  const { metal, polymer, g, add, cyl, point } = kit(lighting);
  add(new THREE.BoxGeometry(0.03, 0.03, 0.19), metal, 0, 0.034, 0.055);
  for (let i = 0; i < 6; i++) add(new THREE.BoxGeometry(0.031, 0.022, 0.003), polymer, 0, 0.036, -0.02 + i * 0.007);
  add(new THREE.BoxGeometry(0.008, 0.012, 0.03), metal, 0.012, 0.043, 0.06);
  add(new THREE.BoxGeometry(0.004, 0.008, 0.006), metal, 0, 0.053, 0.14);
  add(new THREE.BoxGeometry(0.014, 0.008, 0.008), metal, 0, 0.053, -0.03);
  add(cyl(0.006, 0.012), metal, 0, 0.036, 0.152);
  add(new THREE.BoxGeometry(0.028, 0.022, 0.15), polymer, 0, 0.008, 0.05);
  add(new THREE.BoxGeometry(0.028, 0.008, 0.05), polymer, 0, -0.005, 0.1);
  add(new THREE.BoxGeometry(0.029, 0.11, 0.045), polymer, 0, -0.045, -0.012, -0.28);
  add(new THREE.BoxGeometry(0.024, 0.012, 0.042), metal, 0, -0.098, -0.026, -0.28);
  add(new THREE.TorusGeometry(0.018, 0.0035, 6, 12, Math.PI).rotateY(Math.PI / 2), polymer, 0, -0.003, 0.04, Math.PI);
  add(new THREE.BoxGeometry(0.004, 0.016, 0.004), metal, 0, -0.008, 0.04, 0.3);
  return { group: g, muzzle: point(0, 0.034, 0.16), ejector: point(0.018, 0.045, 0.06) };
}

function smg(lighting: Lighting): Built {
  const { metal, polymer, g, add, cyl, point } = kit(lighting);
  add(new THREE.BoxGeometry(0.044, 0.06, 0.3), metal, 0, 0.03, 0.06);
  add(cyl(0.023, 0.29, 14), metal, 0, 0.045, 0.06);
  add(new THREE.BoxGeometry(0.05, 0.05, 0.15), polymer, 0, 0.012, 0.25);
  for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(0.052, 0.006, 0.012), metal, 0, 0.0, 0.2 + i * 0.03);
  add(cyl(0.01, 0.07), metal, 0, 0.03, 0.35);
  add(cyl(0.014, 0.03), metal, 0, 0.03, 0.39);
  add(cyl(0.012, 0.03), metal, 0, 0.08, 0.32);
  add(new THREE.BoxGeometry(0.03, 0.03, 0.02), metal, 0, 0.08, -0.06);
  add(new THREE.BoxGeometry(0.008, 0.02, 0.008), metal, 0.026, 0.05, 0.16);
  add(new THREE.BoxGeometry(0.024, 0.17, 0.034), metal, 0, -0.08, 0.14, 0.32);
  add(new THREE.BoxGeometry(0.034, 0.1, 0.045), polymer, 0, -0.045, -0.01, -0.3);
  add(new THREE.BoxGeometry(0.04, 0.035, 0.08), polymer, 0, -0.005, 0.04);
  add(new THREE.TorusGeometry(0.02, 0.004, 6, 12, Math.PI).rotateY(Math.PI / 2), polymer, 0, -0.012, 0.035, Math.PI);
  for (const x of [-0.022, 0.022]) add(cyl(0.005, 0.24, 8), metal, x, 0.03, -0.2);
  add(new THREE.BoxGeometry(0.06, 0.1, 0.02), polymer, 0, 0.0, -0.32);
  return { group: g, muzzle: point(0, 0.03, 0.405), ejector: point(0.03, 0.05, 0.1) };
}
