import './rewards.css';

const STREAK = ['', '', 'DOBLE BAJA', 'TRIPLE BAJA', 'CUÁDRUPLE BAJA', 'IMPARABLE'];

/**
 * Small, steady rewards without a score: a kill feed under the enemy counter (tags: head, long shot, streak, one
 * shot), multi-kill callouts, milestones every 5 kills, and a summary for the end screen (accuracy, heads, longest
 * shot, time).
 */
export class Rewards {
  shots = 0;
  private hits = 0;
  private kills = 0;
  private heads = 0;
  private longest = 0;
  private lifeShots = 0;
  private streak = 0;
  private lastKill = -99;
  private clock = 0;
  private feed: HTMLElement;

  constructor(root: HTMLElement, private callout: (text: string) => void) {
    const box = document.createElement('div');
    box.className = 'rewards';
    box.innerHTML = '<div class="feed"></div>';
    root.appendChild(box);
    this.feed = box.querySelector('.feed')!;
  }

  hit(kill: boolean, head: boolean, distance: number): void {
    this.hits++;
    if (!kill) return;
    this.kills++;
    this.streak = this.clock - this.lastKill < 4.5 ? this.streak + 1 : 1;
    this.lastKill = this.clock;
    const tags = ['BAJA'], oneShot = this.shots - this.lifeShots <= 1;
    this.lifeShots = this.shots;
    if (head) [this.heads++, tags.push('CABEZA')];
    if (distance >= 50) tags.push(`${Math.round(distance)} M`);
    if (oneShot && !head) tags.push('UN TIRO');
    if (this.streak >= 2) tags.push(`RACHA ×${this.streak}`);
    this.longest = Math.max(this.longest, distance);
    if (this.streak >= 2) this.callout(STREAK[Math.min(this.streak, STREAK.length - 1)]);
    else if (this.kills % 5 === 0) this.callout(`${this.kills} BAJAS`);
    const line = document.createElement('div');
    line.className = `line${head ? ' head' : ''}`;
    line.innerHTML = `<b>✕</b>${tags.map((t, i) => `<span${i ? ` class="tag${t === 'CABEZA' ? ' gold' : ''}"` : ''}>${t}</span>`).join('')}`;
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
  }

  summary(): string {
    const acc = this.shots ? Math.round((this.hits / this.shots) * 100) : 0, m = Math.floor(this.clock / 60), s = Math.floor(this.clock % 60);
    return `BAJAS ${this.kills} · PRECISIÓN ${acc} % · DISPAROS A LA CABEZA ${this.heads}/${this.kills} · TIRO MÁS LARGO ${Math.round(this.longest)} M · TIEMPO ${m}:${String(s).padStart(2, '0')}`;
  }
}
