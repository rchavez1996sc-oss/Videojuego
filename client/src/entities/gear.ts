import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Lighting } from '../render/lighting';

/** Share of passers-by carrying each item (chapter `civilians.gear`). */
export interface GearDef { backpack?: number; book?: number }

const BAGS = ['#1d2a3a', '#2a2a2c', '#5a1e22', '#2f4a32', '#4a3a6a', '#7a5a2a', '#24557a'];
const COVERS = ['#8a2a22', '#1e3a6a', '#2d5a3a', '#d8c27a', '#efece4', '#3a3a3a'];
const mats = new Map<string, THREE.Material>();
const mat = (c: string, lighting: Lighting, r = 0.85) => mats.get(c) ?? mats.set(c, lighting.setup(new THREE.MeshStandardMaterial({ color: c, roughness: r }), `gear-${c}`)).get(c)!;

let bagGeo: THREE.BufferGeometry | null = null;
const bookGeo = [new THREE.BoxGeometry(3.2, 26, 20), new THREE.BoxGeometry(1.2, 26, 20)];

/** Body and pocket (group 0, bag colour) plus zip and straps (group 1, black), merged once and shared. */
function backpack(): THREE.BufferGeometry {
  if (bagGeo) return bagGeo;
  const strip = (g: THREE.BufferGeometry) => { for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); return g.index ? g.toNonIndexed() : g; };
  const cloth = [new RoundedBoxGeometry(30, 40, 15, 3, 5), new RoundedBoxGeometry(22, 16, 6, 2, 3).translate(0, -9, -9)].map(strip);
  const black = [new THREE.BoxGeometry(24, 1.2, 1).translate(0, 12, -7.6), ...[-1, 1].map((s) => new THREE.TorusGeometry(10, 1.4, 5, 12, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).translate(s * 8, 8, 6))].map(strip);
  bagGeo = mergeGeometries([mergeGeometries(cloth)!, mergeGeometries(black)!], true)!;
  return bagGeo;
}

/** Student kit bound to bones (rig space is centimetres): a backpack on the upper spine, a book or folder in the left hand. */
export function gear(bones: Map<string, THREE.Bone>, def: GearDef, lighting: Lighting, rand: () => number): void {
  const spine = bones.get('mixamorigSpine2'), hand = bones.get('mixamorigLeftHand');
  if (spine && rand() < (def.backpack ?? 0)) {
    const bag = new THREE.Mesh(backpack(), [mat(BAGS[Math.floor(rand() * BAGS.length)], lighting), mat('#1a1a1a', lighting)]);
    bag.position.set(0, 0, -16);
    spine.add(bag);
  }
  if (hand && rand() < (def.book ?? 0)) {
    const b = new THREE.Mesh(bookGeo[rand() < 0.5 ? 0 : 1], mat(COVERS[Math.floor(rand() * COVERS.length)], lighting, 0.6));
    b.position.set(-1, 11, 4);
    hand.add(b);
  }
}
