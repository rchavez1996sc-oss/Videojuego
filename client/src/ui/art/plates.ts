import { Cast, Stage } from './stage';
import { SCENES } from './scenes';

/** Renders the prologue plates one by one (yielding between them), then frees the off-screen renderer. */
export async function renderPlates(onPlate: (i: number, url: string) => void): Promise<void> {
  const cast = new Cast();
  await cast.load();
  const stage = new Stage();
  try {
    for (const [i, make] of SCENES.entries()) {
      const shot = make(cast);
      onPlate(i, stage.shoot(shot.scene, shot.camera, shot.grade, shot.sketch));
      await new Promise((r) => setTimeout(r, 30));
    }
  } finally {
    stage.dispose();
  }
}
