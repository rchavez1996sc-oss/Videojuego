import { truce } from '../systems/truce';
import { DIFFICULTIES, difficulty, type DifficultyId } from '../core/difficulty';

/**
 * Difficulty buttons on the start/pause overlay; clicking anywhere else starts playing. The overlay hides while the
 * pointer is locked, and the first entry opens a 3 s grace period before anyone fires.
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
  overlay.addEventListener('click', onPlay);
  document.addEventListener('pointerlockchange', () => {
    const playing = document.pointerLockElement === canvas;
    overlay.classList.toggle('hidden', playing);
    if (playing && !truce.until) truce.until = performance.now() + 3000;
  });
}
