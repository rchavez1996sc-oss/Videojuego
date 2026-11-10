import * as THREE from 'three';
import type { Vehicle } from './traffic';
import { overturned } from './vehicleBody';

/** Collider of the car the player drives (-1 on foot): the police see and shoot the player through it. */
export const drivenCar = { handle: -1 };

/**
 * When the player gets out: E at walking pace (by heading speed or by how fast the body really moves, so a car wedged
 * and shaking against stairs or a wall still counts as stopped), E held 0.7 s at any speed (bail out), or on its own
 * when the car lies on its side/roof, has fallen through the ground or its physics broke (NaN) for a moment.
 */
export class CarEscape {
  private held = 0;
  private stuck = 0;

  reset(): void {
    this.held = this.stuck = 0;
  }

  check(v: Vehicle, speed: number, pressed: boolean, down: boolean, dt: number, ground: (x: number, z: number) => number): 'stay' | 'exit' | 'bail' {
    const l = v.body.linvel(), moving = Math.hypot(l.x, l.y, l.z), slow = Math.min(Math.abs(speed), moving) < 4;
    const broken = !Number.isFinite(v.x + (v.y ?? 0) + v.z + moving) || (v.y ?? 0) < ground(v.x, v.z) - 3;
    this.stuck = (overturned(v) && moving < 2) || broken ? this.stuck + dt : 0;
    this.held = down ? this.held + dt : 0;
    if (broken || this.stuck > 1.5) return 'bail';
    if (pressed && slow) return 'exit';
    return this.held > 0.7 ? 'bail' : 'stay';
  }
}

/** A safe exit point when the car's own position can't be trusted (NaN or under the ground). */
export function safeExit(v: Vehicle, fallback: THREE.Vector3, ground: (x: number, z: number) => number): THREE.Vector3 {
  const ok = Number.isFinite(v.x + v.z), x = ok ? v.x : fallback.x, z = ok ? v.z : fallback.z;
  return new THREE.Vector3(x, ground(x, z) + 0.1, z);
}
