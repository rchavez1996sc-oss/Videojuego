import { Typewriter } from './typewriter';
import { IntroMusic } from '../audio/introMusic';

/** A low falling boom and two slow heartbeats: the sound of having lost. */
function doom(): void {
  try {
    const ctx = new AudioContext(), t = ctx.currentTime, out = ctx.createGain();
    out.gain.value = 0.5;
    out.connect(ctx.destination);
    const hit = (at: number, f0: number, f1: number, peak: number, len: number, type: OscillatorType = 'sine') => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t + at);
      o.frequency.exponentialRampToValueAtTime(f1, t + at + len);
      g.gain.setValueAtTime(0.0001, t + at);
      g.gain.exponentialRampToValueAtTime(peak, t + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + at + len);
      o.connect(g).connect(out);
      o.start(t + at);
      o.stop(t + at + len + 0.05);
    };
    hit(0, 110, 38, 1, 1.8);
    hit(0, 165, 55, 0.25, 1.4, 'sawtooth');
    for (const at of [1.1, 1.9]) {
      hit(at, 70, 40, 0.9, 0.18);
      hit(at + 0.16, 60, 35, 0.6, 0.2);
    }
    setTimeout(() => ctx.close(), 3500);
  } catch { /* no audio */ }
}

/** Full-screen mission failure: the world drains to grey under a red veil, the title slams in, then the reason is typed out and the retry button appears. */
export function showMissionFailed(reason: string, title = 'MISIÓN FALLIDA'): void {
  let el = document.getElementById('fail');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fail';
    document.body.appendChild(el);
  }
  el.innerHTML = `<h2>${title}</h2>${reason ? '<p></p>' : ''}<button>INTENTAR DE NUEVO</button>`;
  const button = el.querySelector('button')!;
  button.addEventListener('click', () => location.reload());
  el.classList.add('on');
  document.body.classList.add('ended', 'lost');
  doom();
  document.exitPointerLock();
  const keys = new IntroMusic();
  if (!reason) return void setTimeout(() => button.classList.add('on'), 1200);
  setTimeout(() => new Typewriter(el!.querySelector('p')!, reason, (ch) => keys.key(ch === ' '), () => button.classList.add('on')), 1500);
}
