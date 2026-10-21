import type { SignDef } from './signs';

/** A row of four identical fluorescent concert bills, Lima "chicha" style. */
export function concert(d: SignDef, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const pw = w / 4;
  for (let k = 0; k < 4; k++) {
    const x0 = k * pw + 2;
    ctx.fillStyle = d.bg!;
    ctx.fillRect(x0, 2 + (k % 2), pw - 4, h - 4);
    ctx.fillStyle = d.accent!;
    ctx.fillRect(x0, h * 0.68, pw - 4, h * 0.24);
    ctx.fillStyle = d.fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const words = d.text.split(' ');
    const half = Math.ceil(words.length / 2);
    ctx.font = `bold ${Math.floor(h * 0.24)}px Impact, "Arial Black", sans-serif`;
    ctx.fillText(words.slice(0, half).join(' '), x0 + pw / 2, h * 0.3, pw - 12);
    ctx.fillText(words.slice(half).join(' '), x0 + pw / 2, h * 0.52, pw - 12);
    ctx.font = `bold ${Math.floor(h * 0.1)}px Arial, sans-serif`;
    ctx.fillText(d.sub ?? '', x0 + pw / 2, h * 0.8, pw - 10);
    ctx.fillText('★ EN CONCIERTO ★', x0 + pw / 2, h * 0.1, pw - 10);
  }
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 18, 1 + Math.random() * 5);
  }
  return c;
}

/** Hand-painted "chicha" sign: fluorescent bands, fat outlined letters, little stars. */
export function chicha(d: SignDef, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const bands = [d.bg!, d.accent!, '#111111', d.accent!, d.bg!];
  const heights = [0.06, 0.04, 0.8, 0.04, 0.06];
  let y = 0;
  bands.forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.fillRect(0, y, w, heights[i] * h + 1);
    y += heights[i] * h;
  });
  const g = ctx.createLinearGradient(0, h * 0.1, 0, h * 0.9);
  g.addColorStop(0, d.bg!);
  g.addColorStop(1, d.accent!);
  ctx.fillStyle = g;
  ctx.fillRect(6, h * 0.14, w - 12, h * 0.72);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.font = `900 ${Math.floor(h * 0.34)}px Impact, "Arial Black", sans-serif`;
  ctx.lineWidth = h * 0.11;
  ctx.strokeStyle = '#111111';
  ctx.strokeText(d.text, w / 2, h * 0.42, w - 40);
  ctx.lineWidth = h * 0.05;
  ctx.strokeStyle = '#ffffff';
  ctx.strokeText(d.text, w / 2, h * 0.42, w - 40);
  ctx.fillStyle = d.fg;
  ctx.fillText(d.text, w / 2, h * 0.42, w - 40);
  ctx.font = `bold ${Math.floor(h * 0.12)}px Arial, sans-serif`;
  ctx.fillStyle = '#111111';
  ctx.fillText(d.sub ?? '', w / 2, h * 0.73, w - 60);
  ctx.fillStyle = '#ffffff';
  for (const x of [w * 0.05, w * 0.95]) {
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const r = k % 2 ? h * 0.05 : h * 0.12, a = (k / 10) * Math.PI * 2 - Math.PI / 2;
      ctx.lineTo(x + Math.cos(a) * r, h * 0.45 + Math.sin(a) * r);
    }
    ctx.fill();
  }
  return c;
}

