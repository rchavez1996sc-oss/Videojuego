import { Typewriter } from './typewriter';
import { IntroMusic } from '../audio/introMusic';

/** Full-screen mission failure: the reason is typed out like the prologue, then the retry button appears. */
export function showMissionFailed(reason: string): void {
  let el = document.getElementById('fail');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fail';
    document.body.appendChild(el);
  }
  el.innerHTML = `<h2>MISIÓN FALLIDA</h2><p></p><button>REINTENTAR</button>`;
  const button = el.querySelector('button')!;
  button.addEventListener('click', () => location.reload());
  el.classList.add('on');
  document.exitPointerLock();
  const keys = new IntroMusic();
  setTimeout(() => new Typewriter(el!.querySelector('p')!, reason, (ch) => keys.key(ch === ' '), () => button.classList.add('on')), 900);
}
