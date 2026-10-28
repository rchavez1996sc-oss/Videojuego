import { hitHandler } from '../world/surfaces';

/** Colliders of civilians and extras: anyone's bullets can hit them, but only the player's count as casualties. */
export const innocents = new Set<number>();
export const blame = { player: true };

export function unblamed<T>(fn: () => T): T {
  blame.player = false;
  try { return fn(); } finally { blame.player = true; }
}

/** A stray squad or police round into a bystander: it dies, nobody is charged. Returns whether it was one. */
export function strayHit(handle: number, damage: number, at: { x: number; y: number; z: number }): boolean {
  if (!innocents.has(handle)) return false;
  unblamed(() => hitHandler(handle)?.(damage, at));
  return true;
}
