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
      onError?.(count, err);
    }
  };
}
