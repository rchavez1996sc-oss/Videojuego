import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import { framer, yawQ, type CampusBuilding } from './layout';

export const FLOOR = 3.6;
const SPANDREL = 1.0, GLASS = 1.7, BAY = 3;
export const WALLS: Record<string, string> = { cream: 'uniCream', grey: 'uniGrey', white: 'uniWhite', yellow: 'uniYellow', stone: 'uniStone', sand: 'uniSand', taupe: 'uniTaupe', ochre: 'uniOchre' };

/** Where a building's name goes: centre of the lettering, facing, width, colours. */
export interface NameSign { pos: THREE.Vector3; q: THREE.Quaternion; w: number; text: string; ink: string; plate?: string; font?: 'serif' | 'sans' }

type At = (x: number, y: number, z: number) => THREE.Vector3;
/**
 * Facade treatment: `band` dark glass curtain on the upper floors over a light clerestory base (Química);
 * `frame` window bands behind spandrels with a concrete column grid (Geológica, Matemáticas); `punched` plain
 * walls with separate windows; `panels` like frame with coloured panes mixed in (Físicas); `grid` deep concrete egg-crate
 * of slabs and fins over recessed glass (Industrial, old wing); `bio` steel curtain grid with coloured panes and louvres on
 * the long faces, blind travertine ends (Biológicas); `framed` punched windows in proud white frames (Biológicas annex).
 */
interface Skin { kind: NonNullable<CampusBuilding['skin']>; wall: string; spandrel: string; base: string }

function skinOf(def: CampusBuilding): Skin {
  const wall = WALLS[def.color] ?? 'uniGrey';
  return { kind: def.skin ?? 'frame', wall, spandrel: def.spandrel ? `uni${def.spandrel[0].toUpperCase()}${def.spandrel.slice(1)}` : wall, base: def.base ? WALLS[def.base] : wall };
}

