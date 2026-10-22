import * as THREE from 'three';
import { characters } from '../render/characters';

const UPPER = /Spine|Neck|Head|Shoulder|Arm|Hand/;
/** Aiming on the move: the chest and arms hold the aim, the hips and lower back keep the stride's sway. */
const CHEST = /Spine2|Neck|Head|Shoulder|Arm|Hand/;
type Parts = Record<'full' | 'lower' | 'upper' | 'body' | 'chest', THREE.AnimationClip>;
const split = new Map<string, Parts>();

/** A clip split by bone groups: full body, legs/upper body, and body/chest for aiming on the move. */
export function parts(key: string): Parts {
  let p = split.get(key);
  if (!p) {
    const full = characters.clips.get(key)!;
    const bone = (t: THREE.KeyframeTrack) => t.name.slice(0, t.name.lastIndexOf('.'));
    const clip = (tag: string, keep: (t: THREE.KeyframeTrack) => boolean) => new THREE.AnimationClip(`${key}-${tag}`, full.duration, full.tracks.filter(keep));
    p = {
      full,
      lower: clip('lo', (t) => !UPPER.test(bone(t))),
      upper: clip('up', (t) => UPPER.test(bone(t))),
      body: clip('body', (t) => !CHEST.test(bone(t))),
      chest: clip('chest', (t) => CHEST.test(bone(t))),
    };
    split.set(key, p);
  }
  return p;
}
