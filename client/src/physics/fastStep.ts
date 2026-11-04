import type RAPIER from '@dimforge/rapier3d-compat';

/**
 * One physics tick. There are no dynamic bodies (characters and vehicles are kinematic, the rest fixed); physics is
 * used for queries and the character controller. Rapier ≥ 0.19 keeps queries on the broad-phase BVH, updated
 * incrementally by `step` (0.14 rebuilt a query tree of ~16 000 colliders every frame, ~4–5 ms).
 */
export function physicsStep(world: RAPIER.World, dt = 1 / 60): void {
  world.timestep = Math.min(dt, 1 / 20);
  world.step();
}
