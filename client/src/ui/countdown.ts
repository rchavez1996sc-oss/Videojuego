/** True while the mission-start countdown runs; the game loop renders but does not simulate. */
export let counting = false;

/** Big 3 · 2 · 1 with a short beep per number (a higher one on 1), shown once when play first starts. */
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
  ['3', '2', '1'].forEach((n, i) => setTimeout(() => {
    el.textContent = n;
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
    beep(i === 2 ? 880 : 660, 0.18);
  }, i * 1000));
  setTimeout(() => {
    counting = false;
    onDone();
    el.remove();
    ctx?.close();
  }, 3000);
}
