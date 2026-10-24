import type { Orchestra } from './fanfare';
import { VICTORY_STYLES } from './victoryStyles';

type Score = (o: Orchestra) => void;
const chord = (o: Orchestra, at: number, notes: number[], dur: number, vel = 1) => notes.forEach((n) => o.brass(at, n, dur, vel));

/** Victory stingers (each under 3 s, faded by `end`): ten orchestral, then ten other styles from `victoryStyles.ts`. MIDI: 36 = C2, 48 = C3, 60 = C4. */
export const VICTORIES: Score[] = [
  (o) => {
    o.roll(0, 36, 0.5, 0.7);
    o.cymbal(0.5, 0.9, 0.45);
    [[0, 55], [0.12, 55], [0.24, 60]].forEach(([at, n]) => o.brass(at, n, 0.05, 0.8));
    chord(o, 0.5, [36, 48, 55, 60, 64, 67, 72, 76], 1.2);
    o.pad(0.5, [48, 55, 60, 64, 67, 72], 1.0, 1.1);
    o.timpani(0.5, 36, 1);
    o.timpani(1.7, 36, 0.6);
    o.end(2.3, 3);
  },
  (o) => {
    chord(o, 0, [36, 48, 55, 60, 64, 67], 0.9);
    o.timpani(0, 36, 1);
    o.cymbal(0, 1);
    o.end(1.6, 2.4);
  },
  (o) => {
    [60, 64, 67].forEach((n, i) => o.brass(i * 0.11, n, 0.08, 0.85));
    chord(o, 0.33, [48, 55, 60, 64, 67, 72], 1.1);
    o.pad(0.33, [60, 64, 67, 72], 1.0);
    o.timpani(0.33, 36, 1);
    o.cymbal(0.33, 0.8);
    o.end(1.9, 2.7);
  },
  (o) => {
    o.brass(0, 55, 0.18, 0.9);
    chord(o, 0.22, [48, 60, 64], 1.3, 1);
    o.pad(0.22, [55, 60, 64, 67], 1.3, 1.3);
    o.timpani(0.22, 36, 0.8);
    o.end(2, 2.8);
  },
  (o) => {
    o.roll(0, 36, 0.8, 0.9);
    o.cymbal(0.8, 0.8, 0.7);
    o.pad(0.8, [48, 55, 60, 64, 67, 72, 76], 1.1, 1.6);
    o.timpani(0.8, 36, 1);
    o.end(2.1, 2.9);
  },
  (o) => {
    chord(o, 0, [41, 53, 57, 60, 65], 0.45, 0.85);
    chord(o, 0.55, [36, 48, 55, 60, 64, 67], 1.1);
    o.timpani(0, 41, 0.7);
    o.timpani(0.55, 36, 1);
    o.cymbal(0.55, 0.8);
    o.end(1.9, 2.7);
  },
  (o) => {
    o.snare(0, 0.8, 0.45);
    [[0.5, 55], [0.62, 60], [0.74, 64], [0.86, 67]].forEach(([at, n]) => o.brass(at, n, 0.07, 0.9));
    chord(o, 1.0, [43, 55, 60, 64, 67], 0.9);
    o.snare(1.0, 1);
    o.cymbal(1.0, 0.8);
    o.end(2.1, 2.9);
  },
  (o) => {
    chord(o, 0, [48, 55, 60, 65, 67], 0.55, 0.9);
    chord(o, 0.6, [48, 55, 60, 64, 67], 1.0);
    o.pad(0, [60, 65, 67], 0.5, 0.8);
    o.pad(0.6, [60, 64, 67, 72], 1.0, 1);
    o.timpani(0.6, 36, 0.9);
    o.cymbal(0.6, 0.6);
    o.end(1.9, 2.7);
  },
  (o) => {
    o.brass(0, 36, 1.0, 1.6);
    o.brass(0, 48, 1.0, 1.6);
    o.brass(0, 55, 1.0, 1.2);
    o.tamtam(0, 0.6);
    o.timpani(0, 36, 1.3);
    o.pad(0.1, [64, 67, 72, 76, 79], 1.2, 1.8);
    o.end(1.8, 2.7);
  },
  (o) => {
    [84, 88, 91, 96].forEach((n, i) => o.bell(i * 0.09, n, 0.7, 1.4));
    chord(o, 0.4, [48, 55, 60, 64, 67, 72], 1.0, 0.9);
    o.timpani(0.4, 36, 0.8);
    o.cymbal(0.4, 0.7);
    o.end(1.9, 2.7);
  },
  ...VICTORY_STYLES,
];

/** Ten short defeat stingers (each under 3 s). The first is the original low minor blow. */
export const DEFEATS: Score[] = [
  (o) => {
    o.tamtam(0, 1);
    o.timpani(0, 36, 1);
    chord(o, 0, [36, 43, 48, 51], 0.9, 0.9);
    o.pad(0.1, [48, 51, 55], 1.0, 0.8);
    o.end(2.2, 3);
  },
  (o) => {
    o.tamtam(0, 1.6);
    o.pad(0.05, [36, 48, 51, 55], 1.4, 3);
    o.end(2, 2.9);
  },
  (o) => {
    o.timpani(0, 36, 1.1);
    o.brass(0, 55, 0.5, 1.2);
    o.brass(0, 43, 0.5, 1);
    o.brass(0.55, 51, 1.0, 1.2);
    o.brass(0.55, 39, 1.0, 1);
    o.pad(0.55, [48, 51, 55], 1.0, 1.4);
    o.end(2, 2.8);
  },
  (o) => {
    [24, 36, 37, 43].forEach((n) => o.brass(0, n, 2.1, 0.8, n - 1, 0.8));
    o.pad(0.2, [36, 39, 43], 2.0, 1.6);
    o.tamtam(0, 0.9);
    o.tamtam(1.5, 0.45);
    o.timpani(0, 31, 1);
    o.timpani(1.5, 30, 0.5);
    o.end(2.5, 3);
  },
  (o) => {
    o.timpani(0, 36, 1);
    o.timpani(0.28, 31, 0.9);
    o.pad(0.28, [48, 51, 55, 60], 1.2, 1.1);
    o.end(1.9, 2.8);
  },
  (o) => {
    o.brass(0, 55, 0.9, 0.9, 49);
    o.brass(0, 48, 0.9, 0.9, 42);
    o.timpani(0.9, 30, 0.9);
    o.tamtam(0.9, 0.6);
    o.end(1.8, 2.7);
  },
  (o) => {
    o.pad(0, [24, 36, 43], 1.6, 2.2);
    [0.2, 0.42, 1.1, 1.32].forEach((at, i) => o.timpani(at, 31, i % 2 ? 0.6 : 0.9));
    o.tamtam(0, 0.6);
    o.end(2, 2.9);
  },
  (o) => {
    chord(o, 0, [36, 42, 45, 48, 51], 0.7, 1);
    o.timpani(0, 36, 1);
    o.cymbal(0, 0.5);
    o.end(1.6, 2.5);
  },
  (o) => {
    o.pad(0, [48, 51, 55], 0.8, 2.2);
    o.pad(0.75, [44, 48, 51], 0.6, 2.1);
    o.pad(1.3, [43, 47, 50], 0.6, 2);
    o.timpani(1.3, 31, 0.7);
    o.end(2.1, 2.9);
  },
  (o) => {
    o.bell(0, 36, 3.5, 2.6);
    o.bell(0.9, 36, 3, 2.2);
    o.pad(0.1, [48, 51, 55], 1.3, 1.8);
    o.end(2, 2.9);
  },
];
