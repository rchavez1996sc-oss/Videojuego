import * as THREE from 'three';
import type { Lighting } from '../../render/lighting';
import { concrete, plaster, slabs } from '../../render/urbanTextures';
import { photo } from '../../render/photoTextures';
import { deck, rock, wood, type PbrSet } from '../../render/textures';
import { bakeGroups } from '../bake';
import { flagstone, foliage } from '../malecon/textures';
import { chainLink } from '../malecon/beach';
import { barsTexture } from './grounds';

/** Painted plaster walls of the faculties (photos: cream Química, white/grey Geológica, yellow Comedor…). */
const WALLS: Record<string, string> = {
  uniCream: '#e6dcc4', uniGrey: '#c8c6c0', uniWhite: '#efeee9', uniYellow: '#e3b443', uniRed: '#b02a22', uniFrame: '#d5d3cd',
  uniTerracotta: '#a35a3c', uniOrange: '#d9772e', roofWhite: '#e9e8e3', uniStone: '#9a958c', uniSand: '#d2bf98', uniTaupe: '#968d80', uniOchre: '#d8ad2c', uniBrown: '#7c4a2c', uniBlue: '#4f86c9',
};

export function campusMaterials(lighting: Lighting): Record<string, THREE.Material> {
  const std = (key: string, p: THREE.MeshStandardMaterialParameters) => lighting.setup(new THREE.MeshStandardMaterial(p), key);
  const pl = photo('paintPlaster') ?? plaster(), co = concrete(), fo = foliage(), rk = rock(), stone = photo('stoneWall') ?? rk, fs = flagstone();
  const laja = photo('laja') ?? fs, flags = photo('plazaFlag') ?? fs, slate = photo('slateDark') ?? stone;
  const m: Record<string, THREE.Material> = {
    bioGlass: std('bioGlass', { color: '#8e9ca2', roughness: 0.1, metalness: 0.55, envMapIntensity: 1.3 }),
    louvre: std('louvre', { map: louvreTex(), color: '#d4d8da', roughness: 0.4, metalness: 0.6 }),
    winGlass: std('winGlass', { color: '#4d5f6a', roughness: 0.08, metalness: 0.7, envMapIntensity: 1.4 }),
    darkGlass: std('darkGlass', { color: '#15191d', roughness: 0.05, metalness: 0.85, envMapIntensity: 1.6 }),
    mullion: std('mullion', { color: '#34373a', roughness: 0.5, metalness: 0.5 }),
    paneBlue: std('paneBlue', { color: '#2f5c96', roughness: 0.3, metalness: 0.3 }),
    paneYellow: std('paneYellow', { color: '#d9ad2a', roughness: 0.35, metalness: 0.2 }),
    alu: std('alu', { color: '#b9bec2', roughness: 0.35, metalness: 0.8 }),
    laja: std('laja', { map: laja.map, normalMap: laja.normalMap, color: '#ffffff', roughness: 0.85 }),
    plazaStone: std('plazaStone', { map: flags.map, normalMap: flags.normalMap, color: '#ffffff', roughness: 0.9 }),
    pavers: std('pavers', { map: slabs().map, normalMap: slabs().normalMap, color: '#b9b2a6', roughness: 0.9 }),
    parkPath: std('parkPath', { map: co.map, normalMap: co.normalMap, color: '#bdb8ae', roughness: 0.9 }),
    lawnBed: std('lawnBed', { map: fo.map, normalMap: fo.normalMap, color: '#8fb85c', roughness: 0.95 }),
    hedge: std('hedge', { map: fo.map, normalMap: fo.normalMap, roughness: 0.95 }),
    binGreen: std('binGreen', { color: '#2f6b3f', roughness: 0.5, metalness: 0.2 }),
    fenceIron: std('fenceIron', { color: '#1d1c1b', roughness: 0.5, metalness: 0.5 }),
    fenceBars: std('fenceBars', { map: barsTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.5 }),
    chainFence: std('chainFence', { map: chainLink(), alphaTest: 0.4, side: THREE.DoubleSide, metalness: 0.5, roughness: 0.5 }),
    netWhite: std('netWhite', { map: chainLink(), alphaTest: 0.4, side: THREE.DoubleSide, color: '#ffffff', roughness: 0.9 }),
    kerbYellow: std('kerbYellow', { map: co.map, color: '#e0b830', roughness: 0.8 }),
    lampPole: std('lampPole', { color: '#1b1c1d', roughness: 0.5, metalness: 0.5 }),
    globe: std('globe', { color: '#f7f2e4', roughness: 0.3, emissive: '#fff1d0', emissiveIntensity: 0.35 }),
    glassClear: std('glassClear', { color: '#cfe3ea', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.22, depthWrite: false }),
    slate: std('slate', { map: slate.map, normalMap: slate.normalMap, color: '#d8d8dc', roughness: 0.8 }),
    travertine: std('travertine', { map: travertine(), color: '#ffffff', roughness: 0.55 }),
    steelGrey: std('steelGrey', { color: '#8d9296', roughness: 0.45, metalness: 0.6 }),
    panePurple: std('panePurple', { color: '#7d6db0', roughness: 0.35, metalness: 0.2 }),
    curtainRed: std('curtainRed', { color: '#6a3a34', roughness: 0.7 }),
    granite: std('granite', { map: co.map, normalMap: co.normalMap, color: '#9d988f', roughness: 0.7 }),
    bronze: std('bronze', { color: '#6a5634', roughness: 0.42, metalness: 0.75 }),
    terrazzo: std('terrazzo', { map: terrazzo(), roughness: 0.25, metalness: 0.05 }),
    wallTile: std('wallTile', { map: tiles(), roughness: 0.3 }),
    chairOrange: std('chairOrange', { color: '#e8552a', roughness: 0.45 }),
    tableWhite: std('tableWhite', { color: '#ecebe6', roughness: 0.4 }),
    tubeLight: std('tubeLight', { color: '#ffffff', emissive: '#f4f8ff', emissiveIntensity: 1.2 }),
    hedgeGold: std('hedgeGold', { map: fo.map, normalMap: fo.normalMap, color: '#f0dc3a', roughness: 0.95 }),
    hedgeLime: std('hedgeLime', { map: fo.map, normalMap: fo.normalMap, color: '#f6ff6a', roughness: 0.95 }),
    flowerSilver: std('flowerSilver', { map: fo.map, normalMap: fo.normalMap, color: '#c9d2cf', roughness: 0.95 }),
    flowerRed: std('flowerRed', { map: fo.map, normalMap: fo.normalMap, color: '#ff5a5a', emissive: '#3a0606', roughness: 0.95 }),
    flowerPurple: std('flowerPurple', { map: fo.map, normalMap: fo.normalMap, color: '#b05ad0', emissive: '#22062e', roughness: 0.95 }),
    kioskGreen: std('kioskGreen', { color: '#4f9a3c', roughness: 0.7 }),
    pavRed: std('pavRed', { map: (photo('brick') ?? stone).map, normalMap: (photo('brick') ?? stone).normalMap, color: '#b8604e', roughness: 0.9 }),
    brickRed: std('brickRed', { map: (photo('brick') ?? stone).map, normalMap: (photo('brick') ?? stone).normalMap, color: '#d8524a', roughness: 0.85 }),
    awningStripe: std('awningStripe', { color: '#5a554e', roughness: 0.8, side: THREE.DoubleSide }),
    trackRed: std('trackRed', { color: '#b8452e', roughness: 0.9 }),
    benchWood: std('benchWood', { map: wood().map, color: '#a07a52', roughness: 0.8 }),
  };
  for (const [k, c] of Object.entries(WALLS)) m[k] = std(k, { map: (k === 'uniStone' ? stone : pl).map, normalMap: (k === 'uniStone' ? stone : pl).normalMap, color: c, roughness: 0.88 });
  return m;
}

