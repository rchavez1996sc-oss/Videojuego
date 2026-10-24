import type { Orchestra } from './fanfare';
import { drum, flute, mallet, organ, powerChord, strum, synthHit, trumpet } from './instruments';

type Score = (o: Orchestra) => void;
const C = [48, 55, 60, 64, 67], F = [53, 57, 60, 65], G = [55, 59, 62, 67];

/** Victory stingers in other styles and instruments (each under 3 s). MIDI 60 = C4. */
export const VICTORY_STYLES: Score[] = [
  (o) => {
    [[0, 67], [0.13, 67], [0.26, 67], [0.4, 72], [0.75, 76], [0.95, 72]].forEach(([at, n]) => trumpet(o, at, n, 0.1, 2.4));
    trumpet(o, 1.15, 79, 1.0, 2.6);
    o.end(2.1, 2.8);
  },
  (o) => {
    [[0, 0.12], [0.16, 0.12], [0.32, 0.25]].forEach(([at, d]) => [72, 76].forEach((n) => trumpet(o, at, n, d, 0.9)));
    [74, 77].forEach((n) => trumpet(o, 0.65, n, 0.2, 0.9));
    [76, 79].forEach((n) => trumpet(o, 0.9, n, 1.1, 1));
    o.brass(0.9, 48, 1.1, 0.8);
    o.timpani(0.9, 36, 0.8);
    o.cymbal(0.9, 0.6);
    o.end(2, 2.8);
  },
  (o) => {
    [[0, 76], [0.18, 79], [0.36, 81], [0.54, 79], [0.72, 76], [0.9, 74]].forEach(([at, n]) => flute(o, at, n, 0.15, 1));
    flute(o, 1.1, 72, 1.1, 1.1);
    [0, 0.36, 0.72].forEach((at) => strum(o, at, [60, 64, 67, 72, 76], 0.7, 0.85, 0.6));
    strum(o, 1.1, [60, 64, 67, 72, 76], 1, 0.85, 1.4);
    [0, 0.54, 0.72, 1.1].forEach((at, i) => drum(o, at, i === 3 ? 1.1 : 0.8));
    o.end(2.1, 2.9);
  },
  (o) => {
    o.snare(0, 0.9, 0.55);
    [[0.6, 67], [0.72, 72], [0.84, 76]].forEach(([at, n]) => trumpet(o, at, n, 0.08, 1));
    trumpet(o, 0.98, 79, 0.9, 1);
    o.brass(0.98, 48, 0.9, 0.9);
    o.brass(0.98, 55, 0.9, 0.9);
    o.snare(0.98, 1.1);
    o.cymbal(0.98, 0.9);
    o.end(2, 2.8);
  },
  (o) => {
    [0, 0.3, 0.6].forEach((at, i) => drum(o, at, 0.7 + i * 0.12, true));
    o.brass(0.9, 36, 1.2, 1.1);
    o.brass(0.9, 43, 1.2, 1);
    trumpet(o, 0.9, 72, 0.25, 1);
    trumpet(o, 1.15, 79, 0.9, 1);
    drum(o, 0.9, 1.2, true);
    o.cymbal(0.9, 0.7);
    o.end(2.1, 2.9);
  },
  (o) => {
    organ(o, 0, F, 0.5, 1.6);
    organ(o, 0.55, [...C, 72], 1.4, 1.9);
    o.pad(0.55, [60, 64, 67, 72], 1.3, 2);
    o.bell(0.55, 72, 1, 1.6);
    o.end(2, 2.8);
  },
  (o) => {
    powerChord(o, 0, 40, 0.18, 1);
    powerChord(o, 0.24, 40, 0.18, 1);
    powerChord(o, 0.48, 45, 0.3, 1);
    powerChord(o, 0.85, 48, 1.2, 1.1);
    [0, 0.24, 0.48, 0.85].forEach((at) => drum(o, at, 0.9));
    o.snare(0.48, 0.8);
    o.cymbal(0.85, 1);
    o.end(2, 2.8);
  },
  (o) => {
    [72, 76, 79, 84, 79, 84, 88].forEach((n, i) => mallet(o, i * 0.09, n, 0.9));
    [0, 0.27, 0.54].forEach((at) => drum(o, at, 0.6));
    [72, 76, 79, 84].forEach((n) => mallet(o, 0.7, n, 1));
    strum(o, 0.7, [48, 55, 60, 64, 67], 0.8, 0.6, 1.2);
    drum(o, 0.7, 1);
    o.cymbal(0.7, 0.5);
    o.end(1.8, 2.6);
  },
  (o) => {
    synthHit(o, 0.6, [48, 55, 60, 64, 67, 72], 1.1, 0.9, 0.6);
    drum(o, 0.6, 1, true);
    o.brass(0.6, 36, 1.0, 1);
    o.cymbal(0.6, 0.8);
    o.end(1.9, 2.8);
  },
  (o) => {
    [[0, 0.1], [0.14, 0.1], [0.28, 0.3]].forEach(([at, d]) => [72, 76].forEach((n) => trumpet(o, at, n, d, 0.9)));
    [74, 77].forEach((n) => trumpet(o, 0.62, n, 0.18, 0.9));
    [76, 79].forEach((n) => trumpet(o, 0.84, n, 1.1, 1));
    [0, 0.28, 0.62].forEach((at, i) => strum(o, at, i === 2 ? G : C, 0.8, 0.7, 0.5));
    strum(o, 0.84, [...C, 72], 1, 0.7, 1.3);
    [0, 0.28, 0.62, 0.84].forEach((at) => drum(o, at, 0.7));
    o.end(2, 2.8);
  },
];
