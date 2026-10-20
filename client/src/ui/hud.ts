export class Hud {
  private root = document.createElement('div');
  private cross: HTMLElement[] = [];
  private hit: HTMLElement;
  private ammo: HTMLElement;
  private reserve: HTMLElement;
  private mode: HTMLElement;
  private weapon: HTMLElement;
  private hp: HTMLElement;
  private stamina: HTMLElement;
  private reload: HTMLElement;
  private toast: HTMLElement;
  private counter: HTMLElement;
  private nades: HTMLElement;
  private civ: HTMLElement;
  private zoom: HTMLElement;
  private cache = new Map<string, string>();
  private hitT = 0;
  private toastT = 0;

  constructor() {
    this.root.id = 'hud';
    this.root.innerHTML = `
      <div class="crosshair"><i class="t"></i><i class="b"></i><i class="l"></i><i class="r"></i><b></b></div>
      <div class="hitmarker"><i></i><i></i><i></i><i></i></div>
      <div class="reload"><span>RECARGANDO</span><div class="bar"><div></div></div></div>
      <div class="toast"></div>
      <div class="counter">ENEMIGOS<b>0</b><span class="civ"></span></div>
      <div class="vitals">
        <div class="label">SALUD</div><div class="meter hp"><div></div><i class="cap"></i></div>
        <div class="meter stamina"><div></div></div>
      </div>
      <div class="ammo"><div class="weapon"></div><div class="count"><span class="mag">30</span><span class="res">/ 150</span></div><div class="mode"></div><div class="nades"></div></div>
      <div class="zoom"></div>`;
    document.body.appendChild(this.root);
    const q = <T extends HTMLElement>(s: string) => this.root.querySelector(s) as T;
    this.cross = ['.t', '.b', '.l', '.r'].map((s) => q(`.crosshair ${s}`));
    this.hit = q('.hitmarker');
    this.ammo = q('.mag');
    this.reserve = q('.res');
    this.mode = q('.mode');
    this.weapon = q('.weapon');
    this.hp = q('.hp div');
    this.stamina = q('.stamina div');
    this.reload = q('.reload');
    this.toast = q('.toast');
    this.counter = q('.counter b');
    this.nades = q('.nades');
    this.civ = q('.counter .civ');
    this.zoom = q('.zoom');
  }

  private set(key: string, value: string, apply: () => void): void {
    if (this.cache.get(key) === value) return;
    this.cache.set(key, value);
    apply();
  }

  set visible(v: boolean) {
    this.root.style.display = v ? '' : 'none';
  }

  update(dt: number, s: { spreadPx: number; ammo: number; mag: number; reserve: number; mode: string; weapon: string; hp: number; cap: number; stamina: number; grenades: number; zoom: number; reload: number; aiming: boolean }): void {
    const gap = Math.round(5 + s.spreadPx);
    this.set('gap', String(gap), () => {
      this.cross[0].style.transform = `translate(-50%, ${-gap - 10}px)`;
      this.cross[1].style.transform = `translate(-50%, ${gap}px)`;
      this.cross[2].style.transform = `translate(${-gap - 10}px, -50%)`;
      this.cross[3].style.transform = `translate(${gap}px, -50%)`;
    });
    this.set('ammo', `${s.ammo}/${s.reserve}`, () => {
      this.ammo.textContent = String(s.ammo);
      this.ammo.classList.toggle('low', s.ammo <= s.mag * 0.2);
      this.reserve.textContent = `/ ${s.reserve}`;
    });
    this.set('mode', s.mode + s.weapon, () => {
      this.mode.textContent = s.mode === 'auto' ? 'AUTO' : 'SEMI';
      this.weapon.textContent = s.weapon;
    });
    this.set('hp', s.hp.toFixed(0), () => (this.hp.style.width = `${s.hp}%`));
    this.set('nades', String(s.grenades), () => (this.nades.textContent = `GRANADAS ${'●'.repeat(s.grenades)}${'○'.repeat(Math.max(0, 3 - s.grenades))}`));
    const z = s.aiming && s.zoom > 1.2 ? `${Math.round(s.zoom)}x` : '';
    this.set('zoom', z, () => {
      this.zoom.textContent = z;
      this.zoom.style.opacity = z ? '1' : '0';
    });
    this.set('cap', String(s.cap), () => this.hp.parentElement!.classList.toggle('capped', s.cap < 100));
    this.set('st', s.stamina.toFixed(0), () => {
      this.stamina.style.width = `${s.stamina}%`;
      this.stamina.parentElement!.classList.toggle('hidden', s.stamina >= 99.5);
    });
    this.set('rl', s.reload.toFixed(2), () => {
      this.reload.classList.toggle('on', s.reload > 0);
      (this.reload.querySelector('.bar div') as HTMLElement).style.width = `${s.reload * 100}%`;
    });
    this.hitT = Math.max(0, this.hitT - dt);
    this.toastT = Math.max(0, this.toastT - dt);
    const hitO = Math.min(1, this.hitT * 5).toFixed(2), toastO = Math.min(1, this.toastT * 3).toFixed(2);
    this.set('hitO', hitO, () => (this.hit.style.opacity = hitO));
    this.set('toastO', toastO, () => (this.toast.style.opacity = toastO));
  }

  set enemies(n: number) {
    this.set('enemies', String(n), () => (this.counter.textContent = String(n)));
  }

  set civilians(v: { count: number; limit: number }) {
    this.civ.textContent = v.count ? `BAJAS CIVILES ${v.count}/${v.limit}` : '';
    this.civ.classList.toggle('warn', v.count >= v.limit - 1);
  }

  hitmarker(kill: boolean, headshot: boolean, killLabel = 'BLANCO DERRIBADO  +100'): void {
    this.hitT = kill ? 0.45 : 0.22;
    this.hit.classList.toggle('kill', kill);
    this.hit.classList.remove('pop');
    void this.hit.offsetWidth;
    this.hit.classList.add('pop');
    if (headshot || kill) this.showToast(headshot ? (kill ? 'HEADSHOT  +150' : 'HEADSHOT') : killLabel);
  }

  showToast(text: string): void {
    this.toast.textContent = text;
    this.toast.classList.remove('pop');
    void this.toast.offsetWidth;
    this.toast.classList.add('pop');
    this.toastT = 1.4;
  }
}
