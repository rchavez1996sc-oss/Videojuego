import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import type { Heightfield } from '../heightfield';
import type { CoastDef } from '../coast';
import { northZ, type MaleconDef } from './layout';

const yaw = (a: number) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);

/** One jersey barrier (wide foot, narrow top) of length 2.9 at `p` along `q`, painted red or white. */
function jersey(b: Builder, p: THREE.Vector3, q: THREE.Quaternion, red: boolean): void {
  const mat = red ? 'barrierRed' : 'barrierWhite';
  b.box(mat, [2.9, 0.3, 0.6], p.clone().setY(p.y + 0.15), q, false);
  b.box(mat, [2.9, 0.55, 0.26], p.clone().setY(p.y + 0.57), q, false);
}

/**
 * Military cordon along the edge of the playable district (west, east and inland): jersey barriers across every
 * street and pavement with a mesh fence behind, so the invisible wall reads as a closed checkpoint line.
 * Stretches down the cliff face are skipped.
 */
export function buildBorder(b: Builder, hf: Heightfield, def: MaleconDef, c: CoastDef, half: number): void {
  const nz = northZ(def), lines: [THREE.Vector3, THREE.Vector3][] = [
    [new THREE.Vector3(-half, 0, nz), new THREE.Vector3(half, 0, nz)],
    [new THREE.Vector3(-half, 0, nz), new THREE.Vector3(-half, 0, c.shore)],
    [new THREE.Vector3(half, 0, nz), new THREE.Vector3(half, 0, c.shore)],
  ];
  for (const [a, e] of lines) {
    const dir = e.clone().sub(a), len = dir.length(), n = Math.floor(len / 3);
    dir.normalize();
    const q = yaw(Math.atan2(-dir.z, dir.x)), inward = new THREE.Vector3(-dir.z, 0, dir.x);
    if (inward.dot(a.clone().negate().setY(0)) < 0) inward.negate();
    for (let i = 0; i < n; i++) {
      const p = a.clone().addScaledVector(dir, i * 3 + 1.5).addScaledVector(inward, 0.8), g0 = hf.heightAt(p.x - dir.x * 1.5, p.z - dir.z * 1.5), g1 = hf.heightAt(p.x + dir.x * 1.5, p.z + dir.z * 1.5);
      if (Math.abs(g1 - g0) > 1.2) continue;
      p.y = Math.min(g0, g1);
      jersey(b, p, q, i % 2 === 0);
      const f = p.clone().addScaledVector(inward, -0.7);
      b.box('fenceMesh', [3, 2.2, 0.03], f.clone().setY(p.y + 1.1), q, false);
      b.box('fenceIron', [0.07, 2.4, 0.07], f.clone().addScaledVector(dir, -1.5).setY(p.y + 1.2), q, false);
      b.box('fenceIron', [3, 0.05, 0.05], f.clone().setY(p.y + 2.2), q, false);
    }
  }
}

/** Galvanised chain-link: a diamond wire pattern on transparent ground, for an alpha-tested fence panel. */
export function chainLink(): THREE.CanvasTexture {
  const s = 64, cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const ctx = cv.getContext('2d')!;
  ctx.strokeStyle = '#c9ccd0';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, s / 2); ctx.lineTo(s / 2, 0); ctx.lineTo(s, s / 2); ctx.lineTo(s / 2, s); ctx.closePath();
  ctx.stroke();
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.repeat.set(5, 5);
  return t;
}
