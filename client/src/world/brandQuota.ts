/** Each look-alike brand `copies` times in shuffled order; returns the next one to place, or undefined when spent. */
export function brandQuota(names: string[], copies: number, rand: () => number): () => string | undefined {
  const left = names.flatMap((n) => Array<string>(copies).fill(n));
  for (let i = left.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [left[i], left[j]] = [left[j], left[i]];
  }
  return () => left.pop();
}
