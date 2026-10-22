import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import type { Heightfield } from '../heightfield';
import type { Lighting } from '../../render/lighting';
import { SIDEWALK, type MaleconDef } from './layout';

export interface PropagandaDef { portrait?: string; slogans: [string, string][]; billboards: [number, number, number][]; banners: number; columns: number }

const Q = new THREE.Quaternion(), FONT = '"Barlow Condensed", "Arial Narrow", sans-serif';
type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

/** Canvas texture that redraws once web fonts and the portrait image have arrived. */
function poster(draw: Draw, w: number, h: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const paint = () => {
    draw(c.getContext('2d')!, w, h);
    tex.needsUpdate = true;
  };
  paint();
  void document.fonts?.ready.then(paint);
  redraws.push(paint);
  return tex;
}

const redraws: (() => void)[] = [];
let portrait: HTMLImageElement | null = null;

function loadPortrait(key: string | undefined): void {
  if (!key) return;
  const base = `${import.meta.env.BASE_URL}assets/`;
  void fetch(`${base}manifest.json`, { cache: 'no-cache' }).then((r) => r.json()).then((m) => {
    const path = m.art?.[key];
    if (!path) return;
    const img = new Image();
    img.onload = () => {
      portrait = img;
      redraws.forEach((r) => r());
    };
    img.src = `${base}${path}?v=${m.version ?? 0}`;
  }).catch(() => {});
}

function footer(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = '#f4f2ee';
  ctx.fillRect(0, h * 0.86, w, h * 0.14);
  ctx.fillStyle = '#b3121b';
  ctx.font = `700 ${h * 0.075}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('JUNTA DE GOBIERNO NACIONAL · PERÚ 2036', w / 2, h * 0.955, w * 0.9);
}

/** Regime poster: the general's portrait on blood red with a slogan, or a flag-striped text design. */
function design([a, b]: [string, string], withPortrait: boolean): Draw {
  return (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, withPortrait ? '#5e0b10' : '#f4f2ee');
    g.addColorStop(1, withPortrait ? '#26060a' : '#e2ddd3');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    let tw = w;
    if (withPortrait && portrait) {
      const sw = portrait.width * 0.5, sh = portrait.height;
      ctx.drawImage(portrait, portrait.width * 0.5, 0, sw, sh, w * 0.5, 0, w * 0.5, h * 0.86);
      const fade = ctx.createLinearGradient(w * 0.5, 0, w * 0.62, 0);
      fade.addColorStop(0, '#4a090e');
      fade.addColorStop(1, 'rgba(74,9,14,0)');
      ctx.fillStyle = fade;
      ctx.fillRect(w * 0.5, 0, w * 0.12, h * 0.86);
      tw = w * 0.55;
    } else if (!withPortrait) {
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = k === 1 ? '#f4f2ee' : '#c8161f';
        ctx.fillRect(k * w * 0.04, 0, w * 0.04, h * 0.86);
      }
    }
    const x0 = withPortrait ? w * 0.05 : w * 0.17;
    ctx.textAlign = 'left';
    ctx.fillStyle = withPortrait ? '#ffffff' : '#8e0f17';
    ctx.font = `italic 800 ${h * 0.24}px ${FONT}`;
    ctx.fillText(a, x0, h * 0.36, tw - x0 - w * 0.03);
    ctx.fillStyle = withPortrait ? '#e8c46a' : '#26282b';
    ctx.font = `600 ${h * 0.12}px ${FONT}`;
    ctx.fillText(b, x0, h * 0.58, tw - x0 - w * 0.03);
    footer(ctx, w, h);
  };
}

function panel(lighting: Lighting, tex: THREE.Texture, w: number, h: number, key: string): THREE.Mesh {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), lighting.setup(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }), key));
}

/** Pro-junta billboards in the park facing the avenue, giant banners on seafront towers and poster columns on the pavement. */
export function buildPropaganda(b: Builder, hf: Heightfield, def: MaleconDef, lighting: Lighting, fronts: { x: number; w: number; z: number; h: number }[], rand: () => number): THREE.Group {
  const g = new THREE.Group(), p = def.propaganda;
  if (!p) return g;
  loadPortrait(p.portrait);
  const slogan = (i: number) => p.slogans[i % p.slogans.length];
  p.billboards.forEach(([x, z, yaw], i) => {
    const y = hf.heightAt(x, z), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    for (const s of [-1, 1]) b.box('steelDark', [0.35, 6, 0.35], new THREE.Vector3(x, y + 3, z).add(new THREE.Vector3(s * 3.5, 0, 0).applyQuaternion(q)), q, true);
    b.box('steelDark', [10.4, 5.4, 0.3], new THREE.Vector3(x, y + 7.2, z), q, false);
    for (const side of [0, 1]) {
      const m = panel(lighting, poster(design(slogan(i * 2 + side), side === 0), 1024, 512), 10, 5, `prop-bb${i}-${side}`);
      const qs = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), side * Math.PI));
      m.position.set(x, y + 7.2, z).add(new THREE.Vector3(0, 0, 0.17).applyQuaternion(qs));
      m.quaternion.copy(qs);
      g.add(m);
    }
  });
  const tall = fronts.filter((f) => f.h > 40 && f.w >= 18).sort(() => rand() - 0.5).slice(0, p.banners);
  tall.forEach((f, i) => {
    const m = panel(lighting, poster(design(slogan(i + 3), true), 512, 1024), 9, 18, `prop-ban${i}`);
    m.position.set(f.x, f.h - 12, f.z + 1.75);
    g.add(m);
  });
  const zc = def.avenue.z + def.avenue.half + SIDEWALK - 0.9;
  for (let k = 0; k < p.columns; k++) {
    const x = -200 + (400 * (k + 0.5)) / p.columns + (rand() - 0.5) * 20, y = hf.heightAt(x, zc);
    b.geometry('columnGreen', new THREE.CylinderGeometry(0.62, 0.62, 0.4, 20).translate(0, 0.2, 0), new THREE.Matrix4().makeTranslation(x, y, zc));
    b.geometry('columnGreen', new THREE.SphereGeometry(0.66, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 3.0, 0), new THREE.Matrix4().makeTranslation(x, y, zc));
    b.box('none', [1.1, 3, 1.1], new THREE.Vector3(x, y + 1.5, zc), Q, true);
    const tex = poster((ctx, w, h) => {
      for (let j = 0; j < 3; j++) {
        ctx.save();
        ctx.translate((j * w) / 3, 0);
        design(slogan(k + j), j === 1)(ctx, w / 3, h);
        ctx.restore();
      }
    }, 1536, 640);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 2.6, 24, 1, true), lighting.setup(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 }), `prop-col${k}`));
    m.position.set(x, y + 1.7, zc);
    g.add(m);
  }
  return g;
}
