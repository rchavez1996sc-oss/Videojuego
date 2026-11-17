import * as THREE from 'three';
import type { Lighting } from '../../render/lighting';
import { photo } from '../../render/photoTextures';
import { concrete, plaster } from '../../render/urbanTextures';
import { deck, rock, wood } from '../../render/textures';
import { foliage } from '../malecon/textures';

/** Casona wall paints seen on the photos: oxblood, cobalt, ochre, rose, cream, sea green, terracotta, white. */
export const CASONA_PAINTS: [string, string][] = [
  ['paint-oxblood', '#8f3328'], ['paint-cobalt', '#2f55a8'], ['paint-ochre', '#d39a36'], ['paint-rose', '#d98a8c'],
  ['paint-cream', '#e6d8b8'], ['paint-seagreen', '#8fb59a'], ['paint-terra', '#bb6440'], ['paint-limewhite', '#eeeae0'],
  ['paint-mustard', '#d8b24a'], ['paint-lilac', '#a98fb8'],
];
/** Wood and ironwork trims of balconies, shutters and doors. */
export const TRIMS = ['trimGreen', 'trimBrown', 'trimWhite', 'trimBlue'];

/** Materials of chapter 4 on top of the shared barrio set. */
export function barrancoMaterials(lighting: Lighting): Record<string, THREE.Material> {
  const std = (key: string, p: THREE.MeshStandardMaterialParameters) => lighting.setup(new THREE.MeshStandardMaterial(p), key);
  const pw = photo('paintWall') ?? plaster(), pl = plaster(), co = concrete(), wd = wood(), dk = deck(), rk = rock(), fo = foliage();
  const ph = (k: string) => photo(k) ?? rk;
  const cw = photo('casonaWall') ?? pw, hw = photo('humidWall') ?? pl, pwd = photo('paintedWood') ?? wd, bm = photo('beamWood') ?? wd, bp = photo('bridgePlanks') ?? dk;
  const ps = photo('plinthStone') ?? co, st = photo('stucco') ?? co;
  const pbr = (t: { map: THREE.Texture | null; normalMap: THREE.Texture | null; roughnessMap?: THREE.Texture | null }) => ({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap ?? null });
  const m: Record<string, THREE.Material> = {
    ochreWall: std('ochreWall', { ...pbr(hw), color: '#d6a54a', roughness: 0.9 }),
    creamCornice: std('creamCornice', { ...pbr(st), color: '#efe6cf', roughness: 0.8 }),
    trimGreen: std('trimGreen', { ...pbr(pwd), color: '#2f5a3d', roughness: 0.6 }),
    trimBrown: std('trimBrown', { ...pbr(pwd), color: '#5a3a26', roughness: 0.65 }),
    trimWhite: std('trimWhite', { ...pbr(pwd), color: '#efede6', roughness: 0.55 }),
    trimBlue: std('trimBlue', { ...pbr(pwd), color: '#2c4c6e', roughness: 0.6 }),
    shutterWood: std('shutterWood', { ...pbr(pwd), color: '#6d4a30', roughness: 0.7 }),
    bridgeDeck: std('bridgeDeck', { ...pbr(bp), color: '#c98a6a', roughness: 0.6 }),
    bridgeWood: std('bridgeWood', { ...pbr(bm), color: '#7a5642', roughness: 0.62 }),
    cobble: std('cobble', { ...pbr(photo('mossCobble') ?? ph('cobble')), roughness: 0.85 }),
    stairStone: std('stairStone', { ...pbr(ps), color: '#d8d2c6', roughness: 0.85 }),
    paverRed: std('paverRed', { ...pbr(ph('terracotta')), color: '#ffffff', roughness: 0.8 }),
    roofTile: std('roofTileClay', { map: ph('roofTiles').map, normalMap: ph('roofTiles').normalMap, color: '#c07a55', roughness: 0.8 }),
    lampPole: std('lampPole', { color: '#1f3a2c', roughness: 0.45, metalness: 0.55 }),
    globe: std('globe', { color: '#f7f2e4', roughness: 0.3, emissive: '#fff1d0', emissiveIntensity: 0.35 }),
    hedge: std('hedge', { map: fo.map, normalMap: fo.normalMap, color: '#7d8f5a', roughness: 0.95 }),
    flowers: std('flowers', { map: fo.map, normalMap: fo.normalMap, color: '#ff8fb8', emissive: '#3a0a1e', emissiveIntensity: 0.4, roughness: 0.95 }),
    bougainvillea: std('bougainvillea', { map: fo.map, normalMap: fo.normalMap, color: '#d63a86', emissive: '#2a0418', emissiveIntensity: 0.25, roughness: 0.95, flatShading: true }),
    shrub: std('shrub', { map: fo.map, normalMap: fo.normalMap, color: '#5d6b3a', roughness: 0.95 }),
    soilBed: std('soilBed', { map: (photo('soil') ?? rk).map, normalMap: (photo('soil') ?? rk).normalMap, color: '#6e5a48', roughness: 0.95 }),
    flowerRed: std('flowerRed', { map: fo.map, normalMap: fo.normalMap, color: '#ff6a5a', emissive: '#3a0606', roughness: 0.95 }),
    benchWood: std('benchWood', { ...pbr(bp), color: '#a07a52', roughness: 0.8 }),
    churchYellow: std('churchYellow', { ...pbr(cw), color: '#e2b23e', roughness: 0.88 }),
    churchWhite: std('churchWhite', { ...pbr(st), color: '#f3efe4', roughness: 0.8 }),
    libraryPink: std('libraryPink', { ...pbr(cw), color: '#e09a94', roughness: 0.88 }),
    pavement: std('pavement', { map: ph('slabs').map, normalMap: ph('slabs').normalMap, color: '#c4bdb0', roughness: 0.9 }),
    kerbYellow: std('kerbYellow', { map: co.map, color: '#e0b830', roughness: 0.8 }),
    tramWood: std('tramWood', { ...pbr(pwd), color: '#7a4a28', roughness: 0.55 }),
    lhBlack: std('lhBlack', { color: '#19191b', roughness: 0.5, metalness: 0.2 }),
    alu: std('alu', { color: '#b9bec2', roughness: 0.35, metalness: 0.8 }),
    steelDark: std('steelDark', { color: '#2b2e31', roughness: 0.5, metalness: 0.6 }),
    fenceIron: std('fenceIron', { color: '#2e2622', roughness: 0.55, metalness: 0.5 }),
    awningRed: std('awningRed', { color: '#c0261e', roughness: 0.8 }),
    tentWhite: std('tentWhite', { color: '#efeee8', roughness: 0.9, side: THREE.DoubleSide }),
    planter: std('planter', { map: co.map, color: '#8a5a40', roughness: 0.9 }),
    glassClear: std('glassClear', { color: '#cfe3ea', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.22, depthWrite: false }),
    bronze: std('bronze', { color: '#6a5634', roughness: 0.42, metalness: 0.75 }),
    floorTile: std('floorTile', { ...pbr(ph('checker')), color: '#ffffff', roughness: 0.55 }),
    lampShade: std('lampShade', { color: '#f4efe4', emissive: '#fff2d6', emissiveIntensity: 0.6, roughness: 0.6 }),
    roomLit: std('roomLit', { color: '#2a2b2c', roughness: 0.25, emissive: '#ffd9a0', emissiveIntensity: 0 }),
    curtainCream: std('curtainCream', { color: '#e8dcc0', roughness: 0.95, emissive: '#3a2a14', emissiveIntensity: 0.0001 }),
    curtainRed: std('curtainRed', { color: '#8a2a22', roughness: 0.95, emissive: '#2a0a04', emissiveIntensity: 0.0001 }),
    kioskBlue: std('kioskBlue', { color: '#1f4f9a', roughness: 0.5, metalness: 0.4 }),
    concretePole: std('concretePole', { map: co.map, normalMap: co.normalMap, color: '#b9b4aa', roughness: 0.9 }),
    insulator: std('insulator', { color: '#d9d6cc', roughness: 0.3 }),
    poolWater: std('poolWater', { color: '#2f7f92', roughness: 0.05, metalness: 0.3 }),
    granite: std('granite', { map: co.map, normalMap: co.normalMap, color: '#9d988f', roughness: 0.7 }),
  };
  for (const [k, c] of CASONA_PAINTS) m[k] = std(k, { ...pbr(cw), color: c, roughness: 0.9 });
  return m;
}
