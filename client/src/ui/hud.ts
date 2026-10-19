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
  private hitT = 0;
  private toastT = 0;

  constructor() {
    this.root.id = 'hud';
    this.root.innerHTML = `
      <div class="crosshair"><i class="t"></i><i class="b"></i><i class="l"></i><i class="r"></i><b></b></div>
      <div class="hitmarker"><i></i><i></i><i></i><i></i></div>
      <div class="reload"><span>RECARGANDO</span><div class="bar"><div></div></div></div>
      <div class="toast"></div>
      <div class="vitals">
        <div class="label">SALUD</div><div class="meter hp"><div></div></div>
        <div class="meter stamina"><div></div></div>
      </div>
      <div class="ammo"><div class="weapon"></div><div class="count"><span class="mag">30</span><span class="res">/ 150</span></div><div class="mode"></div></div>`;
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
  }

  set visible(v: boolean) {
    this.root.style.display = v ? '' : 'none';
  }

  update(dt: number, s: { spreadPx: number; ammo: number; mag: number; reserve: number; mode: string; weapon: string; hp: number; stamina: number; reload: number; aiming: boolean }): void {
    const gap = 5 + s.spreadPx;
    this.cross[0].style.transform = `translate(-50%, ${-gap - 10}px)`;
    this.cross[1].style.transform = `translate(-50%, ${gap}px)`;
    this.cross[2].style.transform = `translate(${-gap - 10}px, -50%)`;
    this.cross[3].style.transform = `translate(${gap}px, -50%)`;
    this.ammo.textContent = String(s.ammo);
    this.ammo.classList.toggle('low', s.ammo <= s.mag * 0.2);
    this.reserve.textContent = `/ ${s.reserve}`;
    this.mode.textContent = s.mode === 'auto' ? 'AUTO' : 'SEMI';
    this.weapon.textContent = s.weapon;
    this.hp.style.width = `${s.hp}%`;
    this.stamina.style.width = `${s.stamina}%`;
    this.stamina.parentElement!.classList.toggle('hidden', s.stamina >= 99.5);
    this.reload.classList.toggle('on', s.reload > 0);
    (this.reload.querySelector('.bar div') as HTMLElement).style.width = `${s.reload * 100}%`;
    this.hitT = Math.max(0, this.hitT - dt);
    this.hit.style.opacity = String(Math.min(1, this.hitT * 5));
    this.toastT = Math.max(0, this.toastT - dt);
    this.toast.style.opacity = String(Math.min(1, this.toastT * 3));
  }

  hitmarker(kill: boolean, headshot: boolean): void {
    this.hitT = kill ? 0.45 : 0.22;
    this.hit.classList.toggle('kill', kill);
    this.hit.classList.remove('pop');
    void this.hit.offsetWidth;
    this.hit.classList.add('pop');
    if (headshot || kill) this.showToast(headshot ? (kill ? 'HEADSHOT  +150' : 'HEADSHOT') : 'BLANCO DERRIBADO  +100');
  }

  showToast(text: string): void {
    this.toast.textContent = text;
    this.toast.classList.remove('pop');
    void this.toast.offsetWidth;
    this.toast.classList.add('pop');
    this.toastT = 1.4;
  }
}
