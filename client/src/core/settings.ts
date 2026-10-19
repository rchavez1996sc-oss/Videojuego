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
  low: { pixelRatio: 0.75, shadowMapSize: 1024, cascades: 2, shadowFar: 160, grassBlades: 20000, ao: false },
  medium: { pixelRatio: 1, shadowMapSize: 2048, cascades: 3, shadowFar: 260, grassBlades: 40000, ao: true },
  high: { pixelRatio: 1, shadowMapSize: 2048, cascades: 4, shadowFar: 380, grassBlades: 60000, ao: true },
  ultra: { pixelRatio: Math.min(window.devicePixelRatio, 2), shadowMapSize: 4096, cascades: 4, shadowFar: 500, grassBlades: 100000, ao: true },
};

const params = new URLSearchParams(location.search);
export const quality: Quality = (params.get('q') as Quality) ?? 'high';
export const preset = PRESETS[quality] ?? PRESETS.high;
export const shotMode = params.has('shot');
