import { renderPlates } from './art/plates';
import { IntroMusic } from '../audio/introMusic';

const STEP = 8000;

/**
 * Cinematic prologue shown while the chapter loads. A title card asks for a click (browsers need one before
 * audio), then each paragraph appears together with its illustrated plate and a beat of the score.
 * Click advances, Esc skips; after the last plate the chapter title appears.
 */
export function showPrologue(title: string, paragraphs: string[]): void {
  if (!paragraphs.length) return;
  const el = document.createElement('div');
  el.id = 'prologue';
  el.innerHTML = `<div class="plates"></div><p class="line"></p><h3>${title}</h3><div class="begin">CLIC PARA COMENZAR</div><span>CLIC: CONTINUAR · ESC: SALTAR</span>`;
  document.body.appendChild(el);
  const plates = el.querySelector('.plates')!, line = el.querySelector('.line')!, head = el.querySelector('h3')!;
  const urls: string[] = [];
  const music = new IntroMusic();
  let i = -1, shown = -1, timer = 0, started = false;
  renderPlates((k, url) => {
    urls[k] = url;
    if (k === i) reveal();
  }).catch((e) => {
    console.warn('prologue art', e);
    if (i >= 0) reveal(true);
  });
  const reveal = (force = false) => {
    if (i < 0 || i >= paragraphs.length || shown === i || (!urls[i] && !force)) return;
    shown = i;
    if (urls[i] && plates.lastElementChild?.getAttribute('data-k') !== String(i)) {
      const img = document.createElement('div');
      img.className = 'plate';
      img.dataset.k = String(i);
      img.style.backgroundImage = `url(${urls[i]})`;
      plates.appendChild(img);
      requestAnimationFrame(() => requestAnimationFrame(() => img.classList.add('on')));
      for (const old of [...plates.children].slice(0, -2)) old.remove();
    }
    music.plate(i);
    line.textContent = paragraphs[i];
    line.classList.add('on');
    timer = window.setTimeout(next, STEP);
  };
  const close = () => {
    clearTimeout(timer);
    removeEventListener('keydown', onKey);
    music.stop();
    el.classList.add('out');
    setTimeout(() => el.remove(), 1000);
  };
  const next = () => {
    clearTimeout(timer);
    line.classList.remove('on');
    if (++i >= paragraphs.length) {
      if (i > paragraphs.length) return close();
      head.classList.add('on');
      music.title();
      return;
    }
    setTimeout(() => reveal(), 600);
  };
  const onKey = (e: KeyboardEvent) => e.code === 'Escape' && close();
  addEventListener('keydown', onKey);
  el.addEventListener('click', (ev) => {
    ev.stopPropagation();
    if (!started) {
      started = true;
      el.classList.add('started');
      music.start();
    }
    next();
  });
}
