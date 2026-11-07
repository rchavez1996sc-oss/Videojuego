/** Reference ground speed (m/s) of each locomotion clip, to keep feet from sliding. */
const PACE: Record<string, number> = { walk: 1.5, run: 3.7, sprint: 5.8, crouch: 1.2, civ_walk: 1.4, civ_run: 3.9, m_walk: 1.45, m_run: 3.8, f_walk: 1.35, f_run: 3.6 };
const DIR8 = ['f', 'fr', 'r', 'br', 'b', 'bl', 'l', 'fl'];
const DIR4 = ['f', 'r', 'b', 'l'];

export interface GaitState { armed: boolean; airborne: boolean; aiming: boolean; idle: string; was: string; steps?: [string, string] }

/** Leg clip and its rate from body-frame velocity; the current clip `was` gets hysteresis so jitter cannot flip it. */
export function chooseGait(r: GaitState, speed: number, crouch: number, fwd: number, side: number): [string, number] {
  if (!r.armed) {
    if (speed < 0.3) return [r.idle, 1];
    const [walk, run] = r.steps ?? ['civ_walk', 'civ_run'];
    return speed < 2.6 ? [walk, speed / PACE[walk]] : [run, speed / PACE[run]];
  }
  if (r.airborne) return ['jump', 1];
  const ang = (Math.atan2(side, fwd) + Math.PI * 2) % (Math.PI * 2);
  if (crouch > 0.5) return speed < 0.3 ? ['crouch_idle', 1] : [`crouch_${DIR4[Math.round(ang / (Math.PI / 2)) % 4]}`, speed / PACE.crouch];
  if (speed < 0.3) return ['idle', 1];
  const was = r.was, sprinting = was === 'sprint';
  if (!r.aiming && (sprinting ? speed > 4.4 && fwd > speed * 0.6 : speed > 5 && fwd > speed * 0.8)) return ['sprint', speed / PACE.sprint];
  const prev = DIR8.indexOf(was.split('_')[1] ?? ''), off = prev < 0 ? Math.PI : Math.abs(Math.atan2(Math.sin(ang - prev * (Math.PI / 4)), Math.cos(ang - prev * (Math.PI / 4))));
  const dir = off < Math.PI / 6 ? DIR8[prev] : DIR8[Math.round(ang / (Math.PI / 4)) % 8];
  const running = was.startsWith('run_') || sprinting ? speed > 2.4 : speed > 2.8;
  return running ? [`run_${dir}`, speed / PACE.run] : [`walk_${dir}`, speed / PACE.walk];
}

/** Unarmed walk/run and idle clips: the women's or one of two men's locomotion sets, so a crowd does not move in step. */
export function civilianGait(woman: boolean, has: (k: string) => boolean): { steps: [string, string]; idle: string } {
  const steps: [string, string] = woman && has('f_walk') ? ['f_walk', 'f_run'] : Math.random() < 0.5 && has('m_walk') ? ['m_walk', 'm_run'] : ['civ_walk', 'civ_run'];
  const idles = ['civ_idle', 'texting', 'look_around', woman ? 'f_idle' : 'm_idle'].filter(has);
  return { steps, idle: idles[Math.floor(Math.random() * idles.length)] ?? 'civ_stand' };
}
