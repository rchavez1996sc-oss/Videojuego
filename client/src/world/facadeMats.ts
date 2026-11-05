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

/** Extra facade materials seen in Lima Norte: painted plinth bands, bare grey render on the ground floor, glass blocks. */
export function facadeMaterials(std: Std, plaster: Pbr): Record<string, THREE.Material> {
  const m: Record<string, THREE.Material> = {
    tarrajeo: std('tarrajeo', { map: plaster.map, normalMap: plaster.normalMap, roughness: 0.95, color: '#9c968c' }),
    glassBlock: std('glassBlock', { map: glassBlockTexture(), roughness: 0.25, metalness: 0.1 }),
    poleBlue: std('poleBlue', { color: '#2c5aa0', roughness: 0.7 }),
  };
  ZOCALOS.forEach((k, i) => (m[k] = std(k, { map: plaster.map, normalMap: plaster.normalMap, roughness: 0.75, color: ZOCALO_COLORS[i] })));
  return m;
}
