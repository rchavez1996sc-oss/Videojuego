import * as THREE from 'three';

type Std = (key: string, p: THREE.MeshStandardMaterialParameters) => THREE.Material;
type Pbr = { map: THREE.Texture; normalMap: THREE.Texture };

/** Paint colours of the low band at the foot of Lima facades (granate, óxido, gris verdoso, azul). */
export const ZOCALOS = ['zocalo-granate', 'zocalo-oxido', 'zocalo-gris', 'zocalo-azul'];
const ZOCALO_COLORS = ['#6e1f1c', '#8a3b22', '#5b6458', '#2f4a6e'];

/** Glass-block window panel (bloques de vidrio): a grid of greenish-blue cells with mortar joints. */
function glassBlockTexture(): THREE.CanvasTexture {
  const n = 256, cv = Object.assign(document.createElement('canvas'), { width: n, height: n }), g = cv.getContext('2d')!;
  g.fillStyle = '#b9b4a8'; g.fillRect(0, 0, n, n);
  const c = n / 6;
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
    const x = i * c + 4, y = j * c + 4, s = c - 8, gr = g.createRadialGradient(x + s / 2, y + s / 2, 2, x + s / 2, y + s / 2, s * 0.75);
    gr.addColorStop(0, '#c9dcd6'); gr.addColorStop(0.6, '#8fb0aa'); gr.addColorStop(1, '#5d7a78');
    g.fillStyle = gr; g.fillRect(x, y, s, s);
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2; g.strokeRect(x + 5, y + 5, s - 10, s - 10);
  }
  return Object.assign(new THREE.CanvasTexture(cv), { colorSpace: THREE.SRGBColorSpace, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, anisotropy: 8 });
}

/** Small glazed wall tiles (enchape cerámico, like the green front of the Comisaría de Huaycán): 10 per 2 m with white grout, colour and grooved normal map. */
function tileTextures(base: string): { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture } {
  const n = 512, k = 10, c = n / k;
  const mk = () => Object.assign(document.createElement('canvas'), { width: n, height: n });
  const cv = mk(), g = cv.getContext('2d')!, nv = mk(), h = nv.getContext('2d')!;
  g.fillStyle = '#e4e2da'; g.fillRect(0, 0, n, n);
  h.fillStyle = 'rgb(128,128,255)'; h.fillRect(0, 0, n, n);
  const col = new THREE.Color(base);
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) {
    const t = col.clone().offsetHSL(0, (Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.06);
    g.fillStyle = `#${t.getHexString()}`; g.fillRect(i * c + 3, j * c + 3, c - 6, c - 6);
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(i * c + 4, j * c + 4, c - 8, 3);
    h.fillStyle = 'rgb(128,200,240)'; h.fillRect(i * c, j * c + c - 3, c, 3);
    h.fillStyle = 'rgb(128,56,240)'; h.fillRect(i * c, j * c, c, 3);
    h.fillStyle = 'rgb(200,128,240)'; h.fillRect(i * c + c - 3, j * c, 3, c);
    h.fillStyle = 'rgb(56,128,240)'; h.fillRect(i * c, j * c, 3, c);
  }
  g.fillStyle = 'rgba(70,60,45,0.18)';
  for (let i = 0; i < 40; i++) g.fillRect(Math.random() * n, n * 0.7 + Math.random() * n * 0.3, 2 + Math.random() * 30, 1 + Math.random() * 4);
  const tex = (cv: HTMLCanvasElement, srgb: boolean) => Object.assign(new THREE.CanvasTexture(cv), { colorSpace: srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, anisotropy: 8 });
  return { map: tex(cv, true), normalMap: tex(nv, false) };
}

/** Extra facade materials seen in Lima Norte: painted plinth bands, bare grey render on the ground floor, glass blocks. */
export function facadeMaterials(std: Std, plaster: Pbr): Record<string, THREE.Material> {
  const m: Record<string, THREE.Material> = {
    tarrajeo: std('tarrajeo', { map: plaster.map, normalMap: plaster.normalMap, roughness: 0.95, color: '#9c968c' }),
    glassBlock: std('glassBlock', { map: glassBlockTexture(), roughness: 0.25, metalness: 0.1 }),
    poleBlue: std('poleBlue', { color: '#2c5aa0', roughness: 0.7 }),
    policeTile: std('policeTile', { ...tileTextures('#2f8a5e'), roughness: 0.3 }),
  };
  ZOCALOS.forEach((k, i) => (m[k] = std(k, { map: plaster.map, normalMap: plaster.normalMap, roughness: 0.75, color: ZOCALO_COLORS[i] })));
  return m;
}
