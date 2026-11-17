import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import type { Heightfield } from '../heightfield';
import { ribbon, bench, type Plants } from '../malecon/park';
import { globeLamp } from './bridge';
import type { BarrancoDef } from './layout';

const UP = new THREE.Vector3(0, 1, 0), Q = new THREE.Quaternion();
type At = (x: number, y: number, z: number) => THREE.Vector3;

function frame(x: number, y: number, z: number, yaw: number): { at: At; q: THREE.Quaternion } {
  const q = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
  return { q, at: (a, b, c) => new THREE.Vector3(a, b, c).applyQuaternion(q).add(new THREE.Vector3(x, y, z)) };
}

/** Pitched tile roof over a w × d nave of eave height h (two slabs). */
function gable(b: Builder, at: At, q: THREE.Quaternion, w: number, d: number, h: number, mat = 'roofTile'): void {
  const pitch = 0.5, slope = w / 2 / Math.cos(pitch);
  for (const s of [-1, 1]) b.box(mat, [slope + 0.4, 0.14, d + 0.6], at(s * w / 4, h + Math.tan(pitch) * w / 4, -d / 2), q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -s * pitch)), false);
}

/** Arched opening drawn as a dark recess with a round head and a moulded surround. */
function arch(b: Builder, at: At, q: THREE.Quaternion, x: number, y: number, w: number, h: number, fill = 'trimBrown', surround = 'churchWhite'): void {
  b.box(fill, [w, h - w / 2, 0.1], at(x, y + (h - w / 2) / 2, 0.02), q, false);
  b.geometry(fill, new THREE.CircleGeometry(w / 2, 16, 0, Math.PI), new THREE.Matrix4().compose(at(x, y + h - w / 2, 0.075), q, new THREE.Vector3(1, 1, 1)));
  b.geometry(surround, new THREE.TorusGeometry(w / 2 + 0.08, 0.09, 6, 16, Math.PI), new THREE.Matrix4().compose(at(x, y + h - w / 2, 0.1), q, new THREE.Vector3(1, 1, 1)));
  for (const s of [-1, 1]) b.box(surround, [0.16, h - w / 2, 0.14], at(x + s * (w / 2 + 0.08), y + (h - w / 2) / 2, 0.08), q, false);
}

/**
 * La Ermita (from the photos): small ochre-yellow chapel at the end of the bridge, a single nave under a tile roof,
 * a front with a curved gable and a bell gable of two arches with bells, a wooden door and a round window.
 */
function ermita(b: Builder, e: BarrancoDef['ermita']): void {
  const { at, q } = frame(e.x, 0, e.z, e.yaw), w = 8, d = 17, h = 6.5;
  b.box('stairStone', [w + 0.6, 0.5, d + 0.6], at(0, 0.1, -d / 2), q);
  for (const [x, z, sx, sz] of [[0, 0, w, 0.6], [0, -d, w, 0.6], [-w / 2, -d / 2, 0.6, d], [w / 2, -d / 2, 0.6, d]]) b.box('churchYellow', [sx, h, sz], at(x, h / 2 + 0.3, z - (z === 0 ? 0.3 : z === -d ? -0.3 : 0)), q);
  gable(b, at, q, w, d, h + 0.3);
  for (let k = 0; k < 5; k++) b.box('churchYellow', [w - k * 1.5, 0.75, 0.6], at(0, h + 0.65 + k * 0.72, -0.3), q);
  b.box('churchYellow', [3.4, 3.4, 0.6], at(0, h + 5.3, -0.3), q);
  for (const s of [-1, 1]) {
    arch(b, (x, y, z) => at(x, y, z + 0.01), q, s * 0.8, h + 4.0, 0.9, 2.2, 'lhBlack', 'creamCornice');
    b.geometry('bronze', new THREE.SphereGeometry(0.28, 10, 8, 0, Math.PI * 2, 0, Math.PI / 1.6), new THREE.Matrix4().compose(at(s * 0.8, h + 5.0, -0.25), q, new THREE.Vector3(1, 1.2, 1)));
  }
  b.geometry('creamCornice', new THREE.TorusGeometry(0.2, 0.05, 6, 12).rotateX(Math.PI / 2), new THREE.Matrix4().compose(at(0, h + 7.3, -0.3), q, new THREE.Vector3(1, 1, 1)));
  b.box('creamCornice', [0.08, 1.0, 0.08], at(0, h + 7.5, -0.3), q, false);
  b.box('creamCornice', [0.6, 0.08, 0.08], at(0, h + 7.7, -0.3), q, false);
  arch(b, at, q, 0, 0.35, 2.0, 3.6);
  b.geometry('glass', new THREE.CircleGeometry(0.7, 20), new THREE.Matrix4().compose(at(0, h - 0.6, 0.04), q, new THREE.Vector3(1, 1, 1)));
  b.geometry('creamCornice', new THREE.TorusGeometry(0.75, 0.1, 6, 20), new THREE.Matrix4().compose(at(0, h - 0.6, 0.08), q, new THREE.Vector3(1, 1, 1)));
  for (const s of [-1, 1]) b.box('creamCornice', [0.5, h, 0.2], at(s * (w / 2 - 0.25), h / 2 + 0.3, 0.08), q, false);
}

