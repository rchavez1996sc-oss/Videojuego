/** One drop of reinforcements: when (s), how many, through which gate, by pickup or on foot. */
export interface Drop { t: number; size: number; gate: number; truck: boolean }

/**
 * Reinforcement schedule: `waves[m]` police arrive all at once at the start of minute m, split between two gates
 * (or, now and then, all through one) — whether or not the last ones are dead, leaving the rest of the minute to
 * fight them and loot the bodies. Of a gate's group of 6 or more, 4 come by pickup.
 */
export function schedule(waves: number[], gates: number, rand: () => number): Drop[] {
  const out: Drop[] = [];
  waves.forEach((n, m) => {
    const t = m * 60 + 2, first = Math.floor(rand() * gates), one = gates < 2 || rand() < 0.3;
    const half = one ? n : Math.round(n / 2 + (rand() - 0.5) * 2);
    const groups: [number, number][] = one ? [[first, n]] : [[first, half], [(first + 1) % gates, n - half]];
    for (const [gate, size] of groups) {
      if (size >= 6) out.push({ t, size: 4, gate, truck: true });
      out.push({ t, size: size >= 6 ? size - 4 : size, gate, truck: false });
    }
  });
  return out.sort((a, b) => a.t - b.t);
}
