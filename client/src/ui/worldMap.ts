import * as THREE from 'three';
import type { Minimap } from './minimap';

export interface MapSnapshot {
  player: THREE.Vector3; forward: THREE.Vector3; goal?: THREE.Vector3;
  allies: THREE.Vector3[]; supplies: { pos: THREE.Vector3; kind: string }[];
}

/**
 * Full-screen north-up map (M while playing, or VER MAPA in the pause menu): the minimap's street plan with the
 * player's arrow, objective, squad and supplies; wheel zooms about the cursor, dragging pans. M or Esc closes it.
 */
export function setupWorldMap(mini: Minimap, overlay: HTMLElement, canvas: HTMLElement, snap: () => MapSnapshot): void {
  const root = Object.assign(document.createElement('div'), { id: 'worldmap' });
  root.innerHTML = '<div class="head"><b>MAPA</b><span>rueda: zoom · arrastrar: mover · M / ESC: cerrar</span><button>CERRAR</button></div><canvas></canvas>'
    + '<div class="legend"><i class="me"></i>TÚ<i class="goal"></i>OBJETIVO<i class="ally"></i>ESCUADRA<i class="med"></i>BOTIQUÍN<i class="ammo"></i>MUNICIÓN</div>';
  document.body.appendChild(root);
  const cv = root.querySelector('canvas')!, g = cv.getContext('2d')!;
  const row = Object.assign(document.createElement('div'), { className: 'difficulty' });
  const btn = Object.assign(document.createElement('button'), { textContent: 'VER MAPA' });
  row.appendChild(btn);
  (overlay.querySelector('.quality') ?? overlay).after(row);
  let s: MapSnapshot | null = null, k = 1, cx = 0, cz = 0, drag: [number, number] | null = null;

  const draw = () => {
    if (!s) return;
    const W = cv.width, H = cv.height, h = mini.half;
    const at = (x: number, z: number): [number, number] => [W / 2 + (x - cx) * k, H / 2 + (z - cz) * k];
    g.fillStyle = '#2b2f33';
    g.fillRect(0, 0, W, H);
    g.drawImage(mini.map, ...at(-h, -h), 2 * h * k, 2 * h * k);
    const mark = (p: THREE.Vector3, color: string, r: number, shape: 'dot' | 'square' | 'diamond') => {
      const [x, y] = at(p.x, p.z);
      g.fillStyle = color;
      g.strokeStyle = 'rgba(0,0,0,0.8)';
      g.lineWidth = 2;
      g.beginPath();
      if (shape === 'square') g.rect(x - r, y - r, r * 2, r * 2);
      else if (shape === 'diamond') [[0, -r], [r, 0], [0, r], [-r, 0]].forEach(([a, b], i) => (i ? g.lineTo(x + a, y + b) : g.moveTo(x + a, y + b)));
      else g.arc(x, y, r, 0, Math.PI * 2);
      g.closePath();
      g.fill();
      g.stroke();
    };
    for (const m of s.supplies) mark(m.pos, m.kind === 'medkit' ? '#3fdf6a' : '#f0b43a', 5, 'square');
    for (const a of s.allies) mark(a, '#5aa8ff', 6, 'dot');
    if (s.goal) mark(s.goal, '#ffb547', 11, 'diamond');
    const [px, py] = at(s.player.x, s.player.z);
    g.save();
    g.translate(px, py);
    g.rotate(Math.atan2(s.forward.x, -s.forward.z));
    g.fillStyle = '#f2ede2';
    g.strokeStyle = 'rgba(0,0,0,0.9)';
    g.beginPath();
    g.moveTo(0, -12); g.lineTo(8, 8); g.lineTo(0, 3); g.lineTo(-8, 8);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  };

  const open = () => {
    s = snap();
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    cv.width = Math.round(innerWidth * 0.86);
    cv.height = Math.round(innerHeight * 0.74);
    k = Math.min(cv.width, cv.height) / (2 * mini.half) * 1.6;
    cx = s.player.x;
    cz = s.player.z;
    root.classList.add('on');
    draw();
  };
  const close = () => root.classList.remove('on');
  const shown = () => root.classList.contains('on');

  btn.addEventListener('click', (e) => (e.stopPropagation(), open()));
  root.querySelector('button')!.addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM' && !document.body.classList.contains('lost')) shown() ? close() : open();
    else if (e.code === 'Escape' && shown()) close();
  });
  cv.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = cv.getBoundingClientRect(), mx = e.clientX - r.left - cv.width / 2, my = e.clientY - r.top - cv.height / 2;
    const wx = cx + mx / k, wz = cz + my / k, min = Math.min(cv.width, cv.height) / (2 * mini.half);
    k = THREE.MathUtils.clamp(k * (e.deltaY < 0 ? 1.2 : 1 / 1.2), min, 12);
    cx = wx - mx / k;
    cz = wz - my / k;
    draw();
  }, { passive: false });
  cv.addEventListener('pointerdown', (e) => (drag = [e.clientX, e.clientY], cv.setPointerCapture(e.pointerId)));
  cv.addEventListener('pointermove', (e) => {
    if (!drag) return;
    cx -= (e.clientX - drag[0]) / k;
    cz -= (e.clientY - drag[1]) / k;
    drag = [e.clientX, e.clientY];
    draw();
  });
  cv.addEventListener('pointerup', () => (drag = null));
}
