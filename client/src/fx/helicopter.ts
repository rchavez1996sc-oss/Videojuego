import * as THREE from 'three';
import type { Lighting } from '../render/lighting';

/** Olive-drab utility helicopter: fuselage, glazed nose, tail boom and fin, skids, spinning main and tail rotors. */
export class Helicopter {
  readonly group = new THREE.Group();
  private rotor = new THREE.Group();
  private tail = new THREE.Group();

  constructor(lighting: Lighting) {
    const std = (key: string, p: THREE.MeshStandardMaterialParameters) => lighting.setup(new THREE.MeshStandardMaterial(p), key);
    const body = std('heli-body', { color: '#3d4436', roughness: 0.6, metalness: 0.3 });
    const dark = std('heli-dark', { color: '#1c1e1d', roughness: 0.5, metalness: 0.5 });
    const glass = std('heli-glass', { color: '#1f2b33', roughness: 0.05, metalness: 0.7 });
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, parent: THREE.Object3D = this.group) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      parent.add(m);
      return m;
    };
    add(new THREE.CapsuleGeometry(1.25, 3.2, 6, 14).rotateX(Math.PI / 2).scale(1, 0.95, 1), body, 0, 0, 0);
    add(new THREE.SphereGeometry(1.15, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(1, 0.9, 0.9), glass, 0, 0.15, -2.1);
    add(new THREE.CylinderGeometry(0.22, 0.42, 6.5, 8).rotateX(Math.PI / 2), body, 0, 0.35, 5.2);
    add(new THREE.BoxGeometry(0.12, 1.5, 1.0), body, 0, 1.0, 8.2);
    add(new THREE.BoxGeometry(1.6, 0.6, 2.4), body, 0, 1.25, 0.2);
    for (const s of [-1, 1]) {
      add(new THREE.CylinderGeometry(0.06, 0.06, 4.2, 6).rotateX(Math.PI / 2), dark, s * 1.15, -1.55, 0);
      for (const z of [-1.1, 1.1]) add(new THREE.CylinderGeometry(0.05, 0.05, 0.75, 6), dark, s * 1.0, -1.2, z);
    }
    this.rotor.position.set(0, 1.75, 0.2);
    add(new THREE.CylinderGeometry(0.18, 0.18, 0.4, 8), dark, 0, 0, 0, this.rotor);
    for (let k = 0; k < 4; k++) add(new THREE.BoxGeometry(0.35, 0.05, 5.6).translate(0, 0, 2.9).rotateY((k * Math.PI) / 2), dark, 0, 0.2, 0, this.rotor);
    this.tail.position.set(0.12, 1.1, 8.4);
    for (let k = 0; k < 2; k++) add(new THREE.BoxGeometry(0.04, 1.5, 0.18).rotateX((k * Math.PI) / 2), dark, 0, 0, 0, this.tail);
    this.group.add(this.rotor, this.tail);
  }

  update(dt: number): void {
    this.rotor.rotation.y += dt * 28;
    this.tail.rotation.x += dt * 40;
  }
}
