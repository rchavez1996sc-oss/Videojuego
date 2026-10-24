import { victoryFanfare } from '../audio/fanfare';

/**
 * Objective-complete beat before the results screen: a warm flash, the "OBJETIVO CUMPLIDO" stamp slamming in with a
 * sweeping light and an orchestral fanfare. Calls `then` once it settles.
 */
export function celebrate(title: string, then: () => void): void {
  const el = document.createElement('div');
  el.id = 'obj-done';
  el.innerHTML = `<div class="flash"></div><div class="stamp"><small>OBJETIVO CUMPLIDO</small><b>${title}</b><i></i></div>`;
  document.body.appendChild(el);
  victoryFanfare();
  requestAnimationFrame(() => el.classList.add('on'));
  setTimeout(() => {
    el.classList.add('out');
    then();
    setTimeout(() => el.remove(), 800);
  }, 2600);
}
