/**
 * Objective-complete beat before the results screen: a warm flash, the "OBJETIVO CUMPLIDO" stamp slamming in with a
 * sweeping light and a short rising brass-like chord. Calls `then` once it settles.
 */
export function celebrate(title: string, then: () => void): void {
  const el = document.createElement('div');
  el.id = 'obj-done';
  el.innerHTML = `<div class="flash"></div><div class="stamp"><small>OBJETIVO CUMPLIDO</small><b>${title}</b><i></i></div>`;
  document.body.appendChild(el);
  try {
    const ctx = new AudioContext(), t = ctx.currentTime, out = ctx.createGain();
    out.gain.value = 0.22;
    out.connect(ctx.destination);
    [[261.6, 0], [329.6, 0.08], [392, 0.16], [523.3, 0.32]].forEach(([f, d]) => {
      for (const det of [-4, 4]) {
        const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.detune.value = det;
        lp.frequency.value = 1800;
        g.gain.setValueAtTime(0.0001, t + d);
        g.gain.exponentialRampToValueAtTime(0.5, t + d + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d + 2.2);
        o.connect(lp).connect(g).connect(out);
        o.start(t + d);
        o.stop(t + d + 2.3);
      }
    });
    const boom = ctx.createOscillator(), bg = ctx.createGain();
    boom.frequency.setValueAtTime(90, t);
    boom.frequency.exponentialRampToValueAtTime(40, t + 0.6);
    bg.gain.setValueAtTime(0.9, t);
    bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    boom.connect(bg).connect(out);
    boom.start(t);
    boom.stop(t + 0.9);
    setTimeout(() => ctx.close(), 3000);
  } catch { /* no audio */ }
  requestAnimationFrame(() => el.classList.add('on'));
  setTimeout(() => {
    el.classList.add('out');
    then();
    setTimeout(() => el.remove(), 800);
  }, 2600);
}
