import * as THREE from 'three';
import { Mannequin } from './mannequin';
import { SHIRTS, PANTS, SKIN, HAIR } from '../systems/civilians';
import type { Lighting } from '../render/lighting';
import { Rig } from './rig';
import { characters, type CharKind } from '../render/characters';

let shared: THREE.Material | null = null;

/** A random seated civilian as a single mesh; origin at the feet, hips sit ~0.95 m above it. */
export function seatedPerson(lighting: Lighting, rand: () => number): THREE.Mesh {
  shared ??= lighting.setup(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), 'seated');
  const pick = <T>(a: T[]) => a[Math.floor(rand() * a.length)];
  const m = new Mannequin(lighting, { id: 'seat', cloth: pick(PANTS), vest: pick(SHIRTS), skin: pick(SKIN), helmet: pick(HAIR) }, false);
  const mesh = m.seatedMesh(shared);
  mesh.castShadow = false;
  return mesh;
}

const RIDERS: CharKind[] = ['civ_a', 'civ_b', 'civ_c'];
/** Chair pose shins hang straight down; in a car they reach forward to the pedals (rad about the knee). */
const CAR_KNEE = -0.75;

/**
 * A Mixamo civilian frozen in the sitting pose, facing +z with the hips at the returned group's origin (for open
 * vehicles: mototaxis and delivery bikes). Null until the characters and their `sit` clip are loaded.
 */
export function seatedRig(lighting: Lighting, rand: () => number, inCar = false): THREE.Group | null {
  if (!characters.ready || !characters.clips.has('sit')) return null;
  const rig = new Rig(RIDERS[Math.floor(rand() * RIDERS.length)], lighting, false);
  rig.loop('sit');
  rig.tick(0.5 + rand());
  if (inCar) for (const s of ['Left', 'Right']) rig.root.getObjectByName(`mixamorig${s}Leg`)!.rotateX(CAR_KNEE);
  rig.root.updateMatrixWorld(true);
  const knees = ['Left', 'Right'].map((s) => rig.root.getObjectByName(`mixamorig${s}Leg`)!.getWorldPosition(new THREE.Vector3()));
  const ahead = knees[0].add(knees[1]).multiplyScalar(0.5).sub(rig.hips());
  rig.root.rotation.y = -Math.atan2(ahead.x, ahead.z);
  rig.root.updateMatrixWorld(true);
  rig.root.position.sub(rig.hips());
  rig.castShadow = false;
  const holder = new THREE.Group();
  holder.name = 'rider';
  holder.userData.rig = rig;
  holder.add(rig.root);
  return holder;
}

/** Seat positions (vehicle local space, +z forward) as [x, seatHeight, z]. First entry is the driver. */
export const SEATS: Record<string, [number, number, number][]> = {
  delivery: [[0, 0.9, -0.12]],
  moto: [[0, 1.0, 0.3], [-0.3, 0.97, -0.6], [0.3, 0.97, -0.6]],
  sedan: [[0.38, 0.48, 0.05], [-0.38, 0.48, 0.05]],
  tico: [[0.32, 0.46, 0.0]],
  wagon: [[0.38, 0.5, 0.2], [-0.38, 0.5, -0.8]],
  pickup: [[0.38, 0.62, 0.7]],
  combi: [[0.5, 0.95, 1.5], [-0.45, 0.95, 0.2], [0.45, 0.95, -0.6], [-0.45, 0.95, -1.4]],
};
