import { truce } from '../systems/truce';
import { DIFFICULTIES, difficulty, type DifficultyId } from '../core/difficulty';
import { chooseQuality, quality } from '../core/settings';
import { QUALITIES, type ChapterCard } from './launcher';
import { startCountdown } from './countdown';

export interface PauseExtras { chapters: ChapterCard[]; current: string }

/**
 * Start/pause overlay: difficulty, quality (applied live) and chapter switch (asks first: it restarts);
 * clicking anywhere else plays. The overlay hides while the pointer is locked, P pauses, and the first entry opens a 3 s grace period.
 */
export function setupStartMenu(overlay: HTMLElement, status: HTMLElement, canvas: HTMLElement, onPlay: () => void, extras: PauseExtras): void {
  status.textContent = 'CLIC PARA COMENZAR';
  overlay.classList.add('intro');
  document.body.classList.add('paused');
  const box = overlay.querySelector('.difficulty') as HTMLElement, qbox = overlay.querySelector('.quality') as HTMLElement;
  const levels = Object.assign(document.createElement('div'), { className: 'difficulty levels' });
  const ask = Object.assign(document.createElement('div'), { className: 'confirm' });
  qbox.after(levels);
  overlay.append(ask);
  const button = (parent: HTMLElement, label: string, on: boolean, act: () => void) => {
    const b = document.createElement('button');
    b.innerHTML = label;
    b.classList.toggle('on', on);
    b.addEventListener('click', (ev) => {
      ev.stopPropagation();
      act();
    });
    parent.appendChild(b);
  };
  const render = () => {
    box.innerHTML = qbox.innerHTML = levels.innerHTML = '';
    for (const [id, d] of Object.entries(DIFFICULTIES)) button(box, d.label, id === difficulty.id, () => (difficulty.set(id as DifficultyId), render()));
    for (const [q, label] of QUALITIES) button(qbox, label, q === quality, () => (chooseQuality(q), render()));
    for (const c of extras.chapters) button(levels, `CAP. ${c.number}`, c.id === extras.current, () => c.id !== extras.current && confirmSwitch(c));
  };
  const confirmSwitch = (c: ChapterCard) => {
    ask.innerHTML = `<p>Cambiar al capítulo ${c.number} — ${c.title} reinicia el nivel desde el principio. ¿Seguro?</p><div class="difficulty"></div>`;
    const row = ask.querySelector('div')!;
    button(row, 'SÍ, CAMBIAR', false, () => {
      const url = new URL(location.href);
      url.searchParams.set('ch', c.id);
      location.href = url.toString();
    });
    button(row, 'CANCELAR', false, () => ask.classList.remove('on'));
    ask.classList.add('on');
  };
  ask.addEventListener('click', (ev) => ev.stopPropagation());
  render();
  overlay.addEventListener('click', onPlay);
  document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyP' && document.pointerLockElement === canvas) {
      status.textContent = 'PAUSA · clic para continuar';
      document.exitPointerLock();
    }
  });
  document.addEventListener('pointerlockchange', () => {
    const playing = document.pointerLockElement === canvas;
    overlay.classList.toggle('hidden', playing);
    document.body.classList.toggle('paused', !playing);
    if (!playing) ask.classList.remove('on');
    if (!playing && truce.until) status.textContent = 'PAUSA · clic para continuar';
    if (playing) overlay.classList.remove('intro');
    if (playing && !truce.until) {
      truce.until = Infinity;
      startCountdown(() => (truce.until = performance.now() + 2000));
    }
  });
}
