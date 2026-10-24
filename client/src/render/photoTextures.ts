import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import type { PbrSet } from './textures';

const BASE = `${import.meta.env.BASE_URL}assets/`;
const sets = new Map<string, PbrSet>();
let env: { texture: THREE.DataTexture; gain: number } | null = null;

/** Loads the photographic texture sets listed under `textures` in the manifest; missing ones fall back to procedural. */
export async function loadPhotoTextures(): Promise<void> {
  try {
    const manifest = (await (await fetch(`${BASE}manifest.json`, { cache: 'no-cache' })).json()) as { version?: number; textures?: Record<string, { map: string; normal: string; rough?: string }>; environment?: { file: string; gain: number } };
    const loader = new THREE.TextureLoader(), v = manifest.version ?? 0, e = manifest.environment;
    const hdr = e ? new RGBELoader().setDataType(THREE.FloatType).loadAsync(`${BASE}${e.file}?v=${v}`).then((texture) => (env = { texture, gain: e.gain })).catch(() => null) : null;
    await Promise.all(Object.entries(manifest.textures ?? {}).map(async ([key, t]) => {
      const [map, normalMap, roughnessMap] = await Promise.all([t.map, t.normal, t.rough].map((f) => (f ? loader.loadAsync(`${BASE}${f}?v=${v}`) : Promise.resolve(undefined))));
      map!.colorSpace = THREE.SRGBColorSpace;
      for (const x of [map, normalMap, roughnessMap]) {
        if (!x) continue;
        x.wrapS = x.wrapT = THREE.RepeatWrapping;
        x.anisotropy = 8;
      }
      sets.set(key, { map: map!, normalMap: normalMap!, roughnessMap });
    }));
    await hdr;
  } catch (e) {
    console.warn('photo textures unavailable', e);
  }
}

export function photo(key: string): PbrSet | undefined {
  return sets.get(key);
}

/** The photographed roughness that goes with a photo colour map, if any. */
export function roughFor(map: THREE.Texture | null): THREE.Texture | undefined {
  if (map) for (const s of sets.values()) if (s.map === map) return s.roughnessMap;
}

/** The photographed environment for reflections, if the manifest lists one and it loaded. */
export function photoEnvironment(): { texture: THREE.DataTexture; gain: number } | null {
  return env;
}
