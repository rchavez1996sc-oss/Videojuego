import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Lighting } from '../render/lighting';

/** Share of passers-by carrying each item (chapter `civilians.gear`). */
export interface GearDef { backpack?: number; book?: number; helmet?: number; vest?: number; phone?: number }

const BAGS = ['#1d2a3a', '#2a2a2c', '#5a1e22', '#2f4a32', '#4a3a6a', '#7a5a2a', '#24557a'];
const COVERS = ['#8a2a22', '#1e3a6a', '#2d5a3a', '#d8c27a', '#efece4', '#3a3a3a'];
const CAP = 2048;

/** Body and pocket in white (tinted per instance), zip and straps baked black in the vertex colours. */
function backpack(): THREE.BufferGeometry {
  const strip = (g: THREE.BufferGeometry, c: number) => {
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    const out = g.index ? g.toNonIndexed() : g;
    out.setAttribute('color', new THREE.Float32BufferAttribute(new Array(out.attributes.position.count * 3).fill(c), 3));
    return out;
  };
  const cloth = [new RoundedBoxGeometry(30, 40, 15, 3, 5), new RoundedBoxGeometry(22, 16, 6, 2, 3).translate(0, -9, -9)].map((g) => strip(g, 1));
  const black = [new THREE.BoxGeometry(24, 1.2, 1).translate(0, 12, -7.6), ...[-1, 1].map((s) => new THREE.TorusGeometry(10, 1.4, 5, 12, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).translate(s * 8, 8, 6))].map((g) => strip(g, 0.1));
  return mergeGeometries([...cloth, ...black])!;
}

/** Hard hat: dome with a ridge and a brim (rig space, cm). */
function helmet(): THREE.BufferGeometry {
  const dome = new THREE.SphereGeometry(12.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.85, 1.12);
  const brim = new THREE.CylinderGeometry(14.5, 15, 1.2, 18).scale(1, 1, 1.15).translate(0, 0.4, 1.2);
  const ridge = new THREE.BoxGeometry(2.4, 2, 24).translate(0, 9.6, 0);
  return mergeGeometries([dome, brim, ridge].map((g) => (g.index ? g.toNonIndexed() : g)))!;
}

/** High-visibility vest: an open tube around the chest, fluorescent orange with two silver reflective bands, both in the vertex colours. */
function vest(): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(17, 18.5, 40, 20, 8, true).scale(1.08, 1, 0.78).toNonIndexed(), pos = g.attributes.position, c: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i), band = Math.abs(y + 6) < 2.4 || Math.abs(y - 6) < 2.4;
    c.push(...(band ? [0.82, 0.83, 0.8] : [1, 0.33, 0.04]));
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  return g;
}

/**
 * Every backpack and every book in the level is one instanced draw each (they were 2–3 draws per student):
 * an empty anchor rides the bone, and right before each frame is drawn the visible anchors' world matrices are
 * copied into the instances (after the scene's matrices are updated, so the kit never lags behind the body).
 */
class Pool {
  readonly mesh: THREE.InstancedMesh;
  private items: { anchor: THREE.Object3D; color: THREE.Color }[] = [];
  constructor(geo: THREE.BufferGeometry, mat: THREE.Material) {
    this.mesh = new THREE.InstancedMesh(geo, mat, CAP);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }
  add(anchor: THREE.Object3D, color: string): void {
    if (this.items.length < CAP) this.items.push({ anchor, color: new THREE.Color(color) });
  }
  sync(): void {
    let n = 0;
    for (const it of this.items) {
      let o: THREE.Object3D | null = it.anchor, shown = true;
      while (o && shown) (shown = o.visible), (o = o.parent);
      if (!shown || !it.anchor.parent) continue;
      this.mesh.setMatrixAt(n, it.anchor.matrixWorld);
      this.mesh.setColorAt(n++, it.color);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

let pools: { bag: Pool; book: Pool; thin: Pool; hat: Pool; vest: Pool; phone: Pool } | null = null;

function poolsFor(lighting: Lighting): NonNullable<typeof pools> {
  if (pools) return pools;
  const std = (key: string, r: number, vc = false) => lighting.setup(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: r, vertexColors: vc }), key);
  pools = { bag: new Pool(backpack(), std('gear-bag', 0.85, true)), book: new Pool(new THREE.BoxGeometry(3.2, 26, 20), std('gear-book', 0.6)), thin: new Pool(new THREE.BoxGeometry(1.2, 26, 20), std('gear-book', 0.6)),
    hat: new Pool(helmet(), std('gear-hat', 0.45)), vest: new Pool(vest(), std('gear-vest', 0.8, true)), phone: new Pool(new THREE.BoxGeometry(7.4, 15, 0.9), std('gear-phone', 0.3)) };
  const all = Object.values(pools), scene = lighting.scene;
  scene.add(...all.map((p) => p.mesh));
  let last = -1;
  const prev = scene.onBeforeRender.bind(scene);
  scene.onBeforeRender = (...a) => {
    prev(...a);
    const r = a[0];
    if (r.info.render.frame === last) return;
    last = r.info.render.frame;
    all.forEach((p) => p.sync());
  };
  return pools;
}

/** Student kit bound to bones (rig space is centimetres): a backpack on the upper spine, a book or folder in the left hand. */
export function gear(bones: Map<string, THREE.Bone>, def: GearDef, lighting: Lighting, rand: () => number): THREE.Object3D[] {
  const out: THREE.Object3D[] = [], p = poolsFor(lighting);
  const spine = bones.get('mixamorigSpine2'), hand = bones.get('mixamorigLeftHand');
  if (spine && rand() < (def.backpack ?? 0)) {
    const bag = new THREE.Object3D();
    bag.position.set(0, 0, -16);
    spine.add(bag);
    p.bag.add(bag, BAGS[Math.floor(rand() * BAGS.length)]);
    out.push(bag);
  }
  if (hand && rand() < (def.book ?? 0)) {
    const b = new THREE.Object3D();
    b.position.set(-1, 11, 4);
    hand.add(b);
    (rand() < 0.5 ? p.book : p.thin).add(b, COVERS[Math.floor(rand() * COVERS.length)]);
    out.push(b);
  }
  const head = bones.get('mixamorigHead'), chest = bones.get('mixamorigSpine1'), right = bones.get('mixamorigRightHand');
  const wear = (pool: Pool, bone: THREE.Bone | undefined, chance: number | undefined, at: [number, number, number], color: string) => {
    if (!bone || rand() >= (chance ?? 0)) return;
    const o = new THREE.Object3D();
    o.position.set(...at);
    bone.add(o);
    pool.add(o, color);
    out.push(o);
  };
  wear(p.hat, head, def.helmet, [0, 13, 1.5], rand() < 0.7 ? '#e8b81c' : '#f2f0ea');
  wear(p.vest, chest, def.vest, [0, 6, -1], '#ffffff');
  wear(p.phone, right, def.phone, [2, 9, 3], '#1a1b1e');
  return out;
}
