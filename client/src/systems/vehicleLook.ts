import * as THREE from 'three';
import type { Lighting } from '../render/lighting';
import { Builder } from '../world/buildingKit';
import { car, mototaxi, type CarKind } from '../world/urbanProps';
import { combiLivery, companyColor, type Fit } from '../world/livery';
import { carModels } from '../render/carModels';
import { deliveryBike, thermalBox } from '../world/deliveryBike';

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

/** A motorcycle in traffic: the modelled bike (repainted) when loaded — every other one a courier with the thermal box — else the procedural delivery bike. */
export function bikeLook(lighting: Lighting, mats: VehicleMats, i: number): THREE.Group {
  const model = carModels.pick('delivery', i), b = new Builder(null, null);
  if (!model) return deliveryBike(b, i % 3), new THREE.Group().add(...buildLoose(b, lighting, mats));
  const g = carModels.make(model, 'delivery', ['moto0', 'moto1', 'car1', 'car2', 'car4', 'car0'][i % 6]);
  if (i % 2 === 0) (thermalBox(b, i % 3, BOX_LIFT, BOX_BACK), g.add(...buildLoose(b, lighting, mats)));
  return g;
}
const BOX_LIFT = 0.02, BOX_BACK = 0.12;
