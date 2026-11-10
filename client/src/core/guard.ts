/**
 * Keeps the game loop alive: three's animation loop stops for good if one frame throws, which froze matches.
 * Errors are logged (with the frame they happened in) and the next frame runs normally.
 */
export function guardFrame(step: () => void, onError?: (count: number, err: unknown) => void): () => void {
  let count = 0, lastLog = -1e9;
  return () => {
    try {
      step();
    } catch (err) {
      count++;
      const now = performance.now();
      if (now - lastLog > 2000) {
        lastLog = now;
        console.error(`[frame error #${count}]`, err);
      }
      lastError.text = (err instanceof Error ? err.message : String(err)).slice(0, 90);
      onError?.(count, err);
    }
  };
}

const seen = new Map<string, number>();

/** Runs one system's step; if it throws, logs it (at most every 2 s per label), remembers the message and returns `fallback`. */
export function safely<T>(label: string, step: () => T, fallback: T): T {
  try {
    return step();
  } catch (err) {
    const now = performance.now();
    if (now - (seen.get(label) ?? -1e9) > 2000) {
      seen.set(label, now);
      console.error(`[${label}]`, err);
    }
    lastError.text = `${label}: ${err instanceof Error ? err.message : String(err)}`.slice(0, 90);
    return fallback;
  }
}

export const lastError = { text: '' };