/** Chalkboard in a wooden frame: price on the left, dishes chalked on the right. */
export function menu(d: SignDef, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#6b4526';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = d.bg!;
  ctx.fillRect(7, 7, w - 14, h - 14);
  for (let i = 0; i < 120; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 4 + Math.random() * 30, 1 + Math.random() * 3);
  }
  ctx.fillStyle = d.fg;
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.floor(h * 0.3)}px "Comic Sans MS", "Segoe Print", cursive`;
  ctx.fillText(d.text, 18, h * 0.42, w * 0.3);
  ctx.fillStyle = '#f2c230';
  ctx.font = `${Math.floor(h * 0.13)}px "Comic Sans MS", cursive`;
  ctx.fillText('★ DEL DÍA ★', 18, h * 0.75, w * 0.3);
  ctx.fillStyle = d.fg;
  ctx.font = `${Math.floor(h * 0.12)}px "Comic Sans MS", "Segoe Print", cursive`;
  (d.sub ?? '').split(' · ').forEach((line, i) => ctx.fillText(`· ${line}`, w * 0.36, h * (0.22 + i * 0.2), w * 0.62));
  ctx.fillStyle = '#9fd3ff';
  ctx.fillText(d.accent ?? '', w * 0.36, h * 0.84, w * 0.62);
  return c;
}

/** A strip of four printed decrees glued to the wall, a bit torn and dirty. */
export function curfew(d: SignDef, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const pw = w / 4;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let k = 0; k < 4; k++) {
    const x0 = k * pw + 4, torn = Math.random() < 0.35 ? h * (0.15 + Math.random() * 0.2) : 0;
    ctx.fillStyle = d.bg!;
    ctx.fillRect(x0, 3 + torn * 0.2, pw - 8, h - 6 - torn);
    ctx.fillStyle = '#c8102e';
    ctx.fillRect(x0, 3, pw - 8, h * 0.08);
    ctx.fillStyle = d.fg;
    ctx.font = `bold ${Math.floor(h * 0.07)}px Arial, sans-serif`;
    ctx.fillText('REPÚBLICA DEL PERÚ · COMUNICADO', x0 + pw / 2 - 4, h * 0.17, pw - 16);
    ctx.font = `900 ${Math.floor(h * 0.17)}px "Arial Black", Impact, sans-serif`;
    ctx.fillText(d.text, x0 + pw / 2 - 4, h * 0.36, pw - 16);
    ctx.fillStyle = '#c8102e';
    ctx.font = `bold ${Math.floor(h * 0.12)}px Arial, sans-serif`;
    ctx.fillText(d.sub ?? '', x0 + pw / 2 - 4, h * 0.56, pw - 16);
    ctx.fillStyle = '#333333';
    ctx.font = `${Math.floor(h * 0.065)}px Arial, sans-serif`;
    ctx.fillText(d.accent ?? '', x0 + pw / 2 - 4, h * 0.74, pw - 16);
    for (let i = 0; i < 5; i++) ctx.fillRect(x0 + 12, h * (0.8 + i * 0.03), (pw - 32) * (0.5 + Math.random() * 0.5), 1.5);
  }
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(60,45,30,${Math.random() * 0.14})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 16, 1 + Math.random() * 6);
  }
  return c;
}

/** Red cloth square (centre of a 4:1 cell) carrying a yellow hammer and sickle. */
export function flag(d: SignDef, w: number, h: number): HTMLCanvasElement {
  const c = emblem(d, w, h), ctx = c.getContext('2d')!;
  const sym = document.createElement('canvas');
  sym.width = w;
  sym.height = h;
  sym.getContext('2d')!.drawImage(c, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = d.bg!;
  ctx.fillRect(w / 2 - h / 2, 0, h, h);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`;
    ctx.fillRect(w / 2 - h / 2, Math.random() * h, h, 2 + Math.random() * 4);
  }
  ctx.drawImage(sym, w / 2 - h / 2, 0, h, h, w / 2 - h * 0.35, h * 0.15, h * 0.7, h * 0.7);
  return c;
}

/** Whitewashed hammer and sickle painted on a hillside, centred in a 4:1 cell. */
export function emblem(d: SignDef, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.translate(w / 2, h / 2);
  ctx.scale(h, h);
  ctx.fillStyle = ctx.strokeStyle = d.fg;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  ctx.beginPath();
  ctx.arc(0, 0, 0.36, rad(-125), rad(128));
  ctx.arc(-0.05, -0.05, 0.27, rad(128), rad(-125), true);
  ctx.fill();
  ctx.lineCap = 'round';
  ctx.lineWidth = 0.085;
  ctx.beginPath();
  ctx.moveTo(-0.2, 0.26);
  ctx.lineTo(-0.36, 0.42);
  ctx.stroke();
  ctx.save();
  ctx.rotate(rad(-45));
  ctx.fillRect(-0.04, -0.22, 0.08, 0.66);
  ctx.fillRect(-0.2, -0.34, 0.33, 0.13);
  ctx.restore();
  return c;
}

export function poster(d: SignDef, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = d.bg!;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = d.accent!;
  ctx.fillRect(0, h * 0.84, w, h * 0.16);
  ctx.beginPath();
  ctx.arc(h * 0.45, h * 0.42, h * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = d.bg!;
  ctx.font = `bold ${Math.floor(h * 0.32)}px "Arial Black", Impact, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('★', h * 0.45, h * 0.44);
  ctx.fillStyle = d.fg;
  ctx.textAlign = 'left';
  ctx.font = `bold ${Math.floor(h * 0.38)}px "Arial Black", Impact, sans-serif`;
  ctx.fillText(d.text, h * 0.9, h * 0.4, w - h * 1.0);
  ctx.font = `bold ${Math.floor(h * 0.12)}px Arial, sans-serif`;
  ctx.fillStyle = d.bg === '#e9e6df' || d.bg === '#f0f0f0' ? '#ffffff' : d.fg;
  ctx.fillText(d.sub ?? '', h * 0.9, h * 0.92, w - h * 1.0);
  for (let i = 0; i < 300; i++) {
    ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.12})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 20, 1 + Math.random() * 6);
  }
  return c;
}

