import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { Lighting } from '../render/lighting';

/** Sidewalk chalkboards (A-frame "welcome" boards) in front of eateries, registered while the level is built. */
const spots: { p: THREE.Vector3; yaw: number; kind: number }[] = [];
if (location.search.includes('shot')) (window as unknown as { __boards: unknown }).__boards = spots;

/** A board in front of a restaurant: `p` on its floor, `yaw` = facing of the façade (+z out to the street). */
export function addMenuBoard(p: THREE.Vector3, yaw: number, kind: number): void {
  spots.push({ p: p.clone(), yaw, kind });
}

const CHALK = '"Caveat Brush", "Permanent Marker", cursive', TITLE = '"Permanent Marker", "Caveat Brush", cursive';
type Line = [string, string?];
/** Menus chalked on the front (title, lines with a price in soles) — Lima street food. */
const MENUS: { title: string; sub: string; lines: Line[] }[] = [
  { title: 'MENÚ', sub: 'Entrada + segundo + refresco  S/ 10', lines: [['Papa a la huancaína'], ['Sopa de casa'], ['Arroz con pollo'], ['Ají de gallina'], ['Seco con frejoles'], ['Lomo saltado', 'S/ 14'], ['Chicha morada']] },
  { title: 'CEVICHERÍA', sub: 'Pescado fresco del día', lines: [['Ceviche', 'S/ 18'], ['Leche de tigre', 'S/ 10'], ['Jalea mixta', 'S/ 25'], ['Chicharrón de pescado', 'S/ 20'], ['Arroz con mariscos', 'S/ 22'], ['Chilcano', 'S/ 12']] },
  { title: 'POLLERÍA', sub: 'Pollo a la brasa', lines: [['1/4 pollo + papas', 'S/ 15'], ['1/2 pollo + papas', 'S/ 30'], ['Pollo entero', 'S/ 58'], ['Arroz chaufa', 'S/ 12'], ['Mollejitas', 'S/ 10'], ['Inca Kola 1,5 L', 'S/ 8']] },
  { title: 'DESAYUNOS', sub: 'Desde las 6 a. m.', lines: [['Pan con chicharrón', 'S/ 7'], ['Tamal criollo', 'S/ 5'], ['Pan con camote', 'S/ 6'], ['Café pasado', 'S/ 3'], ['Emoliente', 'S/ 1.50'], ['Jugo surtido', 'S/ 6']] },
  { title: 'ANTOJITOS', sub: 'Por las tardes', lines: [['Anticuchos', 'S/ 12'], ['Rachi', 'S/ 10'], ['Picarones', 'S/ 8'], ['Choclo con queso', 'S/ 6'], ['Papa rellena', 'S/ 4'], ['Mazamorra morada', 'S/ 3']] },
];
const BACKS = ['¡BIENVENIDOS!', '¡PASE, HAY MENÚ!', '¡BIENVENIDOS!', '¡PASE NOMÁS!', '¡HAY ANTICUCHOS!'];
const INKS = ['#f2f0e8', '#f5d76e', '#9fd8a8', '#f4a6a0', '#a8c8f0'];

/** Writes inside a texture rectangle turned a quarter (the panels lie sideways in the atlas). */
function panel(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, up: boolean, draw: (w: number, h: number) => void): void {
  g.save();
  if (up) g.translate(x0, y1), g.rotate(-Math.PI / 2);
  else g.translate(x1, y0), g.rotate(Math.PI / 2);
  draw(y1 - y0, x1 - x0);
  g.restore();
}

function chalkText(g: CanvasRenderingContext2D, t: string, x: number, y: number, size: number, ink: string, font = CHALK, align: CanvasTextAlign = 'left', max?: number): void {
  g.font = `${size}px ${font}`;
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.fillStyle = ink;
  g.globalAlpha = 0.9;
  g.fillText(t, x, y, max);
  g.globalAlpha = 0.18;
  g.fillText(t, x + 1.2, y + 0.8, max);
  g.globalAlpha = 1;
}

