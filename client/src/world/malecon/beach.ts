import type { Plants } from './park';
import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import type { Heightfield } from '../heightfield';
import { car, type CarKind } from '../urbanProps';
import { ravineCentre, type CoastDef } from '../coast';
import { EXTENT, type MaleconDef } from './layout';
import { ribbon } from './park';

const Q = new THREE.Quaternion();
/** Sand car parks between the Circuito de Playas and the shingle (x ranges clear of jetties, pier and bajada). */
const PARKS: [number, number][] = [[-150, -122], [-100, -62], [112, 150], [160, 196]];

/** Tall street light with two arms reaching over both carriageways. */
function roadLight(b: Builder, at: THREE.Vector3): void {
  b.geometry('alu', new THREE.CylinderGeometry(0.1, 0.16, 9, 8).translate(0, 4.5, 0), new THREE.Matrix4().makeTranslation(at.x, at.y, at.z));
  for (const s of [-1, 1]) {
    b.box('alu', [0.08, 0.08, 2.2], new THREE.Vector3(at.x, at.y + 8.9, at.z + s * 1.1), Q, false);
    b.box('lanternGlass', [0.35, 0.12, 0.6], new THREE.Vector3(at.x, at.y + 8.8, at.z + s * 2.1), Q, false);
  }
  b.box('none', [0.3, 6, 0.3], at.clone().setY(at.y + 3), Q, true);
}

/**
 * Circuito de Playas (user's photos): four-lane road under the cliff with a mesh fence at its foot, tall double-arm
 * lights, cars parked on the sand strip, and a band of grey shingle (canto rodado) along the waterline.
 */
/** Board quads of the gantries (both faces), turned into one textured mesh by the level. */
export const gantryBoards: THREE.BufferGeometry[] = [];

/** Overhead sign gantry across the beach road: two steel posts, a truss beam and green direction boards. */
function gantry(b: Builder, at: THREE.Vector3, half: number): void {
  for (const s of [-1, 1]) {
    b.box('steelDark', [0.35, 6.4, 0.35], new THREE.Vector3(at.x, at.y + 3.2, at.z + s * (half + 0.8)), Q, true);
  }
  for (const yy of [5.6, 6.3]) b.box('steelDark', [0.18, 0.18, half * 2 + 1.6], new THREE.Vector3(at.x, at.y + yy, at.z), Q, false);
  for (const s of [-1, 1]) {
    gantryBoards.push(new THREE.PlaneGeometry(half * 0.85, 1.6).rotateY(-Math.PI / 2).translate(at.x - 0.2, at.y + 5.3, at.z + s * half * 0.5));
    gantryBoards.push(new THREE.PlaneGeometry(half * 0.85, 1.6).rotateY(Math.PI / 2).translate(at.x + 0.2, at.y + 5.3, at.z - s * half * 0.5));
    b.box('steelDark', [0.06, 1.7, half * 0.87], new THREE.Vector3(at.x, at.y + 5.3, at.z + s * half * 0.5), Q, false);
  }
}

