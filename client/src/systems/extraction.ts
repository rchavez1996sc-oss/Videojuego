import * as THREE from 'three';
import { Helicopter } from '../fx/helicopter';
import { RotorSound } from '../audio/rotor';
import type { Lighting } from '../render/lighting';
import type { Mixer } from '../audio/mixer';

/** Data for a capture objective's deadline: the regime flies the target out by helicopter. */
export interface ExtractionDef { radius: number; seconds: number; warn: number; alert: string; arrived: string }

/**
 * Countdown that starts when the player first comes within `radius` of the target: an alert, `seconds` to capture,
 * a helicopter heard and seen approaching from the sea for the last `warn` seconds, then a short shot of it landing
 * on the target and the mission lost. `stop()` cancels it (target captured or dead).
 */
export class Extraction {
  left = -1;
  onAlert: (text: string) => void = () => {};
  onArrived: (text: string, eye: THREE.Vector3, look: THREE.Vector3) => void = () => {};
  private heli: Helicopter;
  private rotor: RotorSound | null = null;
  private stopped = false;
  private from: THREE.Vector3;
  private hover: THREE.Vector3;

  constructor(private def: ExtractionDef, private target: THREE.Vector3, scene: THREE.Scene, lighting: Lighting, private mixer: Mixer) {
    this.heli = new Helicopter(lighting);
    this.heli.group.visible = false;
    scene.add(this.heli.group);
    this.hover = target.clone().add(new THREE.Vector3(0, 11, 0));
    this.from = target.clone().add(new THREE.Vector3(-260, 70, 520));
  }

  get running(): boolean {
    return this.left >= 0 && !this.stopped;
  }

  update(dt: number, player: THREE.Vector3, camera: THREE.Vector3): void {
    if (this.stopped) return;
    if (this.left < 0) {
      if (player.distanceTo(this.target) < this.def.radius) {
        this.left = this.def.seconds;
        this.onAlert(this.def.alert);
      }
      return;
    }
    if (this.left <= 0) return this.idle(dt, camera);
    this.left = Math.max(0, this.left - dt);
    const k = 1 - this.left / this.def.warn;
    if (k > 0) {
      this.rotor ??= new RotorSound(this.mixer);
      const h = this.heli.group;
      h.visible = true;
      h.position.lerpVectors(this.from, this.hover, Math.min(1, k * k * (3 - 2 * k)));
      const d = this.hover.clone().sub(this.from);
      h.rotation.set(0, Math.atan2(-d.x, -d.z), 0);
      h.rotateX(-0.12 * (1 - Math.min(1, k)));
      this.heli.update(dt);
      this.rotor.distance = h.position.distanceTo(camera);
    }
    if (this.left === 0) {
      const eye = this.target.clone().add(new THREE.Vector3(-22, 6, -26));
      this.onArrived(this.def.arrived, eye, this.hover);
    }
  }

  /** Keeps the rotors turning during the closing shot. */
  idle(dt: number, camera: THREE.Vector3): void {
    if (!this.heli.group.visible) return;
    this.heli.update(dt);
    if (this.rotor) this.rotor.distance = this.heli.group.position.distanceTo(camera);
  }

  stop(): void {
    this.stopped = true;
    this.rotor?.stop();
    this.rotor = null;
    this.heli.group.visible = false;
  }
}