/**
 * Iglesia La Santísima Cruz on the park (from the photos): long yellow nave with white pilasters and cornices, a
 * tall central tower over the entrance with belfry arches, clock and a slender spire, three arched doors.
 */
function church(b: Builder, c: BarrancoDef['church']): void {
  const { at, q } = frame(c.x, 0, c.z, c.yaw), w = 18, d = 38, h = 12;
  b.box('stairStone', [w + 3, 0.6, 4], at(0, 0.0, 1.6), q);
  b.box('stairStone', [w + 2, 0.3, 2], at(0, 0.45, 0.6), q);
  b.box('churchYellow', [w, h, d], at(0, h / 2 + 0.3, -d / 2), q);
  gable(b, at, q, w, d, h + 0.3);
  b.box('churchYellow', [w, 3.5, 0.6], at(0, h + 2.0, -0.3), q);
  for (let i = 0; i < 7; i++) {
    const x = -w / 2 + i * (w / 6);
    b.box('churchWhite', [0.6, h, 0.3], at(x, h / 2 + 0.3, 0.1), q, false);
    if (i < 6) arch(b, (xx, y, z) => at(xx, y, z), q, x + w / 12, 6.5, 1.3, 3.2, 'glass');
    for (const s of [-1, 1]) b.box('churchWhite', [0.3, h, 0.6], at(s * (w / 2 + 0.1), h / 2 + 0.3, -i * (d / 6) - 0.3), q, false);
  }
  b.box('churchWhite', [w + 0.6, 0.45, 0.8], at(0, h + 0.2, 0.05), q, false);
  b.box('churchWhite', [w + 0.6, 0.35, 0.7], at(0, 4.6, 0.05), q, false);
  for (const x of [-5.5, 0, 5.5]) arch(b, at, q, x, 0.6, x ? 1.8 : 2.6, x ? 3.4 : 4.4);
  const tw = 6, th = 30;
  b.box('churchYellow', [tw, th - h, tw], at(0, h + (th - h) / 2, -tw / 2 + 0.6), q);
  for (const y of [h + 5.5, th - 0.2]) b.box('churchWhite', [tw + 0.6, 0.45, tw + 0.6], at(0, y, -tw / 2 + 0.6), q, false);
  for (const [nx, nz, yaw] of [[0, 0.62, 0], [0, -tw + 0.58, Math.PI], [tw / 2 + 0.02, -tw / 2 + 0.6, Math.PI / 2], [-tw / 2 - 0.02, -tw / 2 + 0.6, -Math.PI / 2]] as const) {
    const fq = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(UP, yaw)), fa: At = (x, y, z) => at(nx, 0, nz).add(new THREE.Vector3(x, y, z).applyQuaternion(fq));
    arch(b, fa, fq, 0, th - 6.5, 2.2, 5, 'lhBlack');
    b.geometry('churchWhite', new THREE.CircleGeometry(1.1, 24), new THREE.Matrix4().compose(fa(0, h + 3, 0.03), fq, new THREE.Vector3(1, 1, 1)));
    b.box('lhBlack', [0.08, 0.8, 0.03], fa(0, h + 3.3, 0.07), fq, false);
    b.box('lhBlack', [0.55, 0.08, 0.03], fa(0.25, h + 3, 0.08), fq, false);
  }
  b.geometry('churchWhite', new THREE.ConeGeometry(tw * 0.5, 9, 8), new THREE.Matrix4().compose(at(0, th + 4.5, -tw / 2 + 0.6), q, new THREE.Vector3(1, 1, 1)));
  b.box('bronze', [0.12, 2.2, 0.12], at(0, th + 10, -tw / 2 + 0.6), q, false);
  b.box('bronze', [1.0, 0.12, 0.12], at(0, th + 10.4, -tw / 2 + 0.6), q, false);
}

/**
 * Biblioteca Municipal (from the photos): rose-pink two-storey republican building with white trim, arched windows
 * and a central clock tower crowned by a little dome, on the park.
 */