export function buildBeach(b: Builder, hf: Heightfield, def: MaleconDef, c: CoastDef, rand: () => number, plants: Plants): void {
  const br = def.beachRoad, L = EXTENT, y = (x: number, z: number) => hf.heightAt(x, z);
  for (let x = -L; x < L; x += 9) for (const s of [-1, 1]) b.box('roadWhite', [3, 0.02, 0.12], new THREE.Vector3(x, y(x, br.z) + 0.07, br.z + s * br.half / 2), Q, false);
  const fz = br.z - br.half - 2.8, gaps = (c.ravines ?? []).map((r) => ravineCentre(r, fz));
  for (let x = -L; x < L; x += 3) {
    if (gaps.some((g) => Math.abs(g - x) < 9) || Math.abs(y(x, fz) - y(x + 3, fz)) > 1.2) continue;
    const g = Math.min(y(x, fz), y(x + 3, fz));
    b.box('steelDark', [0.08, 2.7, 0.08], new THREE.Vector3(x, g + 1.35, fz), Q, false);
    b.box('cliffMesh', [3, 2.4, 0.03], new THREE.Vector3(x + 1.5, g + 1.3, fz), Q, false);
    b.box('grate', [3, 2.6, 0.3], new THREE.Vector3(x + 1.5, g + 1.3, fz), Q, true);
  }
  const mz = br.z, cut = (x: number) => Math.abs(x - (def.pier?.x ?? 1e4)) < 10 || (c.ravines ?? []).some((r) => Math.abs(ravineCentre(r, mz) + (r.skew ?? 0) * 4 - x) < 14);
  for (let x = -L; x < L; x += 2) {
    if (cut(x) || cut(x + 2)) continue;
    const g = y(x + 1, mz);
    b.box('kerbYellow', [2, 0.2, 1.4], new THREE.Vector3(x + 1, g + 0.1, mz), Q, true);
    b.box('hedge', [2, 0.12, 1.1], new THREE.Vector3(x + 1, g + 0.26, mz), Q, false);
    if (Math.round(x / 2) % 11 === 0) plants.palms.push(new THREE.Vector3(x + 1, g + 0.2, mz));
  }
  for (const gx of [-L * 0.55, L * 0.35]) gantry(b, new THREE.Vector3(gx, y(gx, mz), mz), br.half);
  for (let x = -L + 10; x < L; x += 34) roadLight(b, new THREE.Vector3(x, y(x, br.z + br.half + 1.4), br.z + br.half + 1.4));
  const shore: THREE.Vector2[] = [];
  for (let x = -L - 10; x <= L + 10; x += 4) shore.push(new THREE.Vector2(x, c.shore - 4));
  ribbon(b, hf, shore, 14, 'pebbles', 0.1);
  const kinds: CarKind[] = ['sedan', 'wagon', 'pickup', 'tico', 'sedan', 'beetle'];
  for (const [x0, x1] of PARKS) for (let x = x0; x < x1; x += 2.8) for (const z of [br.z + br.half + 4.5, br.z + br.half + 10]) {
    if (rand() < 0.35) continue;
    const kind = kinds[Math.floor(rand() * kinds.length)];
    car(b, new THREE.Vector3(x, y(x, z) + 0.03, z), rand() < 0.5 ? 0 : Math.PI, kind === 'tico' ? 'car3' : `car${[0, 1, 2, 4, 5][Math.floor(rand() * 5)]}`, kind);
  }
  const kz = br.z + br.half + 1.5, mouths = (c.ravines ?? []).map((r) => ravineCentre(r, kz) + (r.skew ?? 0) * 4);
  for (let x = -L + 6; x < L - 6; x += 5.6) {
    if (rand() < 0.4 || mouths.some((m) => Math.abs(m - x) < 16) || Math.abs(x - (def.pier?.x ?? 1e4)) < 14) continue;
    if (Math.abs((((x - (-L + 10)) % 34) + 34) % 34) < 2.5 || Math.abs((((x - (-L + 10)) % 34) + 34) % 34) > 31.5) continue;
    const kind = kinds[Math.floor(rand() * kinds.length)];
    car(b, new THREE.Vector3(x, y(x, kz) + 0.03, kz), rand() < 0.5 ? Math.PI / 2 : -Math.PI / 2, kind === 'tico' ? 'car3' : `car${[0, 1, 2, 4, 5][Math.floor(rand() * 5)]}`, kind);
  }
}

/** Galvanised chain-link: a diamond wire pattern on transparent ground, for an alpha-tested fence panel. */
export function chainLink(): THREE.CanvasTexture {
  const s = 64, cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const ctx = cv.getContext('2d')!;
  ctx.strokeStyle = '#b9bcc0';
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

/** Green direction board of the beach-road gantries: destinations in white with arrows, white border. */
export function gantrySign(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#1d6a3c';
  g.fillRect(0, 0, 1024, 256);
  g.strokeStyle = '#ffffff';
  g.lineWidth = 10;
  g.strokeRect(12, 12, 1000, 232);
  g.fillStyle = '#ffffff';
  g.font = '700 74px "Barlow Condensed", Arial, sans-serif';
  g.fillText('BARRANCO · CHORRILLOS', 150, 112, 820);
  g.font = '600 56px "Barlow Condensed", Arial, sans-serif';
  g.fillText('BAJADA BALTA  ·  MIRAFLORES', 150, 200, 820);
  g.beginPath();
  g.moveTo(40, 128); g.lineTo(110, 70); g.lineTo(110, 105); g.lineTo(130, 105); g.lineTo(130, 151); g.lineTo(110, 151); g.lineTo(110, 186);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
