import * as THREE from 'three';
import type { Player } from '../entities/player';
import type { ThirdPersonCamera } from './camera';
import type { Sfx, Ground } from '../audio/sfx';
import type { Input } from './input';

/** Camera bob/sway, landing dip, sprint FOV and footstep sounds driven by the player's gait. */
export class MoveFeel {
  private lastStep = 0;
  private landed = false;

  constructor(private player: Player, private tpc: ThirdPersonCamera, private sfx: Sfx, private ground: () => Ground) {}

  update(dt: number, input: Input): void {
    const { player, tpc, sfx } = this;
    const moveK = Math.min(player.speed / 6, 1);
    const amp = (0.012 + 0.02 * moveK) * moveK * (input.aiming ? 0.3 : 1);
    const stepWave = Math.abs(Math.sin(player.stepPhase * Math.PI));
    tpc.bob = THREE.MathUtils.damp(tpc.bob, (stepWave - 0.6) * amp - (player.sprinting ? 0.05 : moveK * 0.02), 25, dt);
    tpc.sway = THREE.MathUtils.damp(tpc.sway, Math.sin(player.stepPhase * Math.PI) * amp * 0.5, 20, dt);
    const step = Math.floor(player.stepPhase);
    if (step !== this.lastStep && player.speed > 0.8 && !player.airborne) sfx.footstep(Math.min(1, player.speed / 6) * (player.crouchAmount > 0.5 ? 0.4 : 1), this.ground());
    this.lastStep = step;
    if (player.landImpact > 0.6 && !this.landed) sfx.footstep(1.6, this.ground());
    this.landed = player.landImpact > 0.6;
    tpc.dip = player.landImpact * 0.3;
    tpc.fovBoost = THREE.MathUtils.damp(tpc.fovBoost, player.sprinting ? 7 : 0, 6, dt);
  }
}
