export interface TerrainDef {
  size: number;
  playable: number;
  resolution: number;
  seed: number;
  rolling: number;
  hillHeight: number;
  mountainHeight: number;
  valleyWidth: number;
  road: [number, number][];
  flatten: { x: number; z: number; r: number }[];
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
  grass: { height: number; colorBase: string; colorTip: string };
}

export interface ChapterDef {
  id: string;
  title: string;
  terrain: TerrainDef;
  biome: BiomeDef;
  village: { x: number; z: number; radius: number; houses: number; church: { x: number; z: number; rot: number } };
  scatter: { rocks: number; trees: number; seed: number };
  spawn: { x: number; z: number; yaw: number };
  /** Facing used to lay out the practice range and test structures around the spawn. */
  rangeYaw?: number;
  range?: [number, number][];
  enemies?: { type: string; x: number; z: number; y?: number; patrol?: [number, number][] }[];
  structures?: import('../world/structures').StructureDef[];
}
