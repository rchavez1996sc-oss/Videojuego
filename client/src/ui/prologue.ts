/** Black-screen prologue: paragraphs fade in one by one while the chapter loads; a click (or the end) reveals the menu. */
export function showPrologue(title: string, paragraphs: string[]): void {
  if (!paragraphs.length) return;
  const el = document.createElement('div');
  el.id = 'prologue';
  el.innerHTML = `<div class="lines">${paragraphs.map((p) => `<p>${p}</p>`).join('')}</div><h3>${title}</h3><span>CLIC PARA CONTINUAR</span>`;
  document.body.appendChild(el);
  const lines = [...el.querySelectorAll('p')];
  let i = 0;
  const next = () => {
    if (i < lines.length) lines[i++].classList.add('on');
    else el.querySelector('h3')!.classList.add('on');
  };
  next();
  const timer = setInterval(next, 4200);
  el.addEventListener('click', (ev) => {
    ev.stopPropagation();
    clearInterval(timer);
    el.classList.add('out');
    setTimeout(() => el.remove(), 900);
  });
}
