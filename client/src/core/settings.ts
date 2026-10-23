export type Quality = 'low' | 'medium' | 'high' | 'ultra';

export interface QualityPreset {
  pixelRatio: number;
  shadowMapSize: number;
  cascades: number;
  shadowFar: number;
  grassBlades: number;
  ao: boolean;
}

export const PRESETS: Record<Quality, QualityPreset> = {
  low: { pixelRatio: 1, shadowMapSize: 1024, cascades: 2, shadowFar: 140, grassBlades: 22000, ao: false },
  medium: { pixelRatio: 1, shadowMapSize: 2048, cascades: 2, shadowFar: 150, grassBlades: 24000, ao: true },
  high: { pixelRatio: 1, shadowMapSize: 3072, cascades: 2, shadowFar: 190, grassBlades: 28000, ao: true },
  ultra: { pixelRatio: Math.min(window.devicePixelRatio, 2), shadowMapSize: 4096, cascades: 4, shadowFar: 500, grassBlades: 100000, ao: true },
};

function detectGpu(): string {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    const dbg = gl?.getExtension('WEBGL_debug_renderer_info');
    return String(gl && dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER) ?? '');
  } catch {
    return '';
  }
}

export const gpuName = detectGpu();
const integrated = /intel|uhd|iris|basic render|swiftshader|llvmpipe|mali|adreno|powervr/i.test(gpuName) && !/arc/i.test(gpuName);
const params = new URLSearchParams(location.search);
function stored(): Quality | null {
  try {
    return localStorage.getItem('tq-quality') as Quality | null;
  } catch {
    return null;
  }
}
export let quality: Quality = (params.get('q') as Quality) ?? stored() ?? (integrated ? 'medium' : 'high');

export const preset: QualityPreset = { ...(PRESETS[quality] ?? PRESETS.high) };
const listeners: (() => void)[] = [];

/** Runs `fn` whenever the quality changes mid-game (shadow maps, AO, grass density adapt without a restart). */
export function onQuality(fn: () => void): void {
  listeners.push(fn);
}

/** Switches the preset in place and remembers it; systems already built adapt through `onQuality`. */
export function chooseQuality(q: Quality): void {
  if (q === quality) return;
  quality = q;
  Object.assign(preset, PRESETS[q]);
  try {
    localStorage.setItem('tq-quality', q);
  } catch { /* private mode */ }
  const url = new URL(location.href);
  if (url.searchParams.has('q')) {
    url.searchParams.set('q', q);
    history.replaceState(null, '', url);
  }
  for (const fn of listeners) fn();
}
export const shotMode = params.has('shot');

/** Chapter reached in a previous session (set when one is completed). */
export function savedChapter(): string | null {
  try {
    return localStorage.getItem('tq-chapter');
  } catch {
    return null;
  }
}
