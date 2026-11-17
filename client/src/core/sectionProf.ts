/** Per-section frame timing (total, max, count of frames > 4 ms) for `__game.sections()`; cheap enough to stay on. */
const rows = new Map<string, [number, number, number, number]>();

export function sec<T>(name: string, run: () => T): T {
  const t0 = performance.now(), out = run(), ms = performance.now() - t0;
  const r = rows.get(name) ?? [0, 0, 0, 0];
  [r[0], r[1], r[2], r[3]] = [r[0] + ms, Math.max(r[1], ms), r[2] + (ms > 4 ? 1 : 0), r[3] + 1];
  rows.set(name, r);
  return out;
}

export function sections(reset = true): string {
  const out = [...rows].sort((a, b) => b[1][0] - a[1][0]).map(([k, [tot, max, slow, n]]) => `${k.padEnd(14)} avg ${(tot / n).toFixed(2)} max ${max.toFixed(1)} >4ms ${slow}`).join('\n');
  if (reset) rows.clear();
  return out;
}
