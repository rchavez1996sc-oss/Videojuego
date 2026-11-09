import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Lighting } from '../render/lighting';
import type { Rig } from '../entities/rig';

/** A passer-by who pushes a street-vendor tricycle (see `Civilians`). */
export interface Pusher { model: Rig; mood: string; speed: number; cart?: THREE.Object3D | null; cartBody?: RAPIER.RigidBody }

/** Body, trim and canopy colours of each kind of cart: D'Onofrio-style ice cream box, emoliente stand, sandwich vitrine. */
const KINDS: [string, string, string][] = [['#f2c400', '#d0021b', '#d0021b'], ['#2f7d3a', '#e8e0c8', '#2f62a8'], ['#f1efe8', '#2f62a8', '#e3542a']];

function painted(g: THREE.BufferGeometry, hex: string, m: THREE.Matrix4): THREE.BufferGeometry {
  const out = (g.index ? g.toNonIndexed() : g).applyMatrix4(m), c = new THREE.Color(hex), n = out.attributes.position.count;
  out.deleteAttribute('uv');
  out.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: n * 3 }, (_, i) => c.toArray()[i % 3]), 3));
  return out;
}

/**
 * A tricycle cart, built in the pusher's frame (they walk behind it toward +z): a box on two front wheels with a
 * bicycle wheel under the handlebar, a glass top or jars, and a canopy on a pole — one vertex-coloured mesh.
 */
function cart(kind: number): THREE.BufferGeometry {
  const [body, trim, roof] = KINDS[kind], t = (x: number, y: number, z: number, rx = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, rz)), new THREE.Vector3(1, 1, 1));
  const parts = [
    painted(new RoundedBoxGeometry(1.1, 0.7, 0.75, 3, 0.06), body, t(0, 0.75, 1.15)),
    painted(new THREE.BoxGeometry(1.12, 0.1, 0.77), trim, t(0, 0.5, 1.15)),
    painted(new THREE.BoxGeometry(1.12, 0.06, 0.77), trim, t(0, 1.1, 1.15)),
    painted(new RoundedBoxGeometry(0.9, 0.32, 0.55, 3, 0.07), kind === 2 ? '#c9dde6' : kind === 1 ? '#c98a3c' : '#f4f1ea', t(0, 1.29, 1.15)),
    painted(new THREE.CylinderGeometry(0.02, 0.02, 1.0, 6), '#2a2a2c', t(0.45, 1.62, 0.85)),
    painted(new THREE.ConeGeometry(0.85, 0.3, 24, 1, true), roof, t(0.45, 2.15, 1.0)),
    painted(new THREE.BoxGeometry(0.75, 0.03, 0.03), '#2a2a2c', t(0, 1.0, 0.5)),
    ...[-0.32, 0.32].map((x) => painted(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 5), '#2a2a2c', t(x, 0.8, 0.6, 0.6))),
    ...[-0.5, 0.5].flatMap((x) => [
      painted(new THREE.TorusGeometry(0.22, 0.04, 8, 20), '#1a1a1a', t(x, 0.26, 1.2).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2))),
      painted(new THREE.CylinderGeometry(0.19, 0.19, 0.02, 16), '#8a8d90', t(x, 0.26, 1.2, 0, Math.PI / 2)),
    ]),
    painted(new THREE.CylinderGeometry(0.015, 0.015, 1.0, 5), '#2a2a2c', t(0, 0.26, 1.2, 0, Math.PI / 2)),
    painted(new THREE.TorusGeometry(0.3, 0.035, 8, 22), '#1a1a1a', t(0, 0.33, 0.45).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2))),
    painted(new THREE.CylinderGeometry(0.27, 0.27, 0.015, 16), '#8a8d90', t(0, 0.33, 0.45, 0, Math.PI / 2)),
  ];
  return mergeGeometries(parts)!;
}

let geos: THREE.BufferGeometry[] | null = null, mat: THREE.Material | null = null;

/** Gives the first `n` passers-by a cart each (walking slower behind it). */
export function giveCarts(list: Pusher[], n: number, lighting: Lighting, world: RAPIER.World): void {
  geos ??= KINDS.map((_, k) => cart(k));
  mat ??= lighting.setup(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), 'vendor-cart');
  list.slice(0, n).forEach((c, i) => {
    const m = new THREE.Mesh(geos![i % KINDS.length], mat!);
    m.castShadow = m.receiveShadow = true;
    c.model.root.add(m);
    c.cart = m;
    c.cartBody = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -60, 0));
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.58, 0.75, 0.42).setTranslation(0, 0.75, 1.15), c.cartBody);
  });
}

const Q = new THREE.Quaternion(), P = new THREE.Vector3();

/**
 * Per frame: the cart's solid box follows it (others walk round it; its own pusher ignores it, see `Civilians.clearWay`),
 * pushers keep a walking pace; when they panic they let go and the cart stays where it was.
 */
export function cartStep(list: Pusher[]): void {
  for (const c of list) {
    if (!c.cart) continue;
    c.model.root.getWorldPosition(P);
    c.model.root.getWorldQuaternion(Q);
    c.cartBody?.setNextKinematicTranslation(P);
    c.cartBody?.setNextKinematicRotation(Q);
    if (c.mood === 'walk' || c.mood === 'idle') {
      c.speed = Math.min(c.speed, 0.8);
      continue;
    }
    c.model.root.parent?.attach(c.cart);
    c.cart = null;
  }
}
