import table from '../data/difficulty.json';

export type DifficultyId = keyof typeof table;
export interface Difficulty { label: string; damage: number; attackers: number; reaction: number; spread: number; regenDelay: number }

export const DIFFICULTIES = table as Record<DifficultyId, Difficulty>;

function load(): DifficultyId {
  const q = new URLSearchParams(location.search).get('d');
  if (q && q in table) return q as DifficultyId;
  try {
    const saved = localStorage.getItem('tq-difficulty');
    if (saved && saved in table) return saved as DifficultyId;
  } catch {
    /* storage unavailable */
  }
  return 'veterano';
}

let currentId = load();

export const difficulty = {
  get id(): DifficultyId {
    return currentId;
  },
  get value(): Difficulty {
    return DIFFICULTIES[currentId];
  },
  set(id: DifficultyId): void {
    currentId = id;
    try {
      localStorage.setItem('tq-difficulty', id);
    } catch {
      /* storage unavailable */
    }
  },
};