/** One wing (local box cx, cz, w × d): solid core plus the skin on all four faces, roof slab, parapet, rooftop kit. */
function wing(b: Builder, at: At, q: THREE.Quaternion, cx: number, cz: number, w: number, d: number, floors: number, sk: Skin, rand: () => number): void {
  const H = floors * FLOOR, box = (mat: string, size: [number, number, number], x: number, y: number, z: number, collide = false) => b.box(mat, size, at(cx + x, y, cz + z), q, collide);
  box(sk.wall, [w - 0.3, H, d - 0.3], 0, H / 2, 0, true);
  const face = (len: number, along: 'x' | 'z', s: number) => {
    const n = Math.max(1, Math.round(len / BAY)), bay = len / n, out = (along === 'x' ? d : w) / 2;
    const put = (mat: string, l: number, h: number, depth: number, u: number, y: number, o: number) =>
      along === 'x' ? box(mat, [l, h, depth], u, y, s * (out - 0.15 + o)) : box(mat, [depth, h, l], s * (out - 0.15 + o), y, u);
    for (let f = 0; f < floors; f++) {
      const y0 = f * FLOOR;
      if (sk.kind === 'grid') {
        put(rand() < 0.15 ? 'curtainRed' : 'winGlass', len - 0.2, FLOOR - 1.0, 0.06, 0, y0 + 0.95 + (FLOOR - 1.0) / 2, 0.02);
        put(sk.wall, len, 0.95, 0.3, 0, y0 + 0.47, 0.12);
        put(sk.wall, len + 0.3, 0.2, 0.9, 0, y0 + FLOOR - 0.1, 0.45);
        for (let i = 0; i <= n; i++) put(sk.wall, 0.2, FLOOR, 0.9, -len / 2 + i * bay, y0 + FLOOR / 2, 0.45);
      } else if (sk.kind === 'bio' && along === 'z') {
        if (f === 0) put('travertine', len + 0.3, H, 0.16, 0, H / 2, 0.08);
      } else if (sk.kind === 'bio') {
        const cols = Math.round(len / 1.5), cw = len / cols;
        put('winGlass', len - 0.1, FLOOR - 0.2, 0.06, 0, y0 + FLOOR / 2, 0.02);
        for (let i = 0; i < cols; i++) {
          const r = rand(), x = -len / 2 + (i + 0.5) * cw;
          if (r < 0.22) put(['paneYellow', 'panePurple', 'paneBlue'][Math.floor(rand() * 3)], cw - 0.12, 0.7, 0.04, x, y0 + 0.5, 0.05);
          else if (r < 0.34) put('alu', cw - 0.12, 1.3, 0.05, x, y0 + FLOOR - 1.0, 0.06);
        }
        for (let i = 0; i <= cols; i++) put('steelGrey', 0.07, FLOOR, 0.14, -len / 2 + i * cw, y0 + FLOOR / 2, 0.08);
        for (const y of [0.9, FLOOR - 0.05]) put('steelGrey', len, 0.08, 0.14, 0, y0 + y, 0.08);
      } else if (sk.kind === 'framed') {
        for (let i = 0; i < n; i++) {
          if (i % 3 === 1) continue;
          const x = -len / 2 + (i + 0.5) * bay, y = y0 + 1.0 + 0.85;
          put('winGlass', bay * 0.62, 1.7, 0.06, x, y, 0.02);
          for (const s of [-1, 1]) put('uniWhite', 0.16, 1.95, 0.3, x + s * (bay * 0.31 + 0.08), y, 0.15);
          for (const s of [-1, 1]) put('uniWhite', bay * 0.62 + 0.32, 0.16, 0.3, x, y + s * 0.93, 0.15);
          put('uniWhite', 0.05, 1.7, 0.08, x, y, 0.05);
          put('uniWhite', bay * 0.62, 0.05, 0.08, x, y + 0.2, 0.05);
        }
      } else if (sk.kind === 'punched') {
        for (let i = 0; i < n; i++) if (rand() < 0.85) put('winGlass', bay * 0.55, GLASS, 0.06, -len / 2 + (i + 0.5) * bay, y0 + SPANDREL + GLASS / 2, 0.02);
      } else if (sk.kind === 'band' && f > 0) {
        put('darkGlass', len - 0.1, FLOOR - 0.3, 0.08, 0, y0 + FLOOR / 2 + 0.05, 0.04);
        for (let i = 1; i < n; i++) put('mullion', 0.05, FLOOR - 0.3, 0.12, -len / 2 + i * bay, y0 + FLOOR / 2 + 0.05, 0.08);
      } else if (sk.kind === 'band') {
        put(sk.base, len, FLOOR - 1.1, 0.3, 0, y0 + (FLOOR - 1.1) / 2, 0.12);
        put('winGlass', len - 0.2, 0.9, 0.06, 0, y0 + FLOOR - 0.55, 0.02);
        for (let i = 1; i < n * 2; i++) put('mullion', 0.06, 0.9, 0.1, -len / 2 + (i * bay) / 2, y0 + FLOOR - 0.55, 0.06);
      } else {
        put('winGlass', len - 0.2, GLASS, 0.06, 0, y0 + SPANDREL + GLASS / 2, 0.02);
        put(f === 0 ? sk.base : sk.spandrel, len, SPANDREL, 0.3, 0, y0 + SPANDREL / 2, 0.12);
        put(sk.wall, len, FLOOR - SPANDREL - GLASS, 0.3, 0, y0 + SPANDREL + GLASS + (FLOOR - SPANDREL - GLASS) / 2, 0.12);
        for (let i = 1; i < n; i++) {
          const pane = sk.kind === 'panels' && rand() < 0.3;
          if (pane) put(rand() < 0.5 ? 'paneBlue' : 'paneYellow', bay - 0.3, GLASS - 0.2, 0.05, -len / 2 + (i - 0.5) * bay, y0 + SPANDREL + GLASS / 2, 0.04);
          put('mullion', 0.06, GLASS, 0.1, -len / 2 + i * bay, y0 + SPANDREL + GLASS / 2, 0.06);
        }
      }
    }
    if (sk.kind === 'frame' || sk.kind === 'panels') for (let i = 0; i <= n; i += 2) put('uniFrame', 0.45, H + 0.4, 0.45, -len / 2 + Math.min(i, n) * bay, H / 2 + 0.2, 0.2);
  };
  for (const s of [-1, 1]) {
    face(w - 0.3, 'x', s);
    face(d - 0.3, 'z', s);
  }
  const cornice = sk.kind === 'band' || sk.kind === 'bio' ? 'uniTerracotta' : sk.kind === 'grid' || sk.kind === 'framed' ? sk.wall : 'uniFrame';
  box('uniFrame', [w + 0.3, 0.45, d + 0.3], 0, H + 0.22, 0);
  if (sk.kind === 'band') for (const s of [-1, 1]) {
    box(cornice, [w + 0.5, 0.5, 0.3], 0, H + 0.2, s * (d / 2 + 0.1));
    box(cornice, [0.3, 0.5, d + 0.5], s * (w / 2 + 0.1), H + 0.2, 0);
  }
  for (const s of [-1, 1]) {
    box(cornice, [w + 0.5, 0.8, 0.2], 0, H + 0.8, s * (d / 2 + 0.15));
    box(cornice, [0.2, 0.8, d + 0.1], s * (w / 2 + 0.15), H + 0.8, 0);
  }
  for (let i = 0; i < Math.max(1, Math.round((w * d) / 250)); i++) {
    const x = (rand() - 0.5) * (w - 4), z = (rand() - 0.5) * (d - 4);
    if (rand() < 0.5) box(rand() < 0.5 ? 'tankBlack' : 'tankBlue', [1.1, 1.3, 1.1], x, H + 1.1, z);
    else box('alu', [1.4, 0.9, 1], x, H + 0.9, z);
  }
}