function library(b: Builder, l: BarrancoDef['library']): void {
  const { at, q } = frame(l.x, 0, l.z, l.yaw), w = 28, d = 14, h = 8.6;
  b.box('stairStone', [w + 1, 0.5, d + 1], at(0, 0.0, -d / 2), q);
  b.box('libraryPink', [w, h, d], at(0, h / 2 + 0.25, -d / 2), q);
  for (const y of [4.3, h + 0.2]) b.box('churchWhite', [w + 0.5, 0.35, 0.5], at(0, y, 0.05), q, false);
  b.box('libraryPink', [w, 1.0, 0.3], at(0, h + 0.8, -0.1), q);
  for (let i = 0; i < Math.round(w / 0.5); i++) b.box('churchWhite', [0.14, 0.6, 0.14], at(-w / 2 + 0.25 + i * 0.5, h + 0.75, 0.08), q, false);
  for (let i = 0; i < 7; i++) {
    const x = -w / 2 + 2 + i * ((w - 4) / 6);
    if (i === 3) arch(b, at, q, x, 0.25, 2.4, 3.6);
    else arch(b, at, q, x, 1.0, 1.3, 2.7, 'glass');
    arch(b, at, q, x, 5.0, 1.3, 2.8, 'glass');
    b.box('churchWhite', [0.5, h, 0.2], at(x + (w - 4) / 12, h / 2 + 0.25, 0.08), q, false);
  }
  const tw = 5, th = 17;
  b.box('libraryPink', [tw, th - h, tw], at(0, h + (th - h) / 2, -tw / 2 + 0.5), q);
  b.box('churchWhite', [tw + 0.5, 0.4, tw + 0.5], at(0, th, -tw / 2 + 0.5), q, false);
  b.geometry('churchWhite', new THREE.CircleGeometry(1.3, 28), new THREE.Matrix4().compose(at(0, th - 3.2, 0.53), q, new THREE.Vector3(1, 1, 1)));
  b.geometry('creamCornice', new THREE.TorusGeometry(1.35, 0.12, 6, 28), new THREE.Matrix4().compose(at(0, th - 3.2, 0.56), q, new THREE.Vector3(1, 1, 1)));
  b.box('lhBlack', [0.09, 1.0, 0.03], at(0, th - 2.8, 0.6), q, false);
  b.box('lhBlack', [0.7, 0.09, 0.03], at(-0.3, th - 3.2, 0.62), q, false);
  b.geometry('libraryPink', new THREE.SphereGeometry(tw * 0.42, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.Matrix4().compose(at(0, th + 0.2, -tw / 2 + 0.5), q, new THREE.Vector3(1, 0.8, 1)));
  b.box('bronze', [0.1, 1.6, 0.1], at(0, th + 2.6, -tw / 2 + 0.5), q, false);
}

/**
 * Parque Municipal: lawn quarters between red-paved paths, a ring round a stone fountain, flower beds edged by low
 * hedges, four-globe lamps, benches with people, palms and trees.
 */
function park(b: Builder, hf: Heightfield, def: BarrancoDef, plants: Plants, rand: () => number): void {
  const p = def.park, cx = (p.x0 + p.x1) / 2, cz = (p.z0 + p.z1) / 2, hx = (p.x1 - p.x0) / 2, hz = (p.z1 - p.z0) / 2;
  b.box('pavement', [p.x1 - p.x0, 0.16, p.z1 - p.z0], new THREE.Vector3(cx, 0, cz), Q);
  const lawn = (x0: number, x1: number, z0: number, z1: number) => b.box('hedge', [x1 - x0, 0.06, z1 - z0], new THREE.Vector3((x0 + x1) / 2, 0.11, (z0 + z1) / 2), Q, false);
  const pw = 3.2, ring = 9;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x0 = cx + (sx < 0 ? -hx + 2 : pw / 2), x1 = cx + (sx < 0 ? -pw / 2 : hx - 2), z0 = cz + (sz < 0 ? -hz + 2 : pw / 2), z1 = cz + (sz < 0 ? -pw / 2 : hz - 2);
    lawn(x0, x1, z0, z1);
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    flowerBed(b, mx, mz, 4.5, 2.2, 'flowers', rand);
    flowerBed(b, mx + sx * 4.5, mz + sz * 1.5, 2.2, 4.5, 'flowerRed', rand);
    for (const [ex, ez, w, d] of [[x0, mz, 0.35, z1 - z0], [x1, mz, 0.35, z1 - z0], [mx, z0, x1 - x0, 0.35], [mx, z1, x1 - x0, 0.35]]) b.box('hedge', [w, 0.45, d], new THREE.Vector3(ex, 0.3, ez), Q, true);
    plants.palms.push(new THREE.Vector3(x0 + 2.5, 0.1, z0 + 2.5));
    plants.trees.push(new THREE.Vector3(x1 - 3, 0.1, z1 - 3), new THREE.Vector3(mx - sx * 3, 0.1, mz + sz * 4));
    globeLamp(b, new THREE.Vector3(cx + sx * (pw / 2 + 0.6), 0.08, cz + sz * (ring + 4)));
    const by = new THREE.Vector3(cx + sx * (ring + 1.4), 0.08, cz + sz * (pw / 2 + 0.9)), yaw = sz < 0 ? 0 : Math.PI;
    bench(b, by, yaw);
    if (rand() < 0.7) plants.seats.push({ pos: by.clone().setY(0.53), yaw });
  }
  b.box('pavement', [ring * 2 + 2, 0.18, ring * 2 + 2], new THREE.Vector3(cx, 0.01, cz), Q, false);
  ribbon(b, hf, Array.from({ length: 33 }, (_, i) => new THREE.Vector2(cx + Math.cos(i / 32 * Math.PI * 2) * ring, cz + Math.sin(i / 32 * Math.PI * 2) * ring)), pw, 'paverRed', 0.19);
  b.geometry('granite', new THREE.CylinderGeometry(4.2, 4.4, 0.7, 32), new THREE.Matrix4().makeTranslation(cx, 0.4, cz));
  b.box('none', [7.5, 0.8, 7.5], new THREE.Vector3(cx, 0.4, cz), Q, true);
  b.geometry('poolWater', new THREE.CylinderGeometry(3.9, 3.9, 0.05, 32), new THREE.Matrix4().makeTranslation(cx, 0.72, cz));
  b.geometry('granite', new THREE.CylinderGeometry(0.5, 0.8, 2.2, 16), new THREE.Matrix4().makeTranslation(cx, 1.6, cz));
  b.geometry('granite', new THREE.CylinderGeometry(1.4, 0.4, 0.4, 20), new THREE.Matrix4().makeTranslation(cx, 2.8, cz));
  b.geometry('bronze', new THREE.SphereGeometry(0.4, 12, 8), new THREE.Matrix4().makeTranslation(cx, 3.2, cz));
  for (let k = 0; k < 4; k++) plants.standing.push({ pos: new THREE.Vector3(cx + Math.cos(k * 1.6) * (ring + 0.4), 0.17, cz + Math.sin(k * 1.6) * (ring + 0.4)), yaw: k * 1.6 + Math.PI / 2, key: ['civ_idle', 'texting', 'look_around'][k % 3] });
  ribbon(b, hf, [new THREE.Vector2(p.x0, cz), new THREE.Vector2(cx - ring, cz)], pw, 'paverRed', 0.18);
  ribbon(b, hf, [new THREE.Vector2(cx + ring, cz), new THREE.Vector2(p.x1, cz)], pw, 'paverRed', 0.18);
  ribbon(b, hf, [new THREE.Vector2(cx, p.z0), new THREE.Vector2(cx, cz - ring)], pw, 'paverRed', 0.18);
  ribbon(b, hf, [new THREE.Vector2(cx, cz + ring), new THREE.Vector2(cx, p.z1)], pw, 'paverRed', 0.18);
}

