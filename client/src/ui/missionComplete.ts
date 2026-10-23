/** Side view of a compact submachine gun for the unlock badge. */
const SMG = '<svg viewBox="0 0 120 44"><path d="M4 14h62l4-4h20v4h22v6H92l-2 4H70l-4 18h-9l3-18h-8l-3 10h-8l2-10H30l-4 6H14l2-6H4z"/></svg>';

/** Chapter cleared: summary, what was taken, an unlocked weapon and a replay button. */
/** `next` = query value of the following chapter (adds a CONTINUAR button and remembers progress). */
export function showMissionComplete(title: string, text: string, stats: string, loot: string[] = [], unlock?: string, next?: string): void {
  let el = document.getElementById('complete');
  if (!el) {
    el = document.createElement('div');
    el.id = 'complete';
    document.body.appendChild(el);
  }
  const items = loot.length ? `<ul>${loot.map((l) => `<li>${l}</li>`).join('')}</ul>` : '';
  const badge = unlock ? `<div class="unlock">${SMG}<div><small>NUEVA ARMA DESBLOQUEADA</small><b>${unlock}</b></div></div>` : '';
  el.innerHTML = `<h2>${title}</h2><p>${text}</p>${items}${badge}<p class="stats">${stats}</p>${next ? '<button class="next">CONTINUAR: SIGUIENTE CAPÍTULO</button>' : ''}<button class="again">VOLVER A JUGAR</button>`;
  el.querySelector('.again')!.addEventListener('click', () => location.reload());
  if (next) {
    try {
      localStorage.setItem('tq-chapter', next);
    } catch { /* progress just isn't remembered */ }
    el.querySelector('.next')!.addEventListener('click', () => {
      const url = new URL(location.href);
      url.searchParams.set('ch', next);
      location.href = url.toString();
    });
  }
  el.classList.add('on');
  document.exitPointerLock();
}
