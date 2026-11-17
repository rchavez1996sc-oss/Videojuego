import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import type { Heightfield } from '../heightfield';
import { glowSpots, lampSpots } from '../../render/nightLights';
import { DECK } from './layout';

const UP = new THREE.Vector3(0, 1, 0), Q = new THREE.Quaternion();

/** Green cast-iron lamp post of Barranco: fluted base, slim shaft and four white globes on curled arms (or one). */
export function globeLamp(b: Builder, at: THREE.Vector3, four = true): void {
  const m = (x: number, y: number, z: number) => new THREE.Matrix4().makeTranslation(at.x + x, at.y + y, at.z + z);
  b.geometry('lampPole', new THREE.CylinderGeometry(0.17, 0.24, 0.9, 10), m(0, 0.45, 0));
  b.geometry('lampPole', new THREE.CylinderGeometry(0.06, 0.09, 3.3, 8), m(0, 2.5, 0));
  b.box('none', [0.3, 3.6, 0.3], at.clone().setY(at.y + 1.8), Q, true);
  const arms = four ? [[0.55, 0], [-0.55, 0], [0, 0.55], [0, -0.55]] : [];
  for (const [x, z] of arms) {
    b.box('lampPole', [Math.abs(x) + 0.05, 0.05, Math.abs(z) + 0.05], new THREE.Vector3(at.x + x / 2, at.y + 3.85, at.z + z / 2), Q, false);
    b.geometry('globe', new THREE.SphereGeometry(0.21, 14, 10), m(x, 4.12, z));
  }
  b.geometry('globe', new THREE.SphereGeometry(0.24, 14, 10), m(0, 4.5, 0));
  lampSpots.push(at.clone().setY(at.y + 4.2));
}

/** Slanted plank or beam between two points. */
function beam(b: Builder, mat: string, a: THREE.Vector3, c: THREE.Vector3, w: number, collide = false): void {
  const d = c.clone().sub(a), len = d.length();
  b.box(mat, [w, w, len], a.clone().lerp(c, 0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.normalize()), collide);
}

/**
 * The Puente de los Suspiros (from the photos): a ~3 m wooden footbridge across the Bajada de Baños, reddish deck
 * planks, side trusses of dark posts with X bracing under a top rail, and under it wooden trestles with diagonal
 * braces standing on the bajada floor; ochre pedestals with four-globe lamps at both ends.
 */
export function suspiros(b: Builder, hf: Heightfield, span: { x0: number; x1: number; z: number }): void {
  const { x0, x1, z } = span, len = x1 - x0, W = 3.0, cx = (x0 + x1) / 2;
  b.box('bridgeDeck', [len + 1, 0.16, W], new THREE.Vector3(cx, DECK - 0.08, z), Q, true);
  for (let x = x0; x < x1; x += 0.9) b.box('bridgeWood', [0.05, 0.03, W], new THREE.Vector3(x, DECK + 0.005, z), Q, false);
  for (const s of [-1, 1]) {
    const zr = z + s * (W / 2 - 0.08);
    b.box('bridgeWood', [len + 0.6, 0.38, 0.22], new THREE.Vector3(cx, DECK - 0.35, zr), Q);
    b.box('bridgeWood', [len + 0.6, 0.12, 0.16], new THREE.Vector3(cx, DECK + 1.15, zr), Q, false);
    b.box('bridgeWood', [len + 0.6, 0.08, 0.1], new THREE.Vector3(cx, DECK + 0.12, zr), Q, false);
    b.box('none', [len, 1.2, 0.12], new THREE.Vector3(cx, DECK + 0.6, zr), Q, true);
    const posts = Math.round(len / 1.8);
    for (let i = 0; i <= posts; i++) {
      const px = x0 + (i * len) / posts;
      b.box('bridgeWood', [0.14, 1.25, 0.14], new THREE.Vector3(px, DECK + 0.6, zr), Q, false);
      if (i % 2 === 0 && i > 0 && i < posts) {
        b.box('lampPole', [0.05, 0.5, 0.05], new THREE.Vector3(px, DECK + 1.45, zr), Q, false);
        b.geometry('globe', new THREE.SphereGeometry(0.13, 12, 8), new THREE.Matrix4().makeTranslation(px, DECK + 1.82, zr));
        b.box('lampPole', [0.2, 0.04, 0.2], new THREE.Vector3(px, DECK + 1.97, zr), Q, false);
        if (s > 0) glowSpots.push(new THREE.Vector3(px, DECK + 1.85, z));
      }
      if (i < posts) {
        const nx = x0 + ((i + 1) * len) / posts;
        beam(b, 'bridgeWood', new THREE.Vector3(px, DECK + 0.15, zr), new THREE.Vector3(nx, DECK + 1.1, zr), 0.07);
        beam(b, 'bridgeWood', new THREE.Vector3(px, DECK + 1.1, zr), new THREE.Vector3(nx, DECK + 0.15, zr), 0.07);
      }
    }
  }
  for (let x = x0 + 3; x < x1 - 2; x += 5) {
    const foot = hf.heightAt(x, z);
    if (DECK - foot < 1.2) continue;
    for (const s of [-1, 1]) {
      const zl = z + s * 1.1;
      beam(b, 'bridgeWood', new THREE.Vector3(x, foot - 0.3, zl + s * 0.5), new THREE.Vector3(x, DECK - 0.5, zl), 0.24, true);
    }
    beam(b, 'bridgeWood', new THREE.Vector3(x, foot + 0.4, z - 1.5), new THREE.Vector3(x, DECK - 0.6, z + 1.2), 0.1);
    beam(b, 'bridgeWood', new THREE.Vector3(x, foot + 0.4, z + 1.5), new THREE.Vector3(x, DECK - 0.6, z - 1.2), 0.1);
    b.box('bridgeWood', [0.3, 0.25, W + 0.4], new THREE.Vector3(x, DECK - 0.55, z), Q, false);
  }
  for (const [x, dir] of [[x0 - 0.6, -1], [x1 + 0.6, 1]] as const) {
    const y = hf.heightAt(x + dir * 1.2, z);
    for (const s of [-1, 1]) {
      b.box('ochreWall', [1.4, 1.2 + Math.max(0, DECK - y), 0.7], new THREE.Vector3(x + dir * 0.7, (y + DECK + 1.2) / 2 - 0.1, z + s * 2.0), Q);
      b.box('creamCornice', [1.6, 0.12, 0.85], new THREE.Vector3(x + dir * 0.7, DECK + 1.25, z + s * 2.0), Q, false);
    }
    globeLamp(b, new THREE.Vector3(x + dir * 2.4, y, z + 2.6));
    globeLamp(b, new THREE.Vector3(x + dir * 2.4, y, z - 2.6));
    b.box('bridgeDeck', [2.6, 0.16, W], new THREE.Vector3(x + dir * 1.0, Math.max(y, DECK) - 0.08, z), new THREE.Quaternion().setFromAxisAngle(UP, 0), true);
    b.box('pavement', [14, 0.12, 16], new THREE.Vector3(x + dir * 9.3, 0.02, z), Q, false);
    b.box('kerbYellow', [14, 0.2, 0.25], new THREE.Vector3(x + dir * 9.3, 0.05, z - 8), Q, false);
    b.box('kerbYellow', [14, 0.2, 0.25], new THREE.Vector3(x + dir * 9.3, 0.05, z + 8), Q, false);
  }
}
