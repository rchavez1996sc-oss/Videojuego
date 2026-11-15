import type * as THREE from 'three';

/** Effects the world's set pieces may trigger (wired in `main.ts` once combat and the blast exist). */
export const worldFx = {
  blast: (_at: THREE.Vector3): void => undefined,
  puff: (_at: THREE.Vector3, _shade?: number): void => undefined,
};