/** Entrance on the local +z face at x: canopy slab on two posts, dark doors, steps. */
function entrance(b: Builder, at: At, q: THREE.Quaternion, x: number, zFace: number, wide: number): void {
  const box = (mat: string, size: [number, number, number], px: number, y: number, z: number, collide = false) => b.box(mat, size, at(px, y, z), q, collide);
  box('darkGlass', [wide - 1, 2.6, 0.08], x, 1.3, zFace + 0.32);
  box('uniFrame', [wide + 1.2, 0.3, 3.2], x, 3.3, zFace + 1.6);
  for (const s of [-1, 1]) box('uniFrame', [0.3, 3.2, 0.3], x + s * (wide / 2 + 0.3), 1.6, zFace + 2.9, true);
  for (let k = 0; k < 3; k++) box('concrete', [wide + 1.6 - k * 0.4, 0.15 * (k + 1), 2.6 - k * 0.6], x, 0.075 * (k + 1), zFace + 1.3 - k * 0.3, true);
}

/** Red entrance tower standing proud of the +z face (Geológica): its own volume, a doorway and the sign plate. */
function accentTower(b: Builder, at: At, q: THREE.Quaternion, zFace: number, H: number): THREE.Vector3 {
  const w = 9, d = 4, h = H + 1.6;
  b.box('uniRed', [w, h - 3, d], at(0, 3 + (h - 3) / 2, zFace + d / 2 - 0.5), q, true);
  for (const s of [-1, 1]) b.box('uniRed', [1.2, 3, d], at(s * (w / 2 - 0.6), 1.5, zFace + d / 2 - 0.5), q, true);
  b.box('darkGlass', [w - 2.6, 2.7, 0.08], at(0, 1.35, zFace + 0.1), q, false);
  return at(0, h - 3.2, zFace + d - 0.48);
}

/** A campus building by style; returns where its name goes. */
export function pavilion(b: Builder, def: CampusBuilding, rand: () => number): NameSign | null {
  const at = framer(def), q = yawQ(def.yaw), sk = skinOf(def), H = def.floors * FLOOR;
  if (def.style === 'courtyard') {
    const t = Math.min(13, def.d / 3.2), gap = 7, half = (def.w - gap) / 2;
    wing(b, at, q, 0, -def.d / 2 + t / 2, def.w, t, def.floors, sk, rand);
    for (const s of [-1, 1]) wing(b, at, q, s * (def.w / 2 - t / 2), 0, t, def.d - 2 * t, def.floors, sk, rand);
    for (const s of [-1, 1]) wing(b, at, q, s * (gap / 2 + half / 2), def.d / 2 - t / 2, half, t, def.floors, sk, rand);
    b.box('darkGlass', [gap + 0.2, H - FLOOR, t - 0.3], at(0, FLOOR + (H - FLOOR) / 2, def.d / 2 - t / 2), q, true);
    b.box('uniTerracotta', [gap + 0.6, 0.4, t + 0.2], at(0, FLOOR, def.d / 2 - t / 2), q, false);
  } else wing(b, at, q, 0, 0, def.w, def.d, def.floors, sk, rand);
  let tower: THREE.Vector3 | null = null;
  if (def.accent === 'red') tower = accentTower(b, at, q, def.d / 2, H);
  else if (def.style !== 'courtyard') entrance(b, at, q, (rand() - 0.5) * def.w * 0.3, def.d / 2, Math.min(5, def.w * 0.25));
  if (!def.name) return null;
  if (tower) return { pos: tower, q, w: 5.8, text: def.name, ink: '#ffffff' };
  if (sk.kind === 'bio') {
    const west = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2));
    return { pos: at(-def.w / 2 - 0.06, FLOOR * 1.6, 0), q: west, w: Math.min(def.d * 0.62, 9), text: def.name, ink: '#151515', font: 'sans' };
  }
  const band = sk.kind === 'band';
  const y = band ? FLOOR + (FLOOR - 0.3) / 2 : def.style === 'courtyard' ? FLOOR + 0.2 : Math.min(H - 0.6, FLOOR + SPANDREL / 2);
  const z = def.d / 2 + (band ? 0.04 : 0.32);
  return { pos: at(0, y, z), q, w: Math.min(def.w * 0.7, def.name.length * 0.45), text: def.name, ink: band ? '#e6e6e2' : '#1c1c1c' };
}
