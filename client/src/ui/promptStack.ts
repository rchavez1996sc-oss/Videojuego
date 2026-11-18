/**
 * Every "[E] …" prompt (doors, vehicles, reviving, objectives, handover) sits at the same fixed spot; when several are
 * shown at once they used to stack on top of each other. This keeps the visible ones in a column, 44 px apart.
 */
export function stackPrompts(): void {
  let queued = false;
  const layout = () => {
    queued = false;
    const shown = [...document.querySelectorAll<HTMLElement>('.prompt')].filter((p) => p.style.opacity !== '0' && p.style.opacity !== '');
    shown.forEach((p, i) => {
      const top = i ? `calc(64% + ${i * 44}px)` : '';
      if (p.style.top !== top) p.style.top = top;
    });
  };
  new MutationObserver(() => queued || ((queued = true), queueMicrotask(layout))).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] });
}