/** Bed of flowers: dark soil with dozens of small leafy clumps, most in bloom. */
function flowerBed(b: Builder, x: number, z: number, w: number, d: number, bloom: string, rand: () => number): void {
  b.box('soilBed', [w, 0.22, d], new THREE.Vector3(x, 0.15, z), Q, false);
  for (let k = 0; k < Math.round(w * d * 3); k++) {
    const s = 0.12 + rand() * 0.14;
    b.geometry(rand() < 0.7 ? bloom : 'hedge', new THREE.IcosahedronGeometry(s, 0), new THREE.Matrix4().compose(new THREE.Vector3(x + (rand() - 0.5) * (w - 0.3), 0.3 + s * 0.5, z + (rand() - 0.5) * (d - 0.3)), new THREE.Quaternion().setFromEuler(new THREE.Euler(rand() * 3, rand() * 3, 0)), new THREE.Vector3(1, 0.7, 1)));
  }
}

/** Mirador over the sea beside the bajada: a wooden pergola on white columns, railing, benches, people looking out. */
function mirador(b: Builder, m: BarrancoDef['mirador'], plants: Plants): void {
  const w = 18, d = 6;
  b.box('paverRed', [w + 2, 0.18, d + 2], new THREE.Vector3(m.x, 0.02, m.z), Q);
  for (let i = 0; i <= 6; i++) for (const s of [-1, 1]) {
    const x = m.x - w / 2 + (i * w) / 6, z = m.z + s * d / 2;
    b.geometry('churchWhite', new THREE.CylinderGeometry(0.18, 0.2, 2.8, 10), new THREE.Matrix4().makeTranslation(x, 1.5, z));
    b.box('none', [0.4, 2.8, 0.4], new THREE.Vector3(x, 1.5, z), Q, true);
  }
  for (const s of [-1, 1]) b.box('bridgeWood', [w + 0.8, 0.3, 0.25], new THREE.Vector3(m.x, 3.05, m.z + s * d / 2), Q, false);
  for (let x = m.x - w / 2; x <= m.x + w / 2 + 0.01; x += 0.9) b.box('bridgeWood', [0.12, 0.16, d + 1.2], new THREE.Vector3(x, 3.28, m.z), Q, false);
  b.box('trimGreen', [w + 1, 0.08, 0.08], new THREE.Vector3(m.x, 1.05, m.z + d / 2 + 0.9), Q, false);
  b.box('none', [w + 1, 1.1, 0.2], new THREE.Vector3(m.x, 0.6, m.z + d / 2 + 0.9), Q, true);
  for (let x = m.x - w / 2; x <= m.x + w / 2; x += 0.3) b.box('trimGreen', [0.03, 0.95, 0.03], new THREE.Vector3(x, 0.55, m.z + d / 2 + 0.9), Q, false);
  for (let i = 0; i < 4; i++) {
    const at = new THREE.Vector3(m.x - 6 + i * 4, 0.1, m.z - d / 2 + 1.2);
    bench(b, at, Math.PI);
    if (i % 2 === 0) plants.seats.push({ pos: at.clone().setY(0.55), yaw: Math.PI });
    plants.standing.push({ pos: new THREE.Vector3(m.x - 7 + i * 4.3, 0.12, m.z + d / 2 + 0.4), yaw: 0, key: i % 2 ? 'look_around' : 'civ_idle' });
  }
  for (const s of [-1, 1]) plants.palms.push(new THREE.Vector3(m.x + s * (w / 2 + 2.5), 0.1, m.z));
}

