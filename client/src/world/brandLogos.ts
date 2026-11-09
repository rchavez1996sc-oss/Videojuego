import type { SignDef } from './signs';

type Ctx = CanvasRenderingContext2D;
type Draw = (c: Ctx, d: SignDef, w: number, h: number) => void;

const ROUND = '"Fredoka", "Arial Rounded MT Bold", Arial, sans-serif', SCRIPT = '"Lobster", "Brush Script MT", cursive';
const HEAVY = '"Montserrat", "Arial Black", Arial, sans-serif', COND = '"Oswald", "Barlow Condensed", Impact, sans-serif', SERIF = 'Georgia, "Times New Roman", serif';

/** Text centred at (x, y): fill, optional outline drawn under it, squeezed into `max`. */
function word(c: Ctx, s: string, x: number, y: number, size: number, fill: string, font: string, weight = '800', o: { max?: number; stroke?: string; line?: number; italic?: boolean; align?: CanvasTextAlign; spacing?: number } = {}): void {
  c.font = `${o.italic ? 'italic ' : ''}${weight} ${size}px ${font}`;
  c.textAlign = o.align ?? 'center';
  c.textBaseline = 'middle';
  (c as Ctx & { letterSpacing: string }).letterSpacing = `${o.spacing ?? 0}px`;
  if (o.stroke) {
    c.lineJoin = 'round';
    c.lineWidth = o.line ?? size * 0.14;
    c.strokeStyle = o.stroke;
    c.strokeText(s, x, y, o.max);
  }
  c.fillStyle = fill;
  c.fillText(s, x, y, o.max);
  (c as Ctx & { letterSpacing: string }).letterSpacing = '0px';
}
const fill = (c: Ctx, color: string, x: number, y: number, w: number, h: number) => ((c.fillStyle = color), c.fillRect(x, y, w, h));
function ellipse(c: Ctx, x: number, y: number, rx: number, ry: number, color: string, stroke?: string, lw = 0): void {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fillStyle = color;
  c.fill();
  if (stroke) [c.strokeStyle, c.lineWidth] = [stroke, lw], c.stroke();
}
const sub = (c: Ctx, d: SignDef, w: number, h: number, color: string, y = 0.86) => d.sub && word(c, d.sub, w / 2, h * y, h * 0.12, color, HEAVY, '700', { max: w * 0.8, spacing: h * 0.01 });

/**
 * Closer look-alikes of the real Peruvian chain signs (typeface, case, colours and the mark beside the name), by
 * brand; `brand` uses these before the generic `logo` layout.
 */
