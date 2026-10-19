export interface WeaponDef {
  name: string;
  damage: number;
  headshot: number;
  rpm: number;
  magazine: number;
  reserve: number;
  reloadTime: number;
  reloadEmptyTime: number;
  range: number;
  falloffStart: number;
  falloffMin: number;
  spreadHip: number;
  spreadAim: number;
  spreadMove: number;
  spreadPerShot: number;
  spreadMax: number;
  spreadRecover: number;
  recoilUp: number;
  recoilSide: number;
  recoilRecover: number;
  pattern: [number, number][];
  tracerEvery: number;
  modes: ('auto' | 'semi')[];
}
