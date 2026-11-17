import sigs from 'virtual:level-sigs';
import { ver } from '../core/assetVersion';

/**
 * The street plan pre-rendered by `scripts/minimaps.mjs` (`manifest.minimaps[id]` = { file, sig }), used only when
 * its signature matches the current world code + chapter JSON; otherwise the minimap renders it live (slow).
 */
export async function cachedMinimap(id: string): Promise<HTMLImageElement | null> {
  if (location.search.includes('livemap')) return null;
  const base = `${import.meta.env.BASE_URL}assets/`;
  const manifest = await fetch(`${base}manifest.json`, { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
  const entry = manifest?.minimaps?.[id] as { file: string; sig: string } | undefined;
  if (!entry || entry.sig !== sigs[id]) return null;
  const img = new Image();
  img.src = `${base}${entry.file}?v=${ver(entry.file)}`;
  return img.decode().then(() => img).catch(() => null);
}