export const LOGOS: Record<string, Draw> = {
  tottus(c, _d, w, h) {
    fill(c, '#00a04b', 0, 0, w, h);
    word(c, 'tottus', w / 2, h * 0.46, h * 0.7, '#ffffff', ROUND, '700', { max: w * 0.8 });
    ellipse(c, w * 0.79, h * 0.24, h * 0.07, h * 0.07, '#ffcb05');
  },
  wong(c, _d, w, h) {
    fill(c, '#d50f25', 0, 0, w, h);
    word(c, 'Wong', w / 2, h * 0.46, h * 0.72, '#ffffff', SERIF, '700', { max: w * 0.7 });
    fill(c, '#ffffff', w * 0.32, h * 0.8, w * 0.36, h * 0.03);
  },
  'real plaza'(c, _d, w, h) {
    fill(c, '#ffffff', 0, 0, w, h);
    ellipse(c, w * 0.14, h * 0.5, h * 0.3, h * 0.3, '#e1251b');
    word(c, 'r', w * 0.14, h * 0.45, h * 0.46, '#ffffff', ROUND, '700');
    word(c, 'real plaza', w * 0.59, h * 0.5, h * 0.5, '#e1251b', HEAVY, '900', { max: w * 0.7 });
  },
  saga(c, _d, w, h) {
    fill(c, '#ffffff', 0, 0, w, h);
    word(c, 'saga', w * 0.25, h * 0.5, h * 0.5, '#3c3c3b', HEAVY, '800', { max: w * 0.3 });
    word(c, 'falabella', w * 0.66, h * 0.5, h * 0.5, '#2a9d3e', ROUND, '600', { max: w * 0.5 });
    ellipse(c, w * 0.93, h * 0.64, h * 0.05, h * 0.05, '#2a9d3e');
  },
  ripley(c, _d, w, h) {
    fill(c, '#1d1d1b', 0, 0, w, h);
    word(c, 'Ripley', w / 2, h * 0.5, h * 0.66, '#ffffff', HEAVY, '900', { max: w * 0.76, italic: true });
    fill(c, '#7b3fa0', 0, h * 0.9, w, h * 0.1);
  },
  promart(c, _d, w, h) {
    fill(c, '#ff6a00', 0, 0, w, h);
    word(c, 'promart', w / 2, h * 0.5, h * 0.58, '#ffffff', HEAVY, '900', { max: w * 0.76 });
    c.strokeStyle = '#ffffff';
    c.lineWidth = h * 0.05;
    c.beginPath();
    c.moveTo(w * 0.36, h * 0.2);
    c.lineTo(w * 0.42, h * 0.08);
    c.lineTo(w * 0.48, h * 0.2);
    c.stroke();
    word(c, 'HOMECENTER', w / 2, h * 0.88, h * 0.11, '#ffffff', HEAVY, '700', { spacing: h * 0.02 });
  },
  sodimac(c, _d, w, h) {
    fill(c, '#0056a4', 0, 0, w, h);
    word(c, 'SODIMAC', w / 2, h * 0.4, h * 0.5, '#ffffff', HEAVY, '900', { max: w * 0.82, spacing: h * 0.02 });
    fill(c, '#e30613', 0, h * 0.72, w, h * 0.28);
    word(c, 'HOMECENTER', w / 2, h * 0.86, h * 0.16, '#ffffff', HEAVY, '800', { spacing: h * 0.03 });
  },
  bembos(c, _d, w, h) {
    fill(c, '#0a3a8c', 0, 0, w, h);
    word(c, 'bembos', w / 2, h * 0.48, h * 0.62, '#ffd200', ROUND, '700', { stroke: '#e30613', max: w * 0.8 });
  },
  "domino's"(c, _d, w, h) {
    fill(c, '#006491', 0, 0, w, h);
    c.save();
    c.translate(w * 0.13, h * 0.5);
    c.rotate(-0.7);
    fill(c, '#e31837', -h * 0.17, -h * 0.34, h * 0.34, h * 0.34);
    fill(c, '#0b7ab8', -h * 0.17, 0, h * 0.34, h * 0.34);
    c.strokeStyle = '#ffffff';
    c.lineWidth = h * 0.04;
    c.strokeRect(-h * 0.17, -h * 0.34, h * 0.34, h * 0.68);
    ellipse(c, 0, -h * 0.17, h * 0.05, h * 0.05, '#ffffff');
    ellipse(c, -h * 0.07, h * 0.1, h * 0.05, h * 0.05, '#ffffff');
    ellipse(c, h * 0.07, h * 0.24, h * 0.05, h * 0.05, '#ffffff');
    c.restore();
    word(c, "Domino's", w * 0.6, h * 0.5, h * 0.48, '#ffffff', HEAVY, '800', { max: w * 0.66 });
  },
  'inca kola'(c, _d, w, h) {
    fill(c, '#ffd100', 0, 0, w, h);
    for (const y of [0, h * 0.86]) {
      fill(c, '#1c3f94', 0, y, w, h * 0.14);
      c.fillStyle = '#ffffff';
      for (let x = 0; x < w; x += h * 0.2) c.fillRect(x + h * 0.05, y + h * 0.04, h * 0.08, h * 0.06);
    }
    word(c, 'Inca Kola', w / 2, h * 0.5, h * 0.52, '#1c3f94', SCRIPT, '400', { stroke: '#ffffff', max: w * 0.84 });
  },
  pilsen(c, _d, w, h) {
    fill(c, '#004b32', 0, 0, w, h);
    ellipse(c, w / 2, h * 0.47, w * 0.3, h * 0.38, '#004b32', '#d4af37', h * 0.05);
    word(c, 'Pilsen', w / 2, h * 0.43, h * 0.46, '#ffffff', SERIF, '700', { max: w * 0.5 });
    word(c, 'CALLAO', w / 2, h * 0.73, h * 0.14, '#d4af37', SERIF, '700', { spacing: h * 0.03 });
  },
  cristal(c, d, w, h) {
    fill(c, '#e30613', 0, 0, w, h);
    word(c, 'Cristal', w / 2, h * 0.44, h * 0.62, '#ffffff', SCRIPT, '400', { stroke: '#0a3a8c', max: w * 0.8 });
    sub(c, d, w, h, '#ffffff');
  },
  gloria(c, _d, w, h) {
    fill(c, '#ffffff', 0, 0, w, h);
    ellipse(c, w / 2, h / 2, w * 0.4, h * 0.4, '#0a3a8c', '#e30613', h * 0.07);
    word(c, 'Gloria', w / 2, h * 0.5, h * 0.52, '#ffffff', SCRIPT, '400', { max: w * 0.6 });
  },
  "d'onofrio"(c, d, w, h) {
    fill(c, '#ffd400', 0, 0, w, h);
    word(c, "D'Onofrio", w / 2, h * 0.44, h * 0.6, '#d0021b', SCRIPT, '400', { max: w * 0.84 });
    sub(c, d, w, h, '#d0021b');
  },
  scotiabank(c, _d, w, h) {
    fill(c, '#ec111a', 0, 0, w, h);
    ellipse(c, w * 0.11, h * 0.5, h * 0.3, h * 0.3, '#ffffff');
    word(c, 'S', w * 0.11, h * 0.52, h * 0.44, '#ec111a', HEAVY, '900');
    word(c, 'Scotiabank', w * 0.58, h * 0.5, h * 0.46, '#ffffff', HEAVY, '700', { max: w * 0.72 });
  },
  bbva(c, _d, w, h) {
    fill(c, '#072146', 0, 0, w, h);
    word(c, 'BBVA', w / 2, h * 0.5, h * 0.6, '#ffffff', HEAVY, '900', { spacing: h * 0.06, max: w * 0.7 });
  },
  mibanco(c, _d, w, h) {
    fill(c, '#ffffff', 0, 0, w, h);
    word(c, 'mi', w * 0.27, h * 0.48, h * 0.6, '#ffc20e', ROUND, '700', { align: 'right' });
    word(c, 'banco', w * 0.27, h * 0.48, h * 0.6, '#00843d', ROUND, '700', { align: 'left' });
    fill(c, '#00843d', 0, h * 0.86, w, h * 0.14);
  },
  entel(c, _d, w, h) {
    fill(c, '#0019ff', 0, 0, w, h);
    word(c, 'entel', w / 2, h * 0.46, h * 0.66, '#ffffff', ROUND, '600', { max: w * 0.7 });
    ellipse(c, w * 0.72, h * 0.66, h * 0.06, h * 0.06, '#ff7a00');
  },
  hiraoka(c, _d, w, h) {
    fill(c, '#e30613', 0, 0, w, h);
    word(c, 'HIRAOKA', w / 2, h * 0.5, h * 0.54, '#ffffff', HEAVY, '900', { spacing: h * 0.04, max: w * 0.84 });
  },
  'arcángel'(c, d, w, h) {
    fill(c, '#ffffff', 0, 0, w, h);
    fill(c, '#00843d', w * 0.07, h * 0.38, h * 0.48, h * 0.16);
    fill(c, '#00843d', w * 0.07 + h * 0.16, h * 0.22, h * 0.16, h * 0.48);
    word(c, 'Arcángel', w * 0.6, h * 0.46, h * 0.5, '#00843d', HEAVY, '800', { max: w * 0.66 });
    sub(c, d, w, h, '#00843d', 0.82);
  },
  mifarma(c, _d, w, h) {
    fill(c, '#ffffff', 0, 0, w, h);
    word(c, 'mi', w * 0.38, h * 0.5, h * 0.6, '#0055a5', ROUND, '700', { align: 'right' });
    word(c, 'farma', w * 0.38, h * 0.5, h * 0.6, '#e30613', ROUND, '700', { align: 'left' });
    ellipse(c, w * 0.12, h * 0.5, h * 0.24, h * 0.24, '#e30613');
    fill(c, '#ffffff', w * 0.12 - h * 0.15, h * 0.46, h * 0.3, h * 0.08);
    fill(c, '#ffffff', w * 0.12 - h * 0.04, h * 0.35, h * 0.08, h * 0.3);
  },
  topitop(c, _d, w, h) {
    fill(c, '#e30613', 0, 0, w, h);
    word(c, 'TOPITOP', w / 2, h * 0.5, h * 0.54, '#ffffff', HEAVY, '900', { italic: true, max: w * 0.84 });
  },
  'rímac'(c, d, w, h) {
    fill(c, '#e30613', 0, 0, w, h);
    word(c, 'RIMAC', w / 2, h * 0.42, h * 0.56, '#ffffff', HEAVY, '900', { spacing: h * 0.05, max: w * 0.7 });
    sub(c, d, w, h, '#ffffff', 0.82);
  },
  'pacífico'(c, d, w, h) {
    fill(c, '#0055a5', 0, 0, w, h);
    c.strokeStyle = '#7ec8e3';
    c.lineWidth = h * 0.05;
    for (const k of [0, 1]) {
      c.beginPath();
      for (let x = w * 0.05; x <= w * 0.2; x += 2) c.lineTo(x, h * (0.42 + k * 0.18) + Math.sin(x / (h * 0.08)) * h * 0.06);
      c.stroke();
    }
    word(c, 'Pacífico', w * 0.58, h * 0.46, h * 0.5, '#ffffff', HEAVY, '800', { max: w * 0.66 });
    sub(c, d, w, h, '#ffffff', 0.84);
  },
  chinawok(c, _d, w, h) {
    fill(c, '#c8102e', 0, 0, w, h);
    word(c, 'CHINAWOK', w * 0.55, h * 0.5, h * 0.62, '#ffd200', COND, '700', { max: w * 0.7, spacing: h * 0.02 });
    c.strokeStyle = '#1d1d1b';
    c.lineWidth = h * 0.05;
    for (const k of [0, 1]) [c.beginPath(), c.moveTo(w * (0.05 + k * 0.04), h * 0.85), c.lineTo(w * (0.13 + k * 0.04), h * 0.15), c.stroke()];
  },
  "roky's"(c, d, w, h) {
    fill(c, '#e30613', 0, 0, w, h);
    word(c, "Roky's", w / 2, h * 0.44, h * 0.64, '#ffd200', SCRIPT, '400', { stroke: '#1d1d1b', max: w * 0.8 });
    sub(c, d, w, h, '#ffffff');
  },
  sublime(c, _d, w, h) {
    fill(c, '#c8102e', 0, 0, w, h);
    fill(c, '#4a2412', 0, h * 0.72, w, h * 0.28);
    word(c, 'Sublime', w / 2, h * 0.4, h * 0.56, '#ffffff', SCRIPT, '400', { stroke: '#4a2412', max: w * 0.76 });
    word(c, 'CHOCOLATE CON MANÍ', w / 2, h * 0.86, h * 0.12, '#ffd28a', HEAVY, '700');
  },
  oxxo(c, d, w, h) {
    fill(c, '#d8261d', 0, 0, w, h);
    fill(c, '#f6c518', 0, 0, w, h * 0.12);
    fill(c, '#f6c518', 0, h * 0.68, w, h * 0.32);
    word(c, 'OXXO', w / 2, h * 0.4, h * 0.46, '#ffffff', HEAVY, '900', { spacing: h * 0.04 });
    word(c, d.sub ?? '', w / 2, h * 0.85, h * 0.13, '#d8261d', HEAVY, '800');
  },
  'caja huancayo'(c, d, w, h) {
    fill(c, '#c8102e', 0, 0, w, h);
    ellipse(c, w * 0.1, h * 0.5, h * 0.24, h * 0.24, '#f2c230');
    word(c, 'Caja Huancayo', w * 0.57, h * 0.46, h * 0.44, '#ffffff', HEAVY, '800', { max: w * 0.74 });
    sub(c, d, w, h, '#f2c230', 0.84);
  },
};

/** The fonts these logos use (loaded before the sign atlas is drawn). */
export const LOGO_FONTS = ['64px "Fredoka"', '64px "Lobster"', '900 64px "Montserrat"', '700 64px "Oswald"'];
