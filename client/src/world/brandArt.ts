import type { SignDef } from './signs';

type Ctx = CanvasRenderingContext2D;

function dark(hex: string): boolean {
  const n = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16);
  return 0.3 * (n >> 16) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255) < 140;
}

function text(c: Ctx, s: string, x: number, y: number, size: number, color: string, opts: { font?: string; weight?: string; align?: CanvasTextAlign; max?: number; italic?: boolean } = {}): void {
  c.font = `${opts.italic ? 'italic ' : ''}${opts.weight ?? '900'} ${size}px ${opts.font ?? '"Arial Black", Arial, sans-serif'}`;
  c.fillStyle = color;
  c.textAlign = opts.align ?? 'left';
  c.textBaseline = 'middle';
  c.fillText(s, x, y, opts.max);
}

function round(c: Ctx, x: number, y: number, w: number, h: number, r: number, color: string): void {
  c.fillStyle = color;
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fill();
}

/** Look-alike shop fronts of well-known Peruvian brands, with the names changed. `d.style` picks the layout. */
const STYLES: Record<string, (c: Ctx, d: SignDef, w: number, h: number) => void> = {
  bcb(c, d, w, h) {
    c.fillStyle = '#002a8d';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#ff7800';
    c.beginPath();
    c.moveTo(w * 0.07, h * 0.22);
    c.lineTo(w * 0.17, h * 0.5);
    c.lineTo(w * 0.07, h * 0.78);
    c.lineTo(w * 0.12, h * 0.78);
    c.lineTo(w * 0.22, h * 0.5);
    c.lineTo(w * 0.12, h * 0.22);
    c.fill();
    text(c, d.text, w * 0.27, h * 0.52, h * 0.62, '#ffffff', { italic: true, max: w * 0.68 });
  },
  agente(c, d, w, h) {
    c.fillStyle = '#ff7800';
    c.fillRect(0, 0, w, h);
    text(c, 'AGENTE', w * 0.05, h * 0.52, h * 0.42, '#002a8d', { max: w * 0.45 });
    round(c, w * 0.55, h * 0.16, w * 0.4, h * 0.68, 10, '#002a8d');
    text(c, d.text.replace(/^AGENTE /i, ''), w * 0.75, h * 0.52, h * 0.46, '#ffffff', { align: 'center', italic: true, max: w * 0.36 });
  },
  tumbo(c, d, w, h) {
    c.fillStyle = '#6b1d7b';
    c.fillRect(0, 0, w, h);
    text(c, d.text, w * 0.42, h * 0.52, h * 0.66, '#ffffff', { font: '"Arial Rounded MT Bold", "Trebuchet MS", Arial, sans-serif', weight: '800', align: 'center', max: w * 0.6 });
    text(c, '+', w * 0.8, h * 0.48, h * 0.95, '#ffd100', { align: 'center' });
  },
  mostro(c, d, w, h) {
    c.fillStyle = '#e30613';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffd200';
    c.beginPath();
    c.ellipse(w / 2, h / 2, w * 0.36, h * 0.4, 0, 0, Math.PI * 2);
    c.fill();
    text(c, d.text, w / 2, h * 0.53, h * 0.56, '#e30613', { align: 'center', italic: true, max: w * 0.62 });
  },
  plazavia(c, d, w, h) {
    c.fillStyle = '#e1251b';
    c.fillRect(0, 0, w, h);
    const [a, b] = d.text.split(' ');
    text(c, a, w * 0.08, h * 0.48, h * 0.48, '#ffffff', { font: 'Arial, sans-serif', weight: '700', max: w * 0.4 });
    text(c, b ?? '', w * 0.5, h * 0.46, h * 0.62, '#ffffff', { font: 'Georgia, serif', weight: '900', italic: true, max: w * 0.45 });
    c.strokeStyle = '#ffd200';
    c.lineWidth = h * 0.07;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(w * 0.1, h * 0.8);
    c.quadraticCurveTo(w * 0.5, h * 0.95, w * 0.9, h * 0.75);
    c.stroke();
  },
  inkaforma(c, d, w, h) {
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#009a44';
    c.fillRect(0, h * 0.86, w, h * 0.14);
    const cx = w * 0.12, cy = h * 0.46, s = h * 0.32;
    c.fillRect(cx - s / 3, cy - s, (s * 2) / 3, s * 2);
    c.fillRect(cx - s, cy - s / 3, s * 2, (s * 2) / 3);
    c.fillStyle = '#ffd100';
    c.beginPath();
    c.arc(cx, cy, s * 0.28, 0, Math.PI * 2);
    c.fill();
    text(c, d.text, w * 0.25, h * 0.46, h * 0.5, '#009a44', { max: w * 0.72 });
  },
  cloro(c, d, w, h) {
    c.fillStyle = '#da291c';
    c.fillRect(0, 0, w, h);
    text(c, d.text, w * 0.42, h * 0.55, h * 0.62, '#ffffff', { font: 'Arial, sans-serif', weight: '700', align: 'center', max: w * 0.55 });
    c.strokeStyle = '#ffffff';
    c.lineWidth = h * 0.06;
    c.lineCap = 'round';
    for (const a of [-0.9, -0.45, 0]) {
      c.beginPath();
      c.moveTo(w * 0.78 + Math.cos(a - 1.2) * h * 0.2, h * 0.36 + Math.sin(a - 1.2) * h * 0.2);
      c.lineTo(w * 0.78 + Math.cos(a - 1.2) * h * 0.38, h * 0.36 + Math.sin(a - 1.2) * h * 0.38);
      c.stroke();
    }
  },
  movistor(c, d, w, h) {
    c.fillStyle = '#019df4';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#ffffff';
    c.lineWidth = h * 0.1;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(w * 0.06, h * 0.72);
    c.bezierCurveTo(w * 0.08, h * 0.15, w * 0.13, h * 0.15, w * 0.15, h * 0.55);
    c.bezierCurveTo(w * 0.17, h * 0.15, w * 0.22, h * 0.15, w * 0.24, h * 0.72);
    c.stroke();
    text(c, d.text, w * 0.3, h * 0.52, h * 0.52, '#ffffff', { font: 'Arial, sans-serif', weight: '700', max: w * 0.66 });
  },
  bitol(c, d, w, h) {
    c.fillStyle = '#ffd400';
    c.fillRect(0, 0, w, h);
    round(c, w * 0.05, h * 0.15, w * 0.9, h * 0.7, h * 0.35, '#00337f');
    text(c, d.text, w / 2, h * 0.52, h * 0.5, '#ffd400', { align: 'center', max: w * 0.8 });
  },
  interbunk(c, d, w, h) {
    c.fillStyle = '#00a54f';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#0a3a8c';
    c.fillRect(0, h * 0.72, w, h * 0.28);
    text(c, d.text, w * 0.06, h * 0.4, h * 0.46, '#ffffff', { font: 'Arial, sans-serif', weight: '700', max: w * 0.88 });
    text(c, 'AGENTE · CAJERO', w * 0.06, h * 0.86, h * 0.14, '#ffffff', { font: 'Arial, sans-serif', weight: '700' });
  },
  kff(c, d, w, h) {
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#c8102e';
    for (let x = 0; x < w * 0.3; x += w * 0.06) c.fillRect(x, 0, w * 0.03, h);
    text(c, d.text, w * 0.62, h * 0.52, h * 0.62, '#c8102e', { align: 'center', max: w * 0.6 });
  },
  pollo(c, d, w, h) {
    c.fillStyle = d.bg ?? '#7a2a10';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = d.accent ?? '#ffd100';
    c.lineWidth = 6;
    c.strokeRect(10, 10, w - 20, h - 20);
    text(c, d.text, w / 2, h * 0.47, h * 0.46, d.fg, { font: 'Georgia, serif', weight: '900', italic: true, align: 'center', max: w * 0.85 });
    text(c, d.sub ?? '', w / 2, h * 0.78, h * 0.14, d.accent ?? '#ffd100', { font: 'Arial, sans-serif', weight: '700', align: 'center', max: w * 0.8 });
  },
  yapo(c, d, w, h) {
    c.fillStyle = '#742284';
    c.fillRect(0, 0, w, h);
    text(c, 'AQUÍ', w * 0.06, h * 0.5, h * 0.3, '#ffffff', { font: 'Arial, sans-serif', weight: '700' });
    round(c, w * 0.32, h * 0.14, w * 0.62, h * 0.72, h * 0.3, '#00d1c1');
    text(c, d.text, w * 0.63, h * 0.52, h * 0.52, '#742284', { font: '"Arial Rounded MT Bold", Arial, sans-serif', weight: '900', align: 'center', max: w * 0.56 });
  },
  /** Generic look-alike: colours from the data, `font` (sans/italic/round/serif/script) and an accent `shape`. */
  logo(c, d, w, h) {
    c.fillStyle = d.bg ?? '#ffffff';
    c.fillRect(0, 0, w, h);
    const acc = d.accent ?? d.fg, shape = d.shape ?? 'bar';
    let x = w / 2, max = w * 0.86;
    if (shape === 'bar') {
      c.fillStyle = acc;
      c.fillRect(0, h * 0.74, w, h * 0.26);
    } else if (shape === 'pill') round(c, w * 0.06, h * 0.14, w * 0.88, h * 0.72, h * 0.36, acc);
    else if (shape === 'circle') {
      c.fillStyle = acc;
      c.beginPath();
      c.arc(w * 0.12, h / 2, h * 0.34, 0, Math.PI * 2);
      c.fill();
      text(c, d.text[0], w * 0.12, h * 0.53, h * 0.44, d.bg ?? '#fff', { align: 'center' });
      [x, max] = [w * 0.58, w * 0.72];
    } else if (shape === 'swoosh') {
      c.strokeStyle = acc;
      c.lineWidth = h * 0.08;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(w * 0.12, h * 0.88);
      c.quadraticCurveTo(w * 0.5, h * 1.0, w * 0.88, h * 0.84);
      c.stroke();
    } else if (shape === 'stripes') {
      c.fillStyle = acc;
      for (let k = 0; k < 3; k++) c.fillRect(0, h * (0.1 + k * 0.32), w * 0.18, h * 0.16);
      [x, max] = [w * 0.6, w * 0.72];
    } else if (shape === 'star') {
      c.fillStyle = acc;
      c.beginPath();
      for (let k = 0; k < 10; k++) {
        const r = k % 2 ? h * 0.14 : h * 0.34, a = (k / 10) * Math.PI * 2 - Math.PI / 2;
        c.lineTo(w * 0.12 + Math.cos(a) * r, h / 2 + Math.sin(a) * r);
      }
      c.fill();
      [x, max] = [w * 0.58, w * 0.72];
    }
    const fonts: Record<string, [string, string, boolean]> = {
      sans: ['Arial, sans-serif', '700', false], italic: ['"Arial Black", Arial, sans-serif', '900', true], round: ['"Arial Rounded MT Bold", "Trebuchet MS", Arial, sans-serif', '800', false],
      serif: ['Georgia, serif', '900', false], script: ['"Brush Script MT", "Segoe Script", cursive', '700', true], heavy: ['"Arial Black", Impact, sans-serif', '900', false],
    };
    const [font, weight, italic] = fonts[d.font ?? 'heavy'] ?? fonts.heavy;
    const ink = shape === 'pill' && d.fg === acc ? d.bg ?? '#fff' : d.fg;
    const low = shape === 'bar' || shape === 'swoosh';
    text(c, d.text, x, h * (low ? 0.38 : 0.47), h * (d.sub ? 0.44 : 0.56), ink, { font, weight, italic, align: 'center', max });
    if (d.sub) text(c, d.sub, x, h * (shape === 'bar' ? 0.87 : shape === 'swoosh' ? 0.7 : 0.8), h * 0.13, shape === 'bar' ? (dark(acc) ? '#ffffff' : '#1a1a1a') : ink, { font: 'Arial, sans-serif', weight: '700', align: 'center', max });
  },
};

export function brand(d: SignDef, w: number, h: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const c = cv.getContext('2d')!;
  (STYLES[d.style!] ?? STYLES.pollo)(c, d, w, h);
  c.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 260; i++) {
    c.fillStyle = `rgba(0,0,0,${Math.random() * 0.35})`;
    c.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 4, 1 + Math.random() * 3);
  }
  return cv;
}
