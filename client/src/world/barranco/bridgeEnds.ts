import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import type { Heightfield } from '../heightfield';
import { ravineCentre, ravineHalf, type CoastDef } from '../coast';
import type { Plants } from '../malecon/park';
import { casona } from './casona';
import { globeLamp } from './bridge';
import { bridgeSpan, ravineOf, type BarrancoDef } from './layout';

const Q = new THREE.Quaternion();

/** Yellow plastered balustrade wall with white balusters and a cream coping, from a to c (on the ground). */
function balustrade(b: Builder, a: THREE.Vector3, c: THREE.Vector3): void {
  const d = c.clone().sub(a), len = d.length(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), d.clone().normalize()), mid = a.clone().lerp(c, 0.5);
  b.box('ochreWall', [len, 0.35, 0.4], mid.clone().setY(mid.y + 0.17), q);
  b.box('creamCornice', [len + 0.1, 0.12, 0.5], mid.clone().setY(mid.y + 1.02), q, false);
  b.box('none', [len, 1.1, 0.4], mid.clone().setY(mid.y + 0.55), q, true);
  const n = Math.max(2, Math.round(len / 0.32));
  for (let i = 0; i <= n; i++) {
    const p = a.clone().lerp(c, i / n);
    if (i % 8 === 0) b.box('ochreWall', [0.4, 1.0, 0.45], p.clone().setY(p.y + 0.5), q, false);
    else b.geometry('churchWhite', new THREE.CylinderGeometry(0.06, 0.08, 0.6, 6), new THREE.Matrix4().makeTranslation(p.x, p.y + 0.66, p.z));
  }
}

/** Grass island with a silver-leaved border (as in front of La Ermita). */
function island(b: Builder, x: number, z: number, w: number, d: number): void {
  b.box('lawnPatch', [w, 0.12, d], new THREE.Vector3(x, 0.12, z), Q, false);
  for (const [ex, ez, sw, sd] of [[x, z - d / 2, w, 0.35], [x, z + d / 2, w, 0.35], [x - w / 2, z, 0.35, d], [x + w / 2, z, 0.35, d]]) b.box('silverEdge', [sw + 0.1, 0.32, sd + 0.1], new THREE.Vector3(ex, 0.22, ez), Q, false);
}

/**
 * Both ends of the bridge as on Street View: east, La Ermita's paved forecourt with grass islands edged in silver
 * plants, palms with whitewashed trunks, a bin and globe lamps; west, a small cobbled plaza between a cobalt casona
 * with a wooden gallery and an oxblood casona with a green plinth; yellow balustrades along both lips near the
 * bridge. Below, the banks are planted terraces (see bajada).
 */
export function bridgeEnds(b: Builder, hf: Heightfield, def: BarrancoDef, c: CoastDef, plants: Plants, rand: () => number): void {
  const br = bridgeSpan(c, def), r = ravineOf(c), z0 = br.z;
  const ex = br.x1 + 1.5, front = def.ermita.x;
  b.box('pavement', [front - ex, 0.14, 26], new THREE.Vector3((ex + front) / 2, 0.03, z0), Q, false);
  for (const s of [-1, 1]) {
    island(b, (ex + front) / 2, z0 + s * 7.5, Math.max(3, front - ex - 4), 4.2);
    const palm = new THREE.Vector3((ex + front) / 2 + s * 1.5, 0.15, z0 + s * 7.5);
    plants.palms.push(palm);
    b.geometry('churchWhite', new THREE.CylinderGeometry(0.3, 0.33, 1.5, 12), new THREE.Matrix4().makeTranslation(palm.x, 0.9, palm.z));
    globeLamp(b, new THREE.Vector3(ex + 1.2, 0.1, z0 + s * 3.8), false);
  }
  const wx = br.x0 - 1.5;
  b.box('cobble', [16, 0.12, 22], new THREE.Vector3(wx - 8, 0.02, z0), Q, false);
  casona(b, { x: wx - 7, z: z0 - 11.5, y: 0, facing: 0, w: 13, d: 14, floors: 2, paint: 'paint-cobalt', style: 'gallery' }, rand);
  casona(b, { x: wx - 7, z: z0 + 11.5, y: 0, facing: Math.PI, w: 13, d: 14, floors: 2, paint: 'paint-oxblood', style: 'cajon' }, rand);
  for (const s of [-1, 1]) b.box('trimGreen', [13, 0.9, 0.08], new THREE.Vector3(wx - 7, 0.45, z0 + s * 11.62), Q, false);
  plants.standing.push({ pos: new THREE.Vector3(wx - 4, 0.1, z0 + 3), yaw: Math.PI / 2, key: 'civ_idle' });
  for (const side of [-1, 1]) for (const dir of [-1, 1]) {
    const pts: THREE.Vector3[] = [];
    for (let k = 3.2; k <= 20; k += 2) {
      const z = z0 + dir * k, x = ravineCentre(r, z) + side * (ravineHalf(c, r, z) + 0.4);
      pts.push(new THREE.Vector3(x, hf.heightAt(x, z), z));
    }
    for (let i = 1; i < pts.length; i++) balustrade(b, pts[i - 1], pts[i]);
  }
}
