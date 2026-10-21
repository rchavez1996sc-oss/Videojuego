import * as THREE from 'three';
import { signTexture } from '../render/urbanTextures';
import signData from '../data/signs.json';
import { concert, chicha, menu, curfew, flag, emblem, poster } from './signArt';

export type SignKind = 'shop' | 'graffiti' | 'poster' | 'hill' | 'concert' | 'emblem' | 'red' | 'station' | 'stencil' | 'flag' | 'menu' | 'curfew' | 'chicha';

export interface SignDef { text: string; kind: SignKind; bg: string | null; fg: string; sub?: string; accent?: string; food?: boolean; left?: boolean }

const SIGNS = signData as SignDef[];

/** One 4:1-cell atlas for every sign, mural and poster so they merge into a single draw call. */
export class SignAtlas {
  readonly texture: THREE.CanvasTexture;
  private geos: THREE.BufferGeometry[] = [];
  private static ROWS = 32;

  constructor() {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 128 * SignAtlas.ROWS;
    const ctx = c.getContext('2d')!;
    SIGNS.forEach((d, i) => {
      const img = d.kind === 'poster' || d.kind === 'red' ? poster(d, 512, 128) : d.kind === 'concert' ? concert(d, 512, 128) : d.kind === 'emblem' || d.kind === 'stencil' ? emblem(d, 512, 128) : d.kind === 'flag' ? flag(d, 512, 128) : d.kind === 'menu' ? menu(d, 512, 128) : d.kind === 'chicha' ? chicha(d, 512, 128) : d.kind === 'curfew' ? curfew(d, 512, 128) : signTexture(d.text, d.bg, d.fg, 512, 128);
      ctx.drawImage(img, (i % 2) * 512, Math.floor(i / 2) * 128);
    });
    this.texture = new THREE.CanvasTexture(c);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
  }

  private quiet: { x: number; z: number; r: number }[] = [];

  /** No hammer and sickle, red flags or leftist posters within `r` of (x, z): red posters become regime propaganda there. */
  quietZone(x: number, z: number, r: number): void {
    this.quiet.push({ x, z, r });
  }

  add(pos: THREE.Vector3, q: THREE.Quaternion, w: number, kind: SignKind, rand: () => number): SignDef {
    const hush = this.quiet.some((z) => Math.hypot(pos.x - z.x, pos.z - z.z) < z.r);
    if (hush && (kind === 'stencil' || kind === 'flag' || kind === 'emblem')) return SIGNS.find((d) => d.kind === kind)!;
    if (hush && kind === 'red') kind = 'poster';
    const pool = SIGNS.map((s, i) => [s, i] as const).filter(([s]) => s.kind === kind && !(hush && s.left));
    const [, i] = pool[Math.floor(rand() * pool.length)];
    const g = new THREE.PlaneGeometry(w, w / 4);
    const u0 = (i % 2) * 0.5, v0 = 1 - (Math.floor(i / 2) + 1) / SignAtlas.ROWS;
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) * 0.5, v0 + uv.getY(k) / SignAtlas.ROWS);
    g.applyMatrix4(new THREE.Matrix4().compose(pos, q, new THREE.Vector3(1, 1, 1)));
    this.geos.push(g);
    return SIGNS[i];
  }

  get geometries(): THREE.BufferGeometry[] {
    return this.geos;
  }
}
