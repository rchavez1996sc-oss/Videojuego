import './hud.css';

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
  private lastReload = 0;
  private toast: HTMLElement;
  private counter: HTMLElement;
  private nades: HTMLElement;
  private civ: HTMLElement;
  private zoom: HTMLElement;
  private hpNum: HTMLElement;
  private ticks: HTMLElement;
  private slots: HTMLElement[];
  private cache = new Map<string, string>();
  private hitT = 0;
  private toastT = 0;

  constructor() {
    this.root.id = 'hud';
    this.root.innerHTML = `
      <div class="crosshair"><i class="t"></i><i class="b"></i><i class="l"></i><i class="r"></i><b></b></div>
      <div class="hitmarker"><i></i><i></i><i></i><i></i></div>
      <div class="reload"><svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="20"/><circle class="fg" cx="24" cy="24" r="20"/></svg><span>RECARGANDO</span></div>
      <div class="reload-hint"><kbd>R<svg viewBox="0 0 24 24" preserveAspectRatio="none"><rect x="1" y="1" width="22" height="22" pathLength="100"/></svg></kbd>MANTÉN PARA RECARGAR</div>
      <div class="toast"></div>
      <div class="zoom"></div>
      <div class="counter"><span class="k">ENEMIGOS</span><b>0</b><span class="civ"></span></div>
      <div class="vitals">
        <div class="hpnum"><b>100</b><span class="lives"></span></div>
        <div class="bars"><div class="meter hp"><div></div><i class="cap"></i></div><div class="meter stamina"><div></div></div></div>
      </div>
      <div class="ammo">
        <div class="head"><span class="weapon"></span><span class="mode"></span></div>
        <div class="count"><span class="mag">30</span><span class="res">150</span></div>
        <div class="ticks"><div></div></div>
        <div class="slots"><div class="slot rifle on"><kbd>1</kbd><span>FUSIL</span></div><div class="slot nade"><kbd>G</kbd>GRANADA<span class="nades"></span></div></div>
      </div>`;
    document.body.appendChild(this.root);
    const q = <T extends HTMLElement>(s: string) => this.root.querySelector(s) as T;
    this.cross = ['.t', '.b', '.l', '.r'].map((s) => q(`.crosshair ${s}`));
    this.hit = q('.hitmarker');
    this.ammo = q('.mag');
    this.reserve = q('.res');
    this.mode = q('.mode');
    this.weapon = q('.weapon');
    this.hp = q('.hp div');
    this.hpNum = q('.hpnum b');
    this.ticks = q('.ticks div');
    this.slots = [q('.slot.rifle'), q('.slot.nade')];
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

  update(dt: number, s: { spreadPx: number; ammo: number; mag: number; reserve: number; carry: number; mode: string; weapon: string; hp: number; cap: number; stamina: number; grenades: number; zoom: number; reload: number; reloadHold?: number; aiming: boolean; slot: 'rifle' | 'grenade'; slotLabel?: string }): void {
    const gap = Math.round(5 + s.spreadPx);
    this.set('gap', String(gap), () => {
      this.cross[0].style.transform = `translate(-50%, ${-gap - 10}px)`;
      this.cross[1].style.transform = `translate(-50%, ${gap}px)`;
      this.cross[2].style.transform = `translate(${-gap - 10}px, -50%)`;
      this.cross[3].style.transform = `translate(${gap}px, -50%)`;
    });
    this.set('ammo', `${s.ammo}/${s.reserve}`, () => {
      const total = s.ammo + s.reserve;
      this.ammo.textContent = String(total);
      this.ammo.classList.toggle('low', total <= s.mag);
      this.reserve.textContent = String(s.carry);
      this.reserve.classList.toggle('empty', total === 0);
      this.ticks.style.width = `${(s.ammo / s.mag) * 100}%`;
      this.ticks.parentElement!.style.setProperty('--n', String(s.mag));
    });
    this.set('slot', s.slot, () => {
      this.slots[0].classList.toggle('on', s.slot === 'rifle');
      if (s.slotLabel) this.slots[0].lastElementChild!.textContent = s.slotLabel;
      this.slots[1].classList.toggle('on', s.slot === 'grenade');
    });
    this.set('mode', s.mode + s.weapon, () => {
      this.mode.textContent = s.mode === 'auto' ? 'AUTO' : 'SEMI';
      this.weapon.textContent = s.weapon;
    });
    this.set('hp', s.hp.toFixed(0), () => {
      this.hp.style.width = `${s.hp}%`;
      this.hpNum.textContent = String(Math.max(0, Math.ceil(s.hp)));
      this.hpNum.parentElement!.parentElement!.classList.toggle('low', s.hp < 35);
    });
    this.set('nades', String(s.grenades), () => {
      this.nades.innerHTML = '<i></i>'.repeat(s.grenades) + '<i class="off"></i>'.repeat(Math.max(0, 3 - s.grenades));
      this.slots[1].classList.toggle('none', s.grenades === 0);
    });
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
      if (this.lastReload > 0 && s.reload === 0) this.flashReady();
      if (this.lastReload === 0 && s.reload > 0) this.reload.querySelector('span')!.textContent = 'RECARGANDO';
      this.lastReload = s.reload;
      this.reload.classList.toggle('on', s.reload > 0);
      (this.reload.querySelector('.fg') as SVGCircleElement).style.strokeDashoffset = String(125.7 * (1 - s.reload));
    });
    const held = s.reloadHold ?? 0, hint = s.slot === 'rifle' && s.reserve > 0 && (s.ammo <= s.mag * 0.25 || held > 0);
    this.set('rh', `${hint}${held.toFixed(2)}${s.ammo === 0}`, () => {
      const el = this.root.querySelector('.reload-hint')!;
      el.classList.toggle('on', hint);
      el.classList.toggle('held', held > 0);
      el.classList.toggle('empty', s.ammo === 0 && held === 0);
      (el.querySelector('rect') as SVGRectElement).style.strokeDashoffset = String(100 * (1 - held));
    });
    this.hitT = Math.max(0, this.hitT - dt);
    this.toastT = Math.max(0, this.toastT - dt);
    const hitO = Math.min(1, this.hitT * 5).toFixed(2), toastO = Math.min(1, this.toastT * 3).toFixed(2);
    this.set('hitO', hitO, () => (this.hit.style.opacity = hitO));
    this.set('toastO', toastO, () => (this.toast.style.opacity = toastO));
  }

  set lives(n: number) {
    const el = this.root.querySelector('.lives') as HTMLElement;
    el.innerHTML = '<i></i>'.repeat(Math.max(0, n)) + '<i class="off"></i>'.repeat(Math.max(0, 3 - n));
    el.title = `${n} vidas`;
  }

  set enemies(n: number) {
    this.set('enemies', String(n), () => (this.counter.textContent = String(n)));
  }

  set civilians(v: { count: number; limit: number }) {
    this.civ.innerHTML = v.count ? `BAJAS CIVILES <b>${v.count}/${v.limit}</b>` : '';
    this.civ.classList.toggle('warn', v.count >= v.limit - 1);
  }

  hitmarker(kill: boolean, headshot: boolean, killLabel = 'BLANCO DERRIBADO'): void {
    this.hitT = kill ? 0.45 : 0.22;
    this.hit.classList.toggle('kill', kill);
    this.hit.classList.remove('pop');
    void this.hit.offsetWidth;
    this.hit.classList.add('pop');
    if (headshot || kill) this.showToast(headshot ? (kill ? 'HEADSHOT' : 'HEADSHOT') : killLabel);
  }

  showToast(text: string): void {
    this.toast.textContent = text;
    this.toast.classList.remove('pop');
    void this.toast.offsetWidth;
    this.toast.classList.add('pop');
    this.toastT = 1.4;
  }

  /** Brief "LISTO" pop on the ring when a reload finishes. */
  private flashReady(): void {
    this.reload.querySelector('span')!.textContent = 'LISTO';
    this.reload.classList.remove('ready');
    void this.reload.offsetWidth;
    this.reload.classList.add('ready');
  }
}