/** Same-texture families merged into vertex-coloured materials (fewer draw calls). */
export function campusBake(lighting: Lighting): { material: THREE.Material; keys: string[] }[] {
  const textured = (key: string, set: PbrSet, keys: string[], roughness: number) => ({ material: lighting.setup(new THREE.MeshStandardMaterial({ map: set.map, normalMap: set.normalMap, roughnessMap: set.roughnessMap ?? null, roughness, vertexColors: true }), key), keys });
  return [
    ...bakeGroups(lighting, ['mullion', 'paneBlue', 'paneYellow', 'panePurple', 'curtainRed', 'steelGrey', 'alu', 'binGreen', 'fenceIron', 'lampPole']),
    textured('uni-plaster-baked', photo('paintPlaster') ?? plaster(), Object.keys(WALLS).filter((k) => k !== 'uniStone'), 0.88),
    textured('concrete-baked', concrete(), ['concrete', 'parkPath', 'kerbYellow'], 0.9),
    textured('foliage-baked', foliage(), ['hedge', 'lawnBed', 'hedgeLime'], 0.95),
    textured('deck-baked', deck(), ['benchWood'], 0.75),
  ];
}

/** Travertine cladding: warm cream slabs with horizontal veins and rusty streaks (Biológicas end walls). */
function travertine(): THREE.CanvasTexture {
  const S = 512, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#dcc39a';
  g.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 128) for (let x = (y / 128) % 2 ? -128 : 0; x < S; x += 256) {
    const k = Math.random() * 0.75, r = 236 - k * 20, gg = 214 - k * 52, bb = 172 - k * 74;
    g.fillStyle = `rgb(${r},${gg},${bb})`;
    g.fillRect(x, y, 256, 128);
    if (Math.random() < 0.45) {
      const grad = g.createLinearGradient(0, y, 0, y + 128);
      grad.addColorStop(0, 'rgba(200,110,60,0)'); grad.addColorStop(1, `rgba(200,110,60,${0.15 + Math.random() * 0.25})`);
      g.fillStyle = grad; g.fillRect(x, y, 256, 128);
    }
  }
  for (let i = 0; i < 900; i++) {
    const y = Math.random() * S, v = Math.random();
    g.fillStyle = v < 0.5 ? `rgba(240,222,190,${0.25 + Math.random() * 0.3})` : `rgba(${190 + Math.random() * 30},${130 + Math.random() * 30},${80 + Math.random() * 20},${0.12 + Math.random() * 0.2})`;
    g.fillRect(Math.random() * S - 40, y, 30 + Math.random() * 200, 1 + Math.random() * 3);
  }
  g.strokeStyle = 'rgba(120,95,70,0.6)';
  g.lineWidth = 2;
  for (let y = 0; y < S; y += 128) for (let x = (y / 128) % 2 ? 0 : 128; x < S + 256; x += 256) g.strokeRect(x - 256, y, 256, 128);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Horizontal aluminium slats (jalousie windows of Biológicas). */
