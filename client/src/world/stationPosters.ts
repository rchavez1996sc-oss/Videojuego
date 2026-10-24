import * as THREE from 'three';
import type { Lighting } from '../render/lighting';

type Paint = (ctx: CanvasRenderingContext2D, w: number, h: number, seed: number) => void;
const FONT = '"Barlow Condensed", Arial Narrow, sans-serif';

function lines(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, n: number, gap: number, seed: number): void {
  ctx.fillStyle = 'rgba(30,30,30,0.55)';
  for (let i = 0; i < n; i++) ctx.fillRect(x, y + i * gap, w * (0.6 + ((seed * 7 + i * 13) % 10) / 25), gap * 0.32);
}

/** Wanted bill: "SE BUSCA", a hooded silhouette and a reward. */
const wanted: Paint = (ctx, w, h, seed) => {
  ctx.fillStyle = '#e9e0c6';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#1a1a1a';
  ctx.textAlign = 'center';
  ctx.font = `800 ${w * 0.19}px ${FONT}`;
  ctx.fillText('SE BUSCA', w / 2, h * 0.15);
  ctx.fillStyle = '#9a9384';
  ctx.fillRect(w * 0.2, h * 0.2, w * 0.6, h * 0.42);
  ctx.fillStyle = '#2a2a2a';
  ctx.beginPath();
  ctx.arc(w / 2, h * 0.36, w * 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(w * 0.28, h * 0.48, w * 0.44, h * 0.14);
  ctx.font = `700 ${w * 0.08}px ${FONT}`;
  ctx.fillStyle = '#1a1a1a';
  ctx.fillText(['TERRORISTA DEL FLS', 'CABECILLA SUBVERSIVO', 'ALIAS «CAMARADA»'][seed % 3], w / 2, h * 0.7);
  ctx.fillStyle = '#9b1b14';
  ctx.font = `800 ${w * 0.1}px ${FONT}`;
  ctx.fillText(`RECOMPENSA S/ ${[50, 80, 120][seed % 3]} 000`, w / 2, h * 0.82);
  lines(ctx, w * 0.12, h * 0.88, w * 0.76, 2, h * 0.035, seed);
};

/** Official notice on white paper with a red header band. */
const notice: Paint = (ctx, w, h, seed) => {
  ctx.fillStyle = '#f2f1ec';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#b3121b';
  ctx.fillRect(0, 0, w, h * 0.12);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = `700 ${w * 0.075}px ${FONT}`;
  ctx.fillText(['COMUNICADO OFICIAL', 'TOQUE DE QUEDA', 'REQUISITOS PARA DENUNCIAS'][seed % 3], w / 2, h * 0.085);
  ctx.fillStyle = '#1a1a1a';
  ctx.font = `700 ${w * 0.06}px ${FONT}`;
  ctx.fillText('POLICÍA NACIONAL DEL PERÚ', w / 2, h * 0.2);
  lines(ctx, w * 0.1, h * 0.26, w * 0.8, 14, h * 0.045, seed);
  ctx.strokeStyle = '#2a3c8a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(w * 0.75, h * 0.9, w * 0.07, 0, Math.PI * 2);
  ctx.stroke();
};

/** Opening hours board. */
const hours: Paint = (ctx, w, h) => {
  ctx.fillStyle = '#1f4a33';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#f4f2ea';
  ctx.textAlign = 'center';
  ctx.font = `800 ${w * 0.1}px ${FONT}`;
  ctx.fillText('HORARIO DE ATENCIÓN', w / 2, h * 0.2);
  ctx.font = `600 ${w * 0.075}px ${FONT}`;
  ['LUNES A VIERNES  08:00 – 18:00', 'SÁBADOS  09:00 – 13:00', 'EMERGENCIAS 24 HORAS', 'CENTRAL 105'].forEach((l, i) => ctx.fillText(l, w / 2, h * (0.4 + i * 0.15)));
};

/** Regime poster: red field, a white star and a slogan. */
const regime: Paint = (ctx, w, h, seed) => {
  ctx.fillStyle = '#9e1612';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#f4f2ee';
  ctx.fillRect(0, h * 0.62, w, h * 0.38);
  ctx.save();
  ctx.translate(w / 2, h * 0.32);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? w * 0.08 : w * 0.2, a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#9e1612';
  ctx.textAlign = 'center';
  ctx.font = `800 ${w * 0.13}px ${FONT}`;
  const [a, b] = [['ORDEN', 'Y PATRIA'], ['LA PNP', 'TE PROTEGE'], ['DENUNCIA', 'AL TERRORISTA']][seed % 3];
  ctx.fillText(a, w / 2, h * 0.76);
  ctx.fillText(b, w / 2, h * 0.9);
};

/** The flag of Peru with the national coat of arms: shield (vicuña, cinchona tree, cornucopia), palm and laurel, oak crown, ribbon. */
const peru: Paint = (ctx, w, h) => {
  const red = '#d91023';
  ctx.fillStyle = red;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(w / 3, 0, w / 3, h);
  const s = w / 2000, X = (x: number) => x * s, Y = (y: number) => y * s * (h / w) * 1.5;
  const leaf = (x: number, y: number, a: number, len: number, wid: number, col: string) => {
    ctx.save();
    ctx.translate(X(x), Y(y));
    ctx.rotate(a);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(0, 0, X(len), X(wid), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  for (let i = 0; i < 14; i++) {
    const t = i / 13, x = 860 - 120 * Math.sin(t * Math.PI * 0.9) - 20 * t, y = 880 - 400 * t;
    leaf(x - 35, y, -2.4 + t * 0.6, 70, 12, '#1f9a3e');
    leaf(x + 30, y - 5, -0.8 - t * 0.5, 60, 11, '#25a847');
  }
  for (let i = 0; i < 9; i++) {
    const t = i / 8, x = 1140 + 110 * Math.sin(t * Math.PI * 0.9), y = 880 - 400 * t;
    leaf(x - 25, y, -0.5 - t * 0.3, 55, 24, '#1f9a3e');
    leaf(x + 30, y - 10, 0.6 + t * 0.4, 50, 22, '#29a84b');
    if (i % 2) {
      ctx.fillStyle = '#c8102e';
      ctx.beginPath();
      ctx.arc(X(x + 55), Y(y + 20), X(9), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.strokeStyle = '#2f9a3a';
  ctx.lineWidth = X(26);
  ctx.beginPath();
  ctx.ellipse(X(1000), Y(470), X(75), Y(62), 0, 0, Math.PI * 2);
  ctx.stroke();
  const shield = () => {
    ctx.beginPath();
    ctx.moveTo(X(855), Y(580));
    ctx.lineTo(X(1000), Y(535));
    ctx.lineTo(X(1145), Y(580));
    ctx.bezierCurveTo(X(1135), Y(700), X(1120), Y(800), X(1000), Y(860));
    ctx.bezierCurveTo(X(880), Y(800), X(865), Y(700), X(855), Y(580));
    ctx.closePath();
  };
  ctx.save();
  shield();
  ctx.clip();
  ctx.fillStyle = '#0a7fb0';
  ctx.fillRect(X(840), Y(520), X(160), Y(192));
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(X(1000), Y(520), X(160), Y(192));
  ctx.fillStyle = red;
  ctx.fillRect(X(840), Y(712), X(320), Y(160));
  ctx.restore();
  ctx.strokeStyle = '#e1b52c';
  ctx.lineWidth = X(6);
  shield();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(X(1000), Y(540));
  ctx.lineTo(X(1000), Y(712));
  ctx.moveTo(X(870), Y(712));
  ctx.lineTo(X(1130), Y(712));
  ctx.stroke();
  ctx.fillStyle = '#c97a2a';
  ctx.fillRect(X(905), Y(615), X(60), Y(28));
  ctx.fillRect(X(950), Y(580), X(14), Y(40));
  ctx.fillRect(X(948), Y(575), X(26), Y(14));
  for (const lx of [908, 922, 945, 958]) ctx.fillRect(X(lx), Y(640), X(6), Y(52));
  ctx.fillStyle = '#7a5a2a';
  ctx.fillRect(X(1055), Y(620), X(10), Y(80));
  ctx.fillStyle = '#7fa83a';
  for (const [cx, cy, r] of [[1060, 610, 38], [1035, 630, 22], [1085, 630, 22]]) {
    ctx.beginPath();
    ctx.arc(X(cx), Y(cy), X(r), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#f2c814';
  ctx.beginPath();
  ctx.ellipse(X(975), Y(785), X(70), Y(40), -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(X(1030), Y(760));
  ctx.quadraticCurveTo(X(1090), Y(740), X(1085), Y(775));
  ctx.lineTo(X(1040), Y(800));
  ctx.fill();
  for (const [x0, x1] of [[850, 1000], [1000, 1150]]) {
    ctx.fillStyle = red;
    ctx.fillRect(X(Math.min(x0, x1)), Y(885), X(150), Y(14));
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(X(Math.min(x0, x1)), Y(899), X(150), Y(8));
  }
};

function texture(paint: Paint, w: number, h: number, seed: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const draw = () => {
    paint(c.getContext('2d')!, w, h, seed);
    t.needsUpdate = true;
  };
  draw();
  void document.fonts?.ready.then(draw);
  return t;
}

const KINDS: Record<string, [Paint, number, number]> = { peru: [peru, 2.7, 1.8], wanted: [wanted, 0.42, 0.6], notice: [notice, 0.3, 0.42], hours: [hours, 0.7, 0.5], regime: [regime, 0.55, 0.8] };

/** Posters and bills on the lobby walls: [kind, local x, y, z, yaw]; one material per poster (a handful in all). */
export function stationPosters(lighting: Lighting, at: (x: number, y: number, z: number) => THREE.Vector3, face: (yaw: number) => THREE.Quaternion, spots: [string, number, number, number, number][]): THREE.Object3D[] {
  return spots.map(([kind, x, y, z, yaw], i) => {
    const [paint, w, h] = KINDS[kind];
    const px = kind === 'peru' ? 1024 : 256;
    const mat = lighting.setup(new THREE.MeshStandardMaterial({ map: texture(paint, px, Math.round((px * h) / w), i), roughness: 0.9 }), `poster-${kind}-${i}`);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.copy(at(x, y, z));
    m.quaternion.copy(face(yaw)).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), (((i * 37) % 7) - 3) * 0.012));
    return m;
  });
}