/** The museum tram of Barranco on its rails along Av. Pedro de Osma: varnished wooden car with a clerestory roof. */
function tram(b: Builder, def: BarrancoDef): void {
  const av = def.avenues.find((a) => a.z > -150 && a.z < -60) ?? def.avenues[0], z = av.z + 1.4, x = def.tram.x;
  for (const s of [-0.72, 0.72]) b.box('steelDark', [200, 0.04, 0.08], new THREE.Vector3(x, 0.03, z + s), Q, false);
  const L = 12, W = 2.5;
  b.box('tramWood', [L, 1.3, W], new THREE.Vector3(x, 1.25, z), Q);
  b.box('awningRed', [L, 0.14, W + 0.02], new THREE.Vector3(x, 1.25, z), Q, false);
  for (let i = 0; i < 9; i++) for (const s of [-1, 1]) b.box('trimWhite', [0.12, 1.2, 0.08], new THREE.Vector3(x - L / 2 + 0.6 + i * ((L - 1.2) / 8), 2.5, z + s * W / 2), Q, false);
  for (const s of [-1, 1]) b.box('glass', [L - 0.4, 1.1, 0.04], new THREE.Vector3(x, 2.5, z + s * (W / 2 - 0.05)), Q, false);
  b.box('tramWood', [L + 0.4, 0.18, W + 0.3], new THREE.Vector3(x, 3.2, z), Q);
  b.box('tramWood', [L - 2, 0.5, 1.2], new THREE.Vector3(x, 3.5, z), Q, false);
  b.box('steelDark', [L - 1, 0.5, W - 0.4], new THREE.Vector3(x, 0.45, z), Q, false);
  b.box('steelDark', [0.06, 2.4, 0.06], new THREE.Vector3(x, 4.8, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.6), false);
  b.box('none', [L, 3.4, W], new THREE.Vector3(x, 1.9, z), Q, true);
}

/** The district's landmarks around the bridge and the park. */
export function buildLandmarks(b: Builder, hf: Heightfield, def: BarrancoDef, plants: Plants, rand: () => number): void {
  ermita(b, def.ermita);
  church(b, def.church);
  library(b, def.library);
  park(b, hf, def, plants, rand);
  mirador(b, def.mirador, plants);
  tram(b, def);
}