function louvreTex(): THREE.CanvasTexture {
  return canvasTex(64, (g, s) => {
    g.fillStyle = '#7d8386';
    g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 8) {
      g.fillStyle = '#e4e8ea'; g.fillRect(0, y, s, 5);
      g.fillStyle = '#5a6064'; g.fillRect(0, y + 5, s, 1);
    }
  });
}

function canvasTex(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void, repeat = 1): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d')!, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Dark polished terrazzo: grey ground with white, black and ochre chips. */
function terrazzo(): THREE.CanvasTexture {
  return canvasTex(512, (g, s) => {
    g.fillStyle = '#4a4b4d';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = ['#d8d6d0', '#1e1e1f', '#8a8580', '#b49a6a', '#6b6c6e'][i % 5];
      const r = 0.6 + Math.random() * 2.2;
      g.fillRect(Math.random() * s, Math.random() * s, r, r * (0.6 + Math.random()));
    }
  });
}

/** White glazed wall tiles, 15 cm, with grey grout. */
function tiles(): THREE.CanvasTexture {
  return canvasTex(256, (g, s) => {
    g.fillStyle = '#f2f1ec';
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#c9c7c0';
    for (let k = 0; k <= s; k += s / 8) {
      g.fillRect(k - 1, 0, 2, s);
      g.fillRect(0, k - 1, s, 2);
    }
  });
}

