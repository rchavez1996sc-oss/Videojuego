import './rewards.css';

const STREAK = ['', '', 'DOBLE BAJA', 'TRIPLE BAJA', 'CUÁDRUPLE BAJA'];

/**
 * Small, steady rewards: a kill feed under the enemy counter (points and tags: head, long shot, streak), a running
 * score that rolls up, multi-kill callouts, and a summary for the end screen (accuracy, heads, longest shot, time).
 */
export class Rewards {
  shots = 0;
  private hits = 0;
  private kills = 0;
  private heads = 0;
  private longest = 0;
  private score = 0;
  private shown = 0;
  private streak = 0;
  private lastKill = -99;
  private clock = 0;
  private feed: HTMLElement;
  private total: HTMLElement;

  constructor(root: HTMLElement, private callout: (text: string) => void) {
    const box = document.createElement('div');
    box.className = 'rewards';
    box.innerHTML = '<div class="score"><span>PUNTOS</span><b>0</b></div><div class="feed"></div>';
    root.appendChild(box);
    this.feed = box.querySelector('.feed')!;
    this.total = box.querySelector('.score b')!;
  }

  hit(kill: boolean, head: boolean, distance: number): void {
    this.hits++;
    if (!kill) return;
    this.kills++;
    this.streak = this.clock - this.lastKill < 4.5 ? this.streak + 1 : 1;
    this.lastKill = this.clock;
    const tags: [string, number][] = [['BAJA', 100]];
    if (head) [this.heads++, tags.push(['CABEZA', 50])];
    if (distance >= 50) tags.push([`${Math.round(distance)} M`, 25 + Math.round((distance - 50) / 2)]);
    if (this.streak >= 2) tags.push([`RACHA ×${this.streak}`, 50 * (this.streak - 1)]);
    this.longest = Math.max(this.longest, distance);
    const pts = tags.reduce((s, t) => s + t[1], 0);
    this.score += pts;
    if (this.streak >= 2) this.callout(STREAK[this.streak] ?? `RACHA ×${this.streak}`);
    const line = document.createElement('div');
    line.className = `line${head ? ' head' : ''}`;
    line.innerHTML = `<b>+${pts}</b>${tags.map(([t], i) => `<span${i ? ` class="tag${t === 'CABEZA' ? ' gold' : ''}"` : ''}>${t}</span>`).join('')}`;
    this.feed.prepend(line);
    while (this.feed.children.length > 4) this.feed.lastElementChild!.remove();
    line.dataset.t = String(this.clock);
  }

  update(dt: number): void {
    this.clock += dt;
    for (const l of Array.from(this.feed.children) as HTMLElement[]) {
      const age = this.clock - Number(l.dataset.t);
      if (age > 3.7) l.remove();
      else if (age > 3.2) l.classList.add('out');
    }
    if (this.shown === this.score) return;
    this.shown = Math.min(this.score, this.shown + Math.max(1, Math.ceil((this.score - this.shown) * dt * 6)));
    this.total.textContent = String(this.shown);
    this.total.parentElement!.classList.toggle('rolling', this.shown < this.score);
  }

  summary(): string {
    const acc = this.shots ? Math.round((this.hits / this.shots) * 100) : 0, m = Math.floor(this.clock / 60), s = Math.floor(this.clock % 60);
    return `PUNTOS ${this.score} · PRECISIÓN ${acc} % · DISPAROS A LA CABEZA ${this.heads}/${this.kills} · TIRO MÁS LARGO ${Math.round(this.longest)} M · TIEMPO ${m}:${String(s).padStart(2, '0')}`;
  }
}
