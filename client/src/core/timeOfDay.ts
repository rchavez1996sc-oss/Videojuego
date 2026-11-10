import type { BiomeDef } from '../data/types';
import TIMES from '../data/timeOfDay.json';

export type TimeId = keyof typeof TIMES;
type Preset = { label: string; sunElevation?: number; skyElevation?: number; sunAzimuthShift?: number; sunColor?: string; sunIntensity?: number; ambient?: number; exposure?: number; fogColor?: string; fogMul?: number; turbidity?: number; rayleigh?: number; cloudColor?: string; cloudShade?: string; glow?: number };

export const TIME_LIST = Object.entries(TIMES as Record<TimeId, Preset>).map(([id, p]) => [id as TimeId, p.label] as const);

const stored = (): TimeId | null => {
  try {
    return localStorage.getItem('tq-time') as TimeId | null;
  } catch {
    return null;
  }
};

/** Time of day of this session: `?t=` wins over the stored choice; `?shot` keeps daylight unless asked. */
export let timeOfDay: TimeId = (new URLSearchParams(location.search).get('t') as TimeId) ?? (location.search.includes('shot') ? null : stored()) ?? 'day';
if (!(timeOfDay in TIMES)) timeOfDay = 'day';

export function chooseTime(t: TimeId): void {
  timeOfDay = t;
  try {
    localStorage.setItem('tq-time', t);
  } catch { /* private mode */ }
}

/** How lit the street lamps, shop windows and headlights are (0 by day, 1 at night). */
export const lampGlow = (): number => (TIMES as Record<TimeId, Preset>)[timeOfDay].glow ?? 0;

/** Rewrites the chapter's sky, sun, fog and exposure for the chosen time of day (in place); returns it. */
export function applyTime(b: BiomeDef): BiomeDef {
  const p = (TIMES as Record<TimeId, Preset>)[timeOfDay];
  if (timeOfDay === 'day' || (b as { timeApplied?: boolean }).timeApplied) return b;
  Object.assign(b, {
    sunElevation: p.sunElevation ?? b.sunElevation, sunAzimuth: b.sunAzimuth + (p.sunAzimuthShift ?? 0), sunColor: p.sunColor ?? b.sunColor,
    sunIntensity: p.sunIntensity ?? b.sunIntensity, ambient: p.ambient ?? b.ambient, exposure: p.exposure ?? b.exposure, fogColor: p.fogColor ?? b.fogColor,
    fogDensity: b.fogDensity * (p.fogMul ?? 1), turbidity: p.turbidity ?? b.turbidity, rayleigh: p.rayleigh ?? b.rayleigh, skyElevation: p.skyElevation, timeApplied: true,
  });
  if (b.clouds) b.clouds = { ...b.clouds, color: p.cloudColor ?? b.clouds.color, shade: p.cloudShade ?? b.clouds.shade };
  return b;
}
