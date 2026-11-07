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
const CAR_KNEE = -1.25, CAR_THIGH = -0.18;

/**
 * A Mixamo civilian frozen in the sitting pose, facing +z with the hips at the returned group's origin (for open
 * vehicles: mototaxis and delivery bikes). Null until the characters and their `sit` clip are loaded.
 */
export function seatedRig(lighting: Lighting, rand: () => number, inCar = false, kind?: CharKind, driver = false): THREE.Group | null {
  if (!characters.ready || !characters.clips.has('sit')) return null;
  const rig = new Rig(kind ?? RIDERS[Math.floor(rand() * RIDERS.length)], lighting, false);
  rig.loop(driver && characters.clips.has('drive') ? 'drive' : inCar && characters.clips.has('seat_idle') ? 'seat_idle' : 'sit');
  rig.tick(0.5 + rand());
  if (inCar) for (const s of ['Left', 'Right']) {
    rig.root.getObjectByName(`mixamorig${s}UpLeg`)!.rotateX(CAR_THIGH);
    rig.root.getObjectByName(`mixamorig${s}Leg`)!.rotateX(CAR_KNEE);
  }
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
  micro: [[0.6, 1.15, 3.4], [-0.6, 1.15, 2.2], [0.6, 1.15, 1.2], [-0.6, 1.15, 0.2], [0.6, 1.15, -0.8], [-0.6, 1.15, -1.8], [0.6, 1.15, -2.8]],
};

const seatRay = new THREE.Raycaster();

/**
 * Seats of one vehicle look. On a modelled body the height is measured on the model — a ray down from above each seat
 * finds the cushion under the roof — so riders sit on it instead of poking through a lower canopy (mototaxi).
 */
export function seatsOf(group: THREE.Object3D, kind: string): [number, number, number][] {
  if (group.userData.seats) return group.userData.seats;
  const base = SEATS[kind] ?? [];
  if (!group.userData.modelled) return (group.userData.seats = base);
  group.updateMatrixWorld(true);
  const down = new THREE.Vector3(0, -1, 0).applyQuaternion(group.getWorldQuaternion(new THREE.Quaternion()));
  return (group.userData.seats = base.map(([x, y, z]) => {
    seatRay.set(group.localToWorld(new THREE.Vector3(x, y + 0.5, z)), down);
    seatRay.far = 2;
    const ys = seatRay.intersectObject(group, true).map((h) => group.worldToLocal(h.point.clone()).y).filter((hy) => hy > 0.2 && hy < y + 0.15);
    return [x, ys.length ? Math.max(...ys) + 0.1 : y, z] as [number, number, number];
  }));
}

/**
 * The combi's cobrador (fare collector): standing on the step of the sliding door on the right (−x) side, half out
 * of the van, one hand up on the door frame, calling out the route — as in every photo of a Lima combi.
 */
export function cobrador(lighting: Lighting, rand: () => number, group: THREE.Object3D): THREE.Group | null {
  if (!characters.ready || !characters.clips.has('civ_idle')) return null;
  const rig = new Rig('civ_a', lighting, false);
  rig.loop('civ_idle');
  rig.tick(rand() * 2);
  const arm = rig.root.getObjectByName('mixamorigLeftArm'), fore = rig.root.getObjectByName('mixamorigLeftForeArm');
  arm?.rotateZ(COBRADOR_ARM);
  fore?.rotateZ(-0.5);
  rig.root.rotation.set(0, -0.2, -0.12);
  rig.castShadow = false;
  const body: THREE.Box3 | undefined = group.userData.body, half = body ? -body.min.x : 0.9;
  const holder = new THREE.Group();
  holder.name = 'rider';
  holder.userData.rig = rig;
  holder.userData.standing = true;
  holder.position.set(-(half - 0.05), 0.3, body ? (body.min.z + body.max.z) / 2 + 0.25 : 0.3);
  holder.add(rig.root);
  return holder;
}
const COBRADOR_ARM = -2.5;
