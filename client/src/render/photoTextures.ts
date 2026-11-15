import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import type { PbrSet } from './textures';
import { ver } from '../core/assetVersion';

const BASE = `${import.meta.env.BASE_URL}assets/`;
const sets = new Map<string, PbrSet>();
let env: { texture: THREE.DataTexture; gain: number } | null = null;

type Entry = { map: string; normal: string; rough?: string };
const listed = new Map<string, Entry>(), pending: Promise<unknown>[] = [];
/** Sets read as pixels while the level is built (canvas drawing), loaded up front. */
const EAGER = ['stucco'];

/**
 * Reads the photographic texture sets listed under `textures` in the manifest. Only `EAGER` ones download now; the
 * rest download the first time a level asks for them with `photo(key)` — a chapter only fetches what it uses —
 * and `photosLoaded()` waits for those before the first frame. Missing ones fall back to procedural.
 */
export async function loadPhotoTextures(): Promise<void> {
  try {
    const manifest = (await (await fetch(`${BASE}manifest.json`, { cache: 'no-cache' })).json()) as { version?: number; textures?: Record<string, Entry>; environment?: { file: string; gain: number } };
    const e = manifest.environment;
    const hdr = e ? new RGBELoader().setDataType(THREE.FloatType).loadAsync(`${BASE}${e.file}?v=${ver(e.file)}`).then((texture) => (env = { texture, gain: e.gain })).catch(() => null) : null;
    for (const [key, t] of Object.entries(manifest.textures ?? {})) listed.set(key, t);
    for (const key of EAGER) photo(key);
    await Promise.all([hdr, photosLoaded()]);
  } catch (e) {
    console.warn('photo textures unavailable', e);
  }
}

/** Resolves once every texture asked for so far has downloaded (or failed). */
export async function photosLoaded(): Promise<void> {
  while (pending.length) await Promise.all(pending.splice(0));
}

export function photo(key: string): PbrSet | undefined {
  const have = sets.get(key), t = listed.get(key);
  if (have || !t) return have;
  const loader = new THREE.TextureLoader();
  const one = (f?: string) => {
    if (!f) return undefined;
    let done = () => {};
    pending.push(new Promise<void>((ok) => (done = ok)));
    const x = loader.load(`${BASE}${f}?v=${ver(f)}`, () => done(), undefined, () => done());
    x.wrapS = x.wrapT = THREE.RepeatWrapping;
    x.anisotropy = 8;
    return x;
  };
  const set: PbrSet = { map: one(t.map)!, normalMap: one(t.normal)!, roughnessMap: one(t.rough) };
  set.map.colorSpace = THREE.SRGBColorSpace;
  sets.set(key, set);
  return set;
}

/** The photographed roughness that goes with a photo colour map, if any. */
export function roughFor(map: THREE.Texture | null): THREE.Texture | undefined {
  if (map) for (const s of sets.values()) if (s.map === map) return s.roughnessMap;
}

/** The photographed environment for reflections, if the manifest lists one and it loaded. */
export function photoEnvironment(): { texture: THREE.DataTexture; gain: number } | null {
  return env;
}
