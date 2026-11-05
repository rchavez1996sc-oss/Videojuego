import * as THREE from 'three';

/**
 * Mixamo clips come at 30 keys/s and three.js blends them linearly (slerp for rotations), so joint speed jumps every
 * 33 ms and fast moves read as stepped. Each gap gets a midpoint from a Catmull-Rom curve through the neighbouring
 * keys (quaternions kept on one hemisphere, then normalised): 60 keys/s on a smooth path.
 */
export function smoothClip(clip: THREE.AnimationClip): THREE.AnimationClip {
  clip.tracks = clip.tracks.map((t) => {
    const n = t.times.length, w = t.getValueSize();
    if (n < 3) return t;
    const quat = t instanceof THREE.QuaternionKeyframeTrack, v = Float32Array.from(t.values);
    if (quat) for (let i = 1; i < n; i++) {
      let dot = 0;
      for (let k = 0; k < 4; k++) dot += v[(i - 1) * 4 + k] * v[i * 4 + k];
      if (dot < 0) for (let k = 0; k < 4; k++) v[i * 4 + k] *= -1;
    }
    const times = new Float32Array(n * 2 - 1), values = new Float32Array((n * 2 - 1) * w);
    for (let i = 0; i < n; i++) {
      times[i * 2] = t.times[i];
      values.set(v.subarray(i * w, i * w + w), i * 2 * w);
      if (i === n - 1) break;
      times[i * 2 + 1] = (t.times[i] + t.times[i + 1]) / 2;
      const a = Math.max(0, i - 1), d = Math.min(n - 1, i + 2), o = (i * 2 + 1) * w;
      let len = 0;
      for (let k = 0; k < w; k++) {
        const p0 = v[a * w + k], p1 = v[i * w + k], p2 = v[(i + 1) * w + k], p3 = v[d * w + k];
        values[o + k] = (-p0 + 9 * p1 + 9 * p2 - p3) / 16;
        len += values[o + k] ** 2;
      }
      if (quat) for (let k = 0; k < 4; k++) values[o + k] /= Math.sqrt(len) || 1;
    }
    const Track = t.constructor as new (name: string, times: Float32Array, values: Float32Array) => THREE.KeyframeTrack;
    return new Track(t.name, times, values);
  });
  return clip;
}
