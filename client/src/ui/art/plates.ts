import { Cast, Stage } from './stage';
import { SCENES } from './scenes';

const BASE = `${import.meta.env.BASE_URL}assets/`;
/** Manifest `art` keys for the 3D fallback scenes, in order (chapter 1). */
const KEYS = ['general', 'tanks', 'detentions', 'voices', 'barrio'];

/** Decoded art kept alive so showing a plate never stalls on decoding. */
const decoded: HTMLImageElement[] = [];

/**
 * Prologue plates: hand-made art listed in the manifest (`art.general`, `art.tanks`, …) replaces its scene and is delivered at once,
 * the rest are rendered one by one off-screen, then the renderer is freed.
 */
export async function renderPlates(onPlate: (i: number, url: string) => void, keys = KEYS): Promise<void> {
  const manifest = await (await fetch(`${BASE}manifest.json`, { cache: 'no-cache' })).json();
  const art: Record<string, string> = manifest.art ?? {};
  await Promise.all(keys.map(async (k, i) => {
    if (!art[k]) return;
    const url = `${BASE}${art[k]}?v=${manifest.version ?? 0}`, img = new Image();
    img.src = url;
    await img.decode().catch(() => {});
    decoded.push(img);
    onPlate(i, url);
  }));
  if (keys !== KEYS || KEYS.every((k) => art[k])) return;
  const cast = new Cast();
  await cast.load();
  const stage = new Stage();
  try {
    for (const [i, make] of SCENES.entries()) {
      if (art[KEYS[i]]) continue;
      const shot = make(cast);
      onPlate(i, stage.shoot(shot.scene, shot.camera, shot.grade, shot.sketch));
      await new Promise((r) => setTimeout(r, 30));
    }
  } finally {
    stage.dispose();
  }
}
