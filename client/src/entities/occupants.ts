import * as THREE from 'three';
import { Mannequin } from './mannequin';
import { SHIRTS, PANTS, SKIN, HAIR } from '../systems/civilians';
import type { Lighting } from '../render/lighting';

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

/** Seat positions (vehicle local space, +z forward) as [x, seatHeight, z]. First entry is the driver. */
export const SEATS: Record<string, [number, number, number][]> = {
  moto: [[0, 1.0, 0.3], [-0.3, 0.97, -0.6], [0.3, 0.97, -0.6]],
  sedan: [[0.38, 0.48, 0.05], [-0.38, 0.48, 0.05]],
  tico: [[0.32, 0.46, 0.0]],
  wagon: [[0.38, 0.5, 0.2], [-0.38, 0.5, -0.8]],
  pickup: [[0.38, 0.62, 0.7]],
  combi: [[0.5, 0.95, 1.5], [-0.45, 0.95, 0.2], [0.45, 0.95, -0.6], [-0.45, 0.95, -1.4]],
};
