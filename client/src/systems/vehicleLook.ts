import * as THREE from 'three';
import type { Lighting } from '../render/lighting';
import { Builder } from '../world/buildingKit';
import { car, type CarKind } from '../world/urbanProps';
import { combiLivery } from '../world/livery';
import { carModels } from '../render/carModels';

export interface VehicleMats { materials: Record<string, THREE.Material>; bake: { material: THREE.Material; keys: string[] }[] }

let glass: THREE.Material | null = null;

/**
 * The visible body of a car kind: a modelled car when one stands in for the kind (`model`), otherwise the procedural
 * one (combis and micros with their company livery). `instanced`: body paint taken from the instance colour.
 * Wheels to spin are in `userData.wheels` (with `userData.wheelR`).
 */
export function vehicleLook(lighting: Lighting, mats: VehicleMats, kind: CarKind, paint: string, model: string | null, company?: number, instanced = false): THREE.Group {
  if (model) return carModels.make(model, kind, instanced ? null : paint);
  const b = new Builder(null, null), g = new THREE.Group();
  car(b, new THREE.Vector3(), 0, paint, kind);
  g.add(...buildLoose(b, lighting, mats));
  if (company !== undefined && (kind === 'combi' || kind === 'micro')) g.add(combiLivery(lighting, company, kind === 'micro'));
  g.userData.wheels = [];
  return g;
}

/** Meshes of a vehicle built at the origin, with see-through glass (occupants show) kept out of the bake. */
export function buildLoose(b: Builder, lighting: Lighting, mats: VehicleMats): THREE.Mesh[] {
  glass ??= lighting.setup(new THREE.MeshStandardMaterial({ color: '#1c2228', roughness: 0.05, metalness: 0.2, envMapIntensity: 1.6, transparent: true, opacity: 0.72 }), 'glass-see');
  return b.build({ ...mats.materials, glass }, 0.5, mats.bake.map((x) => ({ ...x, keys: x.keys.filter((k) => k !== 'glass') })));
}
