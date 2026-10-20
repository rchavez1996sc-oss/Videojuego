export type Surface = 'dirt' | 'rock' | 'wood' | 'adobe' | 'tile' | 'metal';

const byCollider = new Map<number, Surface>();
/** Handlers return `false` when the bullet's normal impact effects should still play. */
type HitFn = (damage: number, point: { x: number; y: number; z: number }) => boolean | void;
const handlers = new Map<number, HitFn>();

export function setSurface(handle: number, s: Surface): void {
  byCollider.set(handle, s);
}

export function surfaceOf(handle: number): Surface {
  return byCollider.get(handle) ?? 'dirt';
}

/** Lets gameplay objects (targets, later enemies/vehicles) receive bullet hits by collider. */
export function onHit(handle: number, fn: HitFn): void {
  handlers.set(handle, fn);
}

export function hitHandler(handle: number) {
  return handlers.get(handle);
}

export const SURFACE_FX: Record<Surface, { dust: string; sparks: boolean; decal: number; decalColor: string }> = {
  dirt: { dust: '#7a6650', sparks: false, decal: 0.16, decalColor: '#2a2018' },
  rock: { dust: '#8d877f', sparks: true, decal: 0.07, decalColor: '#3b3833' },
  wood: { dust: '#8a6a48', sparks: false, decal: 0.06, decalColor: '#1c120a' },
  adobe: { dust: '#b39474', sparks: false, decal: 0.09, decalColor: '#4a3626' },
  tile: { dust: '#9c5236', sparks: false, decal: 0.08, decalColor: '#3a1a10' },
  metal: { dust: '#555555', sparks: true, decal: 0.05, decalColor: '#202020' },
};
