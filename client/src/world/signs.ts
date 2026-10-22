import * as THREE from 'three';
import { signTexture } from '../render/urbanTextures';
import signData from '../data/signs.json';
import { concert, chicha, menu, curfew, flag, emblem, poster } from './signArt';
import { brand } from './brandArt';

export type SignKind = 'shop' | 'graffiti' | 'poster' | 'hill' | 'concert' | 'emblem' | 'red' | 'station' | 'stencil' | 'flag' | 'menu' | 'curfew' | 'chicha' | 'brand';

export interface SignDef { text: string; kind: SignKind; bg: string | null; fg: string; sub?: string; accent?: string; food?: boolean; left?: boolean; style?: string; shape?: string; font?: string }

const SIGNS = signData as SignDef[];

const COLS = 4, ROWS = 32, CW = 512, CH = 128, PAD = 8;

function render(d: SignDef): HTMLCanvasElement {
  if (d.style) return brand(d, CW, CH);
  return d.kind === 'poster' || d.kind === 'red' ? poster(d, 512, 128) : d.kind === 'concert' ? concert(d, 512, 128) : d.kind === 'emblem' || d.kind === 'stencil' ? emblem(d, 512, 128) : d.kind === 'flag' ? flag(d, 512, 128) : d.kind === 'menu' ? menu(d, 512, 128) : d.kind === 'chicha' ? chicha(d, 512, 128) : d.kind === 'curfew' ? curfew(d, 512, 128) : signTexture(d.text, d.bg, d.fg, 512, 128);
}

/**
 * One atlas (4 columns of 4:1 cells) for every sign, mural and poster so they merge into a single draw call.
 * Each cell keeps an empty margin so distant mip levels never blend in the neighbouring sign.
 */
export class SignAtlas {
  readonly texture: THREE.CanvasTexture;
  private geos: THREE.BufferGeometry[] = [];

  constructor() {
    const c = document.createElement('canvas');
    c.width = CW * COLS;
    c.height = CH * ROWS;
    const ctx = c.getContext('2d')!;
    SIGNS.forEach((d, i) => ctx.drawImage(render(d), (i % COLS) * CW + PAD, Math.floor(i / COLS) * CH + PAD, CW - 2 * PAD, CH - 2 * PAD));
    this.texture = new THREE.CanvasTexture(c);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
  }

  private quiet: { x: number; z: number; r: number }[] = [];

  /** No hammer and sickle, red flags or leftist posters within `r` of (x, z): red posters become regime propaganda there. */
  quietZone(x: number, z: number, r: number): void {
    this.quiet.push({ x, z, r });
  }

  /** Names of the look-alike brand signs (the ones with a graphic `style`). */
  get brands(): string[] {
    return SIGNS.filter((d) => d.style).map((d) => d.text);
  }

  /** `only` forces a specific sign by name (brand quota). */
  add(pos: THREE.Vector3, q: THREE.Quaternion, w: number, kind: SignKind, rand: () => number, only?: string): SignDef {
    const hush = this.quiet.some((z) => Math.hypot(pos.x - z.x, pos.z - z.z) < z.r);
    if (hush && (kind === 'stencil' || kind === 'flag' || kind === 'emblem')) return SIGNS.find((d) => d.kind === kind)!;
    if (hush && kind === 'red') kind = 'poster';
    const pool = SIGNS.map((s, i) => [s, i] as const).filter(([s]) => (only ? s.text === only : s.kind === kind && !(hush && s.left)));
    const [, i] = pool[Math.floor(rand() * pool.length)];
    const g = new THREE.PlaneGeometry(w, w / 4);
    const W = CW * COLS, H = CH * ROWS, x0 = (i % COLS) * CW + PAD, y0 = Math.floor(i / COLS) * CH + PAD;
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, (x0 + uv.getX(k) * (CW - 2 * PAD)) / W, 1 - (y0 + (1 - uv.getY(k)) * (CH - 2 * PAD)) / H);
    g.applyMatrix4(new THREE.Matrix4().compose(pos, q, new THREE.Vector3(1, 1, 1)));
    this.geos.push(g);
    return SIGNS[i];
  }

  get geometries(): THREE.BufferGeometry[] {
    return this.geos;
  }
}
