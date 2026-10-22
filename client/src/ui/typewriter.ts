/** Types `text` into `el` letter by letter (longer beats after punctuation) behind a blinking caret. */
export class Typewriter {
  private timer = 0;
  private n = 0;
  active = false;

  constructor(private el: HTMLElement, private text: string, private onKey: (ch: string) => void, private done: () => void) {
    el.innerHTML = '<span class="typed"></span><span class="caret">▌</span>';
    this.active = true;
    this.tick();
  }

  private get typed(): HTMLElement {
    return this.el.querySelector('.typed')!;
  }

  private tick = (): void => {
    if (this.n >= this.text.length) return this.end();
    const ch = this.text[this.n++];
    this.typed.textContent = this.text.slice(0, this.n);
    this.onKey(ch);
    const pause = /[.;:]/.test(ch) ? 260 : ch === ',' ? 150 : 28 + Math.random() * 22;
    this.timer = window.setTimeout(this.tick, pause);
  };

  /** Shows the whole paragraph at once (a click while it is still typing). */
  finish(): void {
    clearTimeout(this.timer);
    this.typed.textContent = this.text;
    this.end();
  }

  stop(): void {
    clearTimeout(this.timer);
    this.active = false;
  }

  private end(): void {
    if (!this.active) return;
    this.active = false;
    this.done();
  }
}
