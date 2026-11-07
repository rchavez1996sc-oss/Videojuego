import type RAPIER from '@dimforge/rapier3d-compat';

/** Colliders of vehicles (traffic, driven, parked). */
export const vehicleColliders = new Set<number>();

/**
 * A character controller's computed movement, minus any lift a vehicle gave: a car overlapping a capsule makes the
 * controller climb out of it frame after frame, carrying the person metres into the air. People are only pushed aside.
 */
export function noVehicleLift(ctrl: RAPIER.KinematicCharacterController, desiredY: number, m: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  for (let i = 0; i < ctrl.numComputedCollisions(); i++) {
    const c = ctrl.computedCollision(i)?.collider;
    if (c && vehicleColliders.has(c.handle)) return { x: m.x, y: Math.min(m.y, Math.max(desiredY, 0)), z: m.z };
  }
  return m;
}
