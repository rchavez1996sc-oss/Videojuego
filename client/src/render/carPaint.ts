import * as THREE from 'three';
import type { Lighting } from './lighting';

let shared: THREE.Material | null = null;

/**
 * Street-worn paint on box-projected UVs (2 m a tile): mostly clean colour with soft dust blotches, road grime
 * splashes, fine speckle and a few light scratches; the roughness map follows (dust is matt, clean paint glossy).
 */
function grime(): { map: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture } {
  const n = 512, mk = () => Object.assign(document.createElement('canvas'), { width: n, height: n });
  const cv = mk(), g = cv.getContext('2d')!, rv = mk(), r = rv.getContext('2d')!;
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.fillStyle = '#fff'; g.fillRect(0, 0, n, n);
  r.fillStyle = 'rgb(70,70,70)'; r.fillRect(0, 0, n, n);
  const blot = (x: number, y: number, rad: number, a: number, col: string) => {
    for (const [ctx, c] of [[g, col], [r, '200,200,200']] as const) {
      const gr = ctx.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, `rgba(${c},${a})`); gr.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = gr; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  };
  for (let i = 0; i < 26; i++) blot(rnd() * n, rnd() * n, 30 + rnd() * 90, 0.08 + rnd() * 0.1, '150,135,115');
  for (let i = 0; i < 60; i++) blot(rnd() * n, n * (0.55 + rnd() * 0.45), 6 + rnd() * 22, 0.12 + rnd() * 0.15, '95,82,66');
  for (let i = 0; i < 2500; i++) {
    g.fillStyle = `rgba(80,70,60,${0.05 + rnd() * 0.12})`;
    g.fillRect(rnd() * n, rnd() * n, 1 + rnd() * 1.5, 1 + rnd() * 1.5);
  }
  g.strokeStyle = 'rgba(255,255,255,0.35)'; r.strokeStyle = 'rgba(150,150,150,0.6)';
  for (let i = 0; i < 14; i++) {
    const x = rnd() * n, y = rnd() * n, a = (rnd() - 0.5) * 0.6, l = 10 + rnd() * 40;
    for (const ctx of [g, r]) { ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke(); }
  }
  const tex = (c: HTMLCanvasElement, srgb: boolean) => Object.assign(new THREE.CanvasTexture(c), { colorSpace: srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, anisotropy: 8 });
  return { map: tex(cv, true), roughnessMap: tex(rv, false) };
}

/** Car paint: base coat in the vertex colour under a glossy clear coat, with street dust and scratches. */
export function carPaintMaterial(lighting: Lighting): THREE.Material {
  return (shared ??= lighting.setup(new THREE.MeshPhysicalMaterial({ ...grime(), roughness: 1, metalness: 0.45, clearcoat: 0.85, clearcoatRoughness: 0.08, envMapIntensity: 1.4, vertexColors: true }), 'carpaint-baked'));
}
