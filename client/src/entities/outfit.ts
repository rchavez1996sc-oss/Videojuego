import * as THREE from 'three';
import type { Lighting } from '../render/lighting';

/** Faction dress on top of the base character: which arms get bands, scarf/beanie colours, balaclava. */
export interface Outfit { color: string; bands?: ('Left' | 'Right')[]; scarf?: string; balaclava?: boolean; beanie?: string }

/** Faction pieces bound to bones (rig space is centimetres): arm bands, neck scarf, balaclava, beanie. */
export function dress(bones: Map<string, THREE.Bone>, o: Outfit, lighting: Lighting): void {
  const mat = (c: string) => lighting.setup(new THREE.MeshStandardMaterial({ color: c, roughness: 0.92 }), `outfit-${c}`);
  const add = (n: string, geo: THREE.BufferGeometry, color: string, y: number, rx = 0) => {
    const m = new THREE.Mesh(geo, mat(color));
    m.position.y = y;
    m.rotation.x = rx;
    bones.get(`mixamorig${n}`)?.add(m);
  };
  for (const side of o.bands ?? []) add(`${side}Arm`, new THREE.CylinderGeometry(6.2, 6.2, 9, 12, 1, true), o.color, 11);
  if (o.scarf) {
    add('Neck', new THREE.TorusGeometry(7.5, 3.2, 8, 16), o.scarf, 3, Math.PI / 2);
    add('Neck', new THREE.ConeGeometry(7, 10, 8, 1, true), o.scarf, -2, Math.PI);
  }
  if (o.balaclava) add('Head', new THREE.SphereGeometry(12.2, 16, 12).scale(0.92, 1.12, 1.04).translate(0, 0, 1.6), '#141416', 9.5);
  if (o.beanie) add('Head', new THREE.SphereGeometry(11.9, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5).scale(0.95, 0.9, 1.05), o.beanie, 13);
}
