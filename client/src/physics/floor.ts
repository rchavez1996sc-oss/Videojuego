import RAPIER from '@dimforge/rapier3d-compat';

/**
 * Height of the solid floor at (x, z) for feet given at `y` (usually the bare terrain): pavements, road slabs and
 * paths stand a few centimetres above it, and a character placed at terrain height ends up buried in them, where
 * its controller jams. Looks down from 0.6 m above, against fixed geometry only.
 */
export function floorAt(world: RAPIER.World, x: number, y: number, z: number): number {
  const hit = world.castRay(new RAPIER.Ray({ x, y: y + 0.6, z }, { x: 0, y: -1, z: 0 }), 1.2, true, RAPIER.QueryFilterFlags.ONLY_FIXED | RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);
  return hit ? Math.max(y, y + 0.6 - hit.timeOfImpact) : y;
}

const DOWN = { x: 0, y: -1, z: 0 }, UP = { x: 0, y: 1, z: 0 };

/**
 * Kerbs, slab edges and steps (1.5–45 cm): Rapier's autostep fails at walking pace, so a character pushing forward
 * that barely moved gets lifted onto the floor found just ahead, if there is head room there. Returns the movement
 * to apply (the controller's own when nothing needs climbing).
 */
export function stepAssist(world: RAPIER.World, ctrl: RAPIER.KinematicCharacterController, want: { x: number; z: number }, moved: RAPIER.Vector, feet: { x: number; y: number; z: number }, radius: number): RAPIER.Vector {
  const w = Math.hypot(want.x, want.z);
  if (w < 0.004 || Math.hypot(moved.x, moved.z) > w * 0.5 || !ctrl.computedGrounded()) return moved;
  const dx = want.x / w, dz = want.z / w;
  for (const reach of [radius + 0.08, radius + 0.25]) {
    const x = feet.x + dx * reach, z = feet.z + dz * reach;
    const hit = world.castRay(new RAPIER.Ray({ x, y: feet.y + 0.55, z }, DOWN), 0.6, true, RAPIER.QueryFilterFlags.ONLY_FIXED | RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);
    if (!hit) continue;
    const dh = 0.55 - hit.timeOfImpact;
    if (dh < 0.015 || dh > 0.45) continue;
    if (world.castRay(new RAPIER.Ray({ x, y: feet.y + dh + 0.05, z }, UP), 1.7, true, RAPIER.QueryFilterFlags.ONLY_FIXED | RAPIER.QueryFilterFlags.EXCLUDE_SENSORS)) continue;
    return { x: want.x, y: dh + 0.02, z: want.z };
  }
  return moved;
}
