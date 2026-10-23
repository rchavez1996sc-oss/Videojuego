import { renderPlates } from './art/plates';
import { IntroMusic } from '../audio/introMusic';
import { Typewriter } from './typewriter';

/** How long a plate stays once its paragraph has been typed out. */
const HOLD = 3200;

let calm = true, waiting: (() => void)[] = [];
const setCalm = (v: boolean) => {
  calm = v;
  if (v) for (const w of waiting.splice(0)) w();
};

/** Resolves when nothing is being typed (between paragraphs, on the title card or with no prologue): heavy loading waits for it. */
export function prologueQuiet(): Promise<void> {
  return calm ? Promise.resolve() : new Promise((r) => waiting.push(r));
}

/**
 * Cinematic prologue shown while the chapter loads. A title card asks for a click (browsers need one before
 * audio), then each paragraph appears together with its illustrated plate and a beat of the score.
 * Click advances, Esc skips; after the last plate the chapter title appears. Resolves when it closes
 * (the game loop only starts then).
 */
export function showPrologue(kicker: string, title: string, paragraphs: string[], plateKeys?: string[], score: 'war' | 'intrigue' = 'war', autostart = false): Promise<void> {
  if (!paragraphs.length) return Promise.resolve();
  let finished = () => {};
  const over = new Promise<void>((r) => (finished = r));
  setCalm(false);
  const el = document.createElement('div');
  el.id = 'prologue';
  el.innerHTML = `<div class="plates"></div><p class="line"></p><h3><small>${kicker}</small>${title}<i></i></h3><div class="begin">CLIC PARA COMENZAR</div><span>CLIC: CONTINUAR · ESC: SALTAR</span>`;
  document.body.appendChild(el);
  const plates = el.querySelector('.plates')!, line = el.querySelector('.line')!, head = el.querySelector('h3')!;
  const urls: string[] = [];
  const music = new IntroMusic(score);
  let i = -1, shown = -1, timer = 0, started = false;
  let typing: Typewriter | null = null;
  renderPlates((k, url) => {
    urls[k] = url;
    if (k === i) reveal();
  }, plateKeys).catch((e) => {
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
    line.classList.add('on');
    typing = new Typewriter(line as HTMLElement, paragraphs[i], (ch) => music.key(ch === ' '), () => (setCalm(true), (timer = window.setTimeout(next, HOLD))));
  };
  const close = () => {
    clearTimeout(timer);
    typing?.stop();
    removeEventListener('keydown', onKey);
    music.stop();
    setCalm(true);
    el.classList.add('out');
    setTimeout(() => el.remove(), 1000);
    finished();
  };
  const next = () => {
    clearTimeout(timer);
    typing?.stop();
    line.classList.remove('on');
    if (++i >= paragraphs.length) {
      if (i > paragraphs.length) return close();
      head.classList.add('on');
      music.title();
      setCalm(true);
      return;
    }
    setCalm(false);
    setTimeout(() => reveal(), 600);
  };
  const onKey = (e: KeyboardEvent) => e.code === 'Escape' && close();
  addEventListener('keydown', onKey);
  const advance = () => {
    if (!started) {
      started = true;
      el.classList.add('started');
      music.start();
    }
    if (typing?.active) typing.finish();
    else next();
  };
  el.addEventListener('click', (ev) => {
    ev.stopPropagation();
    advance();
  });
  if (autostart) advance();
  return over;
}
