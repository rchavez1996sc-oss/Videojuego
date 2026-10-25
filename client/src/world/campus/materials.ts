import * as THREE from 'three';
import type { Lighting } from '../../render/lighting';
import { concrete, plaster, slabs } from '../../render/urbanTextures';
import { photo } from '../../render/photoTextures';
import { deck, rock, wood, type PbrSet } from '../../render/textures';
import { bakeGroups } from '../bake';
import { foliage } from '../malecon/textures';
import { chainLink } from '../malecon/beach';
import { barsTexture } from './grounds';

/** Painted plaster walls of the faculties (photos: cream Química, white/grey Geológica, yellow Comedor…). */
const WALLS: Record<string, string> = {
  uniCream: '#e6dcc4', uniGrey: '#c8c6c0', uniWhite: '#efeee9', uniYellow: '#e3b443', uniRed: '#b02a22', uniFrame: '#d5d3cd',
  uniTerracotta: '#a35a3c', uniOrange: '#d9772e', roofWhite: '#e9e8e3', uniStone: '#9a958c',
};

export function campusMaterials(lighting: Lighting): Record<string, THREE.Material> {
  const std = (key: string, p: THREE.MeshStandardMaterialParameters) => lighting.setup(new THREE.MeshStandardMaterial(p), key);
  const pl = plaster(), co = concrete(), fo = foliage(), rk = rock(), stone = photo('stoneWall') ?? rk;
  const m: Record<string, THREE.Material> = {
    winGlass: std('winGlass', { color: '#4d5f6a', roughness: 0.08, metalness: 0.7, envMapIntensity: 1.4 }),
    darkGlass: std('darkGlass', { color: '#15191d', roughness: 0.05, metalness: 0.85, envMapIntensity: 1.6 }),
    mullion: std('mullion', { color: '#34373a', roughness: 0.5, metalness: 0.5 }),
    paneBlue: std('paneBlue', { color: '#2f5c96', roughness: 0.3, metalness: 0.3 }),
    paneYellow: std('paneYellow', { color: '#d9ad2a', roughness: 0.35, metalness: 0.2 }),
    alu: std('alu', { color: '#b9bec2', roughness: 0.35, metalness: 0.8 }),
    laja: std('laja', { map: stone.map, normalMap: stone.normalMap, color: '#5b5852', roughness: 0.8 }),
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
    benchWood: std('benchWood', { map: wood().map, color: '#a07a52', roughness: 0.8 }),
  };
  for (const [k, c] of Object.entries(WALLS)) m[k] = std(k, { map: (k === 'uniStone' ? stone : pl).map, normalMap: (k === 'uniStone' ? stone : pl).normalMap, color: c, roughness: 0.88 });
  return m;
}

/** Same-texture families merged into vertex-coloured materials (fewer draw calls). */
export function campusBake(lighting: Lighting): { material: THREE.Material; keys: string[] }[] {
  const textured = (key: string, set: PbrSet, keys: string[], roughness: number) => ({ material: lighting.setup(new THREE.MeshStandardMaterial({ map: set.map, normalMap: set.normalMap, roughnessMap: set.roughnessMap ?? null, roughness, vertexColors: true }), key), keys });
  return [
    ...bakeGroups(lighting, ['mullion', 'paneBlue', 'paneYellow', 'alu', 'binGreen', 'fenceIron', 'lampPole']),
    textured('uni-plaster-baked', plaster(), Object.keys(WALLS).filter((k) => k !== 'uniStone'), 0.88),
    textured('concrete-baked', concrete(), ['concrete', 'parkPath', 'kerbYellow'], 0.9),
    textured('foliage-baked', foliage(), ['hedge', 'lawnBed'], 0.95),
    textured('deck-baked', deck(), ['benchWood'], 0.75),
  ];
}
