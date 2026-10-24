import { Typewriter } from './typewriter';
import { IntroMusic } from '../audio/introMusic';
import { defeatFanfare } from '../audio/fanfare';

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
  defeatFanfare();
  document.exitPointerLock();
  const keys = new IntroMusic();
  if (!reason) return void setTimeout(() => button.classList.add('on'), 1200);
  setTimeout(() => new Typewriter(el!.querySelector('p')!, reason, (ch) => keys.key(ch === ' '), () => button.classList.add('on')), 1500);
}
