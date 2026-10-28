/** One drop of reinforcements: when (s), how many, through which gate, by pickup or on foot. */
export interface Drop { t: number; size: number; gate: number; truck: boolean }

/**
 * Reinforcement schedule: `waves[m]` police arrive during minute m, in squads of 2–4 spread over the minute
 * (a 4-man squad comes by pickup), each through a random gate — whether or not the last ones are dead.
 */
export function schedule(waves: number[], gates: number, rand: () => number): Drop[] {
  const out: Drop[] = [];
  waves.forEach((n, m) => {
    const sizes: number[] = [];
    while (n > 0) {
      const s = Math.min(n, rand() < 0.5 ? 4 : 2 + Math.floor(rand() * 2));
      sizes.push(s);
      n -= s;
    }
    sizes.forEach((size, k) => out.push({ t: m * 60 + 2 + (k / sizes.length) * 54 + rand() * 4, size, gate: Math.floor(rand() * gates), truck: size >= 4 }));
  });
  return out.sort((a, b) => a.t - b.t);
}
