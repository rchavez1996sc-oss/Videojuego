import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Lighting } from '../render/lighting';

/** Share of passers-by carrying each item (chapter `civilians.gear`). */
export interface GearDef { backpack?: number; book?: number }

const BAGS = ['#1d2a3a', '#2a2a2c', '#5a1e22', '#2f4a32', '#4a3a6a', '#7a5a2a', '#24557a'];
const COVERS = ['#8a2a22', '#1e3a6a', '#2d5a3a', '#d8c27a', '#efece4', '#3a3a3a'];
const mats = new Map<string, THREE.Material>();
const mat = (c: string, lighting: Lighting, r = 0.85) => mats.get(c) ?? mats.set(c, lighting.setup(new THREE.MeshStandardMaterial({ color: c, roughness: r }), `gear-${c}`)).get(c)!;

/** Student kit bound to bones (rig space is centimetres): a backpack on the upper spine, a book or folder in the left hand. */
export function gear(bones: Map<string, THREE.Bone>, def: GearDef, lighting: Lighting, rand: () => number): void {
  const spine = bones.get('mixamorigSpine2'), hand = bones.get('mixamorigLeftHand');
  if (spine && rand() < (def.backpack ?? 0)) {
    const c = BAGS[Math.floor(rand() * BAGS.length)], g = new THREE.Group();
    const body = new THREE.Mesh(new RoundedBoxGeometry(30, 40, 15, 3, 5), mat(c, lighting));
    const pocket = new THREE.Mesh(new RoundedBoxGeometry(22, 16, 6, 2, 3), mat(c, lighting));
    pocket.position.set(0, -9, -9);
    const zip = new THREE.Mesh(new THREE.BoxGeometry(24, 1.2, 1), mat('#1a1a1a', lighting));
    zip.position.set(0, 12, -7.6);
    g.add(body, pocket, zip);
    for (const s of [-1, 1]) {
      const strap = new THREE.Mesh(new THREE.TorusGeometry(10, 1.4, 5, 12, Math.PI), mat('#1a1a1a', lighting));
      strap.rotation.set(0, Math.PI / 2, Math.PI / 2);
      strap.position.set(s * 8, 8, 6);
      g.add(strap);
    }
    g.position.set(0, 0, -16);
    spine.add(g);
  }
  if (hand && rand() < (def.book ?? 0)) {
    const thick = rand() < 0.5 ? 3.2 : 1.2, b = new THREE.Mesh(new THREE.BoxGeometry(thick, 26, 20), mat(COVERS[Math.floor(rand() * COVERS.length)], lighting, 0.6));
    b.position.set(-1, 11, 4);
    hand.add(b);
  }
}
