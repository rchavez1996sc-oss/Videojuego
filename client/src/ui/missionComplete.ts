/** Chapter cleared: summary screen with a replay button. */
export function showMissionComplete(title: string, text: string, stats: string): void {
  let el = document.getElementById('complete');
  if (!el) {
    el = document.createElement('div');
    el.id = 'complete';
    document.body.appendChild(el);
  }
  el.innerHTML = `<h2>${title}</h2><p>${text}</p><p class="stats">${stats}</p><button>VOLVER A JUGAR</button>`;
  el.querySelector('button')!.addEventListener('click', () => location.reload());
  el.classList.add('on');
  document.exitPointerLock();
}
