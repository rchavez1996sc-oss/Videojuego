import * as THREE from 'three';
import type { Lighting } from '../render/lighting';
import { Builder } from '../world/buildingKit';
import { car, mototaxi, type CarKind } from '../world/urbanProps';
import { combiLivery, companyColor, type Fit } from '../world/livery';
import { carModels } from '../render/carModels';

export interface VehicleMats { materials: Record<string, THREE.Material>; bake: { material: THREE.Material; keys: string[] }[] }

let glass: THREE.Material | null = null;

/**
 * The visible body of a car kind: a modelled car when one stands in for the kind (`model`), otherwise the procedural
 * one (combis and micros with their company livery). `instanced`: body paint taken from the instance colour.
 * Wheels to spin are in `userData.wheels` (with `userData.wheelR`).
 */
export function vehicleLook(lighting: Lighting, mats: VehicleMats, kind: CarKind | 'moto', paint: string, model: string | null, company?: number, instanced = false): THREE.Group {
  if (model) {
    const bus = kind === 'combi' || kind === 'micro', g = carModels.make(model, kind, instanced ? null : bus && company !== undefined ? companyColor(company) : paint);
    if (bus && company !== undefined) g.add(combiLivery(lighting, company, kind === 'micro', fitTo(carModels.bodySize(model, kind), kind === 'micro')));
    return g;
  }
  const b = new Builder(null, null), g = new THREE.Group();
  if (kind === 'moto') mototaxi(b, new THREE.Vector3(), 0, paint);
  else car(b, new THREE.Vector3(), 0, paint, kind);
  g.add(...buildLoose(b, lighting, mats));
  if (company !== undefined && (kind === 'combi' || kind === 'micro')) g.add(combiLivery(lighting, company, kind === 'micro'));
  g.userData.wheels = [];
  return g;
}

/** Livery band and route placard placed on a modelled body (flat flanks, band under the windows). */
function fitTo(b: THREE.Box3, micro: boolean): Fit {
  const h = b.max.y, len = b.max.z - b.min.z, mid = (b.max.z + b.min.z) / 2;
  return { len: len * 0.8, half: b.max.x + 0.015, y: h * (micro ? 0.36 : 0.47), h: h * (micro ? 0.17 : 0.2), card: [b.max.x * 0.4, h * (micro ? 0.62 : 0.66), mid + len * (micro ? 0.46 : 0.38)] };
}

/** Meshes of a vehicle built at the origin, with see-through glass (occupants show) kept out of the bake. */
export function buildLoose(b: Builder, lighting: Lighting, mats: VehicleMats): THREE.Mesh[] {
  glass ??= lighting.setup(new THREE.MeshStandardMaterial({ color: '#1c2228', roughness: 0.05, metalness: 0.2, envMapIntensity: 1.6, transparent: true, opacity: 0.72 }), 'glass-see');
  return b.build({ ...mats.materials, glass }, 0.5, mats.bake.map((x) => ({ ...x, keys: x.keys.filter((k) => k !== 'glass') })));
}
