/** Full-screen mission failure with a retry button (reloads the chapter). */
export function showMissionFailed(reason: string): void {
  let el = document.getElementById('fail');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fail';
    document.body.appendChild(el);
  }
  el.innerHTML = `<h2>MISIÓN FALLIDA</h2><p>${reason}</p><button>REINTENTAR</button>`;
  el.querySelector('button')!.addEventListener('click', () => location.reload());
  el.classList.add('on');
  document.exitPointerLock();
}
