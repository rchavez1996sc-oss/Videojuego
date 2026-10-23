import { chooseQuality, quality, type Quality } from '../core/settings';

export interface ChapterCard { id: string; number: number; title: string }

export const QUALITIES: [Quality, string][] = [['low', 'BAJA'], ['medium', 'MEDIA'], ['high', 'ALTA']];

/**
 * Title screen: pick the chapter and the graphics quality before anything loads. The COMENZAR click is also the
 * gesture browsers need before audio, so the prologue's score can start straight away. Resolves with the chapter id.
 */
export function showLauncher(chapters: ChapterCard[], initial: string): Promise<string> {
  const el = document.createElement('div');
  el.id = 'launcher';
  el.innerHTML = `<h1>TIERRA QUEMADA</h1><p class="sub">Lima, 2036</p>
    <h4>CAPÍTULO</h4><div class="chapters"></div>
    <h4>CALIDAD GRÁFICA</h4><div class="qualities"></div>
    <button class="go">COMENZAR</button>`;
  document.body.appendChild(el);
  let pick = chapters.some((c) => c.id === initial) ? initial : chapters[0].id;
  const list = el.querySelector('.chapters')!, qs = el.querySelector('.qualities')!;
  const draw = () => {
    list.innerHTML = '';
    for (const c of chapters) {
      const b = document.createElement('button');
      b.innerHTML = `<small>CAPÍTULO ${c.number}</small>${c.title.toUpperCase()}`;
      b.classList.toggle('on', c.id === pick);
      b.onclick = () => ((pick = c.id), draw());
      list.appendChild(b);
    }
    qs.innerHTML = '';
    for (const [q, label] of QUALITIES) {
      const b = document.createElement('button');
      b.textContent = label;
      b.classList.toggle('on', q === quality);
      b.onclick = () => (chooseQuality(q), draw());
      qs.appendChild(b);
    }
  };
  draw();
  return new Promise((done) => {
    el.querySelector('.go')!.addEventListener('click', () => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 600);
      done(pick);
    });
  });
}
