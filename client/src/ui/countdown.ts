/** True while the mission-start countdown runs; the game loop renders but does not simulate. */
export let counting = false;

/** Big 3 · 2 · 1 · ¡A LA MISIÓN! with a short beep per step (a higher one at the end), shown once when play first starts. */
export function startCountdown(onDone: () => void): void {
  counting = true;
  const el = document.createElement('div');
  el.id = 'countdown';
  document.body.appendChild(el);
  let ctx: AudioContext | null = null;
  try {
    ctx = new AudioContext();
  } catch { /* no audio */ }
  const beep = (f: number, len: number) => {
    if (!ctx) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + len + 0.02);
  };
  const steps = ['3', '2', '1', '¡A LA MISIÓN!'];
  steps.forEach((s, i) => setTimeout(() => {
    el.textContent = s;
    el.className = i === steps.length - 1 ? 'go' : '';
    void el.offsetWidth;
    el.classList.add('pop');
    beep(i === steps.length - 1 ? 1320 : 660, i === steps.length - 1 ? 0.5 : 0.18);
    if (i === steps.length - 1) {
      counting = false;
      onDone();
      setTimeout(() => (el.remove(), ctx?.close()), 900);
    }
  }, i * 1000));
}
