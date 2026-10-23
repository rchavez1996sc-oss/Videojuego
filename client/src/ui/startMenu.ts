import { truce } from '../systems/truce';
import { DIFFICULTIES, difficulty, type DifficultyId } from '../core/difficulty';
import { quality, setQuality, type Quality } from '../core/settings';

const QUALITIES: [Quality, string][] = [['low', 'BAJA'], ['medium', 'MEDIA'], ['high', 'ALTA']];

/**
 * Difficulty and quality buttons on the start/pause overlay (quality reloads the game); clicking anywhere else plays.
 * The overlay hides while the pointer is locked, P pauses, and the first entry opens a 3 s grace period.
 */
export function setupStartMenu(overlay: HTMLElement, status: HTMLElement, canvas: HTMLElement, onPlay: () => void): void {
  status.textContent = 'Elige la dificultad · clic en cualquier parte para jugar';
  const box = overlay.querySelector('.difficulty') as HTMLElement;
  const render = () => {
    box.innerHTML = '';
    for (const [id, d] of Object.entries(DIFFICULTIES)) {
      const b = document.createElement('button');
      b.textContent = d.label;
      b.classList.toggle('on', id === difficulty.id);
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        difficulty.set(id as DifficultyId);
        render();
      });
      box.appendChild(b);
    }
  };
  render();
  const qbox = overlay.querySelector('.quality') as HTMLElement;
  for (const [q, label] of QUALITIES) {
    const b = document.createElement('button');
    b.textContent = label;
    b.classList.toggle('on', q === quality);
    b.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (q !== quality) setQuality(q);
    });
    qbox.appendChild(b);
  }
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
    if (playing && !truce.until) truce.until = performance.now() + 3000;
  });
}