function boardTexture(base: HTMLImageElement, k: number): THREE.CanvasTexture {
  const cv = Object.assign(document.createElement('canvas'), { width: 1024, height: 1024 }), g = cv.getContext('2d')!;
  g.drawImage(base, 0, 0, 1024, 1024);
  const m = MENUS[k], ink = INKS[k % INKS.length];
  panel(g, 306, 284, 718, 516, true, (w, h) => {
    chalkText(g, m.title, w / 2, h * 0.11, 44, ink, TITLE, 'center', w - 20);
    chalkText(g, m.sub, w / 2, h * 0.22, 19, '#f2f0e8', CHALK, 'center', w - 16);
    g.strokeStyle = 'rgba(240,240,232,0.55)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(w * 0.15, h * 0.285); g.lineTo(w * 0.85, h * 0.285); g.stroke();
    const step = (h * 0.68) / m.lines.length;
    m.lines.forEach(([dish, price], i) => {
      const y = h * 0.34 + step * (i + 0.5);
      chalkText(g, dish, 12, y, 21, '#f2f0e8', CHALK, 'left', price ? w * 0.66 : w - 24);
      if (price) chalkText(g, price, w - 10, y, 21, ink, CHALK, 'right');
    });
  });
  panel(g, 24, 32, 432, 252, false, (w, h) => {
    chalkText(g, BACKS[k % BACKS.length], w / 2, h * 0.3, 34, ink, TITLE, 'center', w - 16);
    chalkText(g, m.title === 'MENÚ' ? 'Menú a S/ 10' : m.title.toLowerCase().replace(/^./, (c) => c.toUpperCase()), w / 2, h * 0.55, 30, '#f2f0e8', CHALK, 'center', w - 16);
    chalkText(g, 'Atendemos de lunes a domingo', w / 2, h * 0.78, 18, '#f2f0e8', CHALK, 'center', w - 16);
  });
  return Object.assign(new THREE.CanvasTexture(cv), { colorSpace: THREE.SRGBColorSpace, flipY: true, anisotropy: 8 });
}

/** Places every registered board (one instanced mesh per menu). Without the model in the manifest, nothing. */
export async function placeMenuBoards(scene: THREE.Object3D, lighting: Lighting, hf: { heightAt(x: number, z: number): number }): Promise<void> {
  if (!spots.length) return;
  const base = `${import.meta.env.BASE_URL}assets/`;
  const manifest = await fetch(`${base}manifest.json`, { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
  const def = manifest?.props?.menuBoard;
  if (!def) return;
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(`${base}${def.model}?v=${manifest.version}`);
  const img = (u: string) => new Promise<HTMLImageElement>((ok, no) => Object.assign(new Image(), { onload: function (this: HTMLImageElement) { ok(this); }, onerror: no, src: `${base}${u}` }));
  const [col, nrm] = await Promise.all([img(def.color), img(def.normal)]);
  await document.fonts.load(`40px ${TITLE}`).catch(() => undefined);
  let mesh: THREE.Mesh | null = null;
  gltf.scene.traverse((o) => (o as THREE.Mesh).isMesh && (mesh ??= o as THREE.Mesh));
  if (!mesh) return;
  gltf.scene.updateMatrixWorld(true);
  const geo = (mesh as THREE.Mesh).geometry.clone().applyMatrix4((mesh as THREE.Mesh).matrixWorld);
  const normalMap = Object.assign(new THREE.Texture(nrm), { flipY: true, needsUpdate: true });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
  for (let k = 0; k < MENUS.length; k++) {
    const mine = spots.filter((s) => s.kind % MENUS.length === k);
    if (!mine.length) continue;
    const mat = lighting.setup(new THREE.MeshStandardMaterial({ map: boardTexture(col, k), normalMap, roughness: 0.85 }), 'menu-board');
    const im = new THREE.InstancedMesh(geo, mat, mine.length);
    mine.forEach((s, i) => im.setMatrixAt(i, m4.compose(s.p.clone().setY(Math.max(s.p.y, hf.heightAt(s.p.x, s.p.z))), q.setFromAxisAngle(up, s.yaw + Math.PI / 2), one)));
    im.castShadow = im.receiveShadow = true;
    im.frustumCulled = false;
    im.name = 'menu-boards';
    scene.add(im);
  }
}
