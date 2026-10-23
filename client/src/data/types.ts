export interface TerrainDef {
  size: number;
  playable: number;
  /** z of the seaward (+z) invisible wall when it lies beyond the playable square (a pier reaching out). */
  seaReach?: number;
  resolution: number;
  seed: number;
  rolling: number;
  hillHeight: number;
  mountainHeight: number;
  valleyWidth: number;
  road: [number, number][];
  roadWidth?: number;
  flatten: { x: number; z: number; r: number }[];
  /** Bands along x (centre z, half width) that are paved: no grass grows there. */
  paved?: { z: number; half: number }[];
  coast?: import('../world/coast').CoastDef;
}

export interface BiomeDef {
  sunElevation: number;
  sunAzimuth: number;
  turbidity: number;
  rayleigh: number;
  mieCoefficient: number;
  mieDirectionalG: number;
  exposure: number;
  sunColor: string;
  sunIntensity: number;
  ambient: number;
  fogColor: string;
  fogDensity: number;
  colors: Record<'grassLush' | 'grassDry' | 'dirt' | 'road' | 'rock' | 'snow', string>;
  snowLine: number;
  grass: { height: number; colorBase: string; colorTip: string; density?: number };
}

export interface ChapterDef {
  id: string;
  number?: number;
  title: string;
  /** Debug camera views for screenshots: [x, dy, z, lookX, lookDy, lookZ]. */
  views?: [number, number, number, number, number, number][];
  terrain: TerrainDef;
  biome: BiomeDef;
  village?: { x: number; z: number; radius: number; houses: number; church: { x: number; z: number; rot: number } };
  barrio?: import('../world/barrio').BarrioDef;
  farCity?: import('../world/farCity').FarCityDef;
  malecon?: import('../world/malecon/layout').MaleconDef;
  /** Once a shot is heard, every mobile enemy on the map converges on the player. */
  alertAll?: boolean;
  /** Manifest `art` keys for the prologue plates (default: chapter 1's) and the score's mood. */
  introPlates?: string[];
  introScore?: 'war' | 'intrigue';
  /** Static tiles and tree groups farther than this (m) stop casting shadows. */
  shadowRange?: number;
  life?: import('../systems/cityLife').LifeDef;
  civilians?: { count: number; seed: number };
  squad?: number;
  lives?: number;
  /** Prologue paragraphs shown while the chapter loads. */
  intro?: string[];
  objective?: import('../systems/objective').ObjectiveDef;
  scatter: { rocks: number; trees: number; seed: number };
  spawn: { x: number; z: number; yaw: number };
  /** Facing used to lay out the practice range and test structures around the spawn. */
  rangeYaw?: number;
  range?: [number, number][];
  medkits?: [number, number][];
  ammo?: [number, number][];
  enemies?: { type: string; x: number; z: number; y?: number; at?: number; patrol?: [number, number][] }[];
  structures?: import('../world/structures').StructureDef[];
}
