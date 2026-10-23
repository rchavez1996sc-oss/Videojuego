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
export const quality: Quality = (params.get('q') as Quality) ?? stored() ?? (integrated ? 'medium' : 'high');

/** Remembers the chosen quality and reloads, since presets size render targets and geometry at startup. */
export function setQuality(q: Quality): void {
  try {
    localStorage.setItem('tq-quality', q);
  } catch { /* private mode: the URL still carries it */ }
  const url = new URL(location.href);
  url.searchParams.set('q', q);
  location.href = url.toString();
}
export const preset = PRESETS[quality] ?? PRESETS.high;
export const shotMode = params.has('shot');

/** Chapter reached in a previous session (set when one is completed). */
export function savedChapter(): string | null {
  try {
    return localStorage.getItem('tq-chapter');
  } catch {
    return null;
  }
}
