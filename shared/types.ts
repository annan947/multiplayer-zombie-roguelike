export type EnemyKind = 'walker' | 'runner' | 'tank' | 'spitter' | 'exploder' | 'boss';
export type Input = {
  x: number;
  y: number;
  a: number;
  fire: boolean;
  reload: boolean;
  revive: boolean;
  seq: number;
  dash?: boolean;
};
export type Player = {
  id: string;
  name: string;
  x: number;
  y: number;
  hp: number;
  ammo: number;
  scrap: number;
  kills: number;
  gun: number;
  owned: number[];
  cool: number;
  reload: number;
  input: Input;
  seen: number;
  ready: boolean;
  connected: boolean;
  damage: number;
  revive: number;
  dash: number;
  upgrade: number;
  shots: number;
  items: Record<string, number>;
  chestsOpened: number;
  lastCommand?: number;
  shield?: number;
  lastHurt?: number;
  lastFire?: number;
  frenzy?: number;
  streak?: number;
  lastLoot?: { id: string; at: number };
};
export type Enemy = {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  hp: number;
  max: number;
  cool: number;
  hit: number;
  charge: number;
  poison?: { owner: string; time: number; dps: number; spread: number };
  slow?: number;
  ability?: { phase: 'windup' | 'dash' | 'recover'; time: number; angle: number; hit: string[] };
  fuse?: number;
  bleed?: { owner: string; time: number; dps: number };
};
export type Shot = {
  id: number;
  x: number;
  y: number;
  ex: number;
  ey: number;
  gun: number;
  owner: string;
  t: number;
  ricochet?: boolean;
};
export type Event = {
  id: number;
  kind:
    | 'hit'
    | 'death'
    | 'explosion'
    | 'spit'
    | 'revive'
    | 'wave'
    | 'boss'
    | 'loot'
    | 'poison'
    | 'pulse';
  x: number;
  y: number;
  n: number;
};
export type Build = {
  id: number;
  kind: 'barricade' | 'turret';
  x: number;
  y: number;
  hp: number;
  cool: number;
};
export type Acid = { id: number; x: number; y: number; vx: number; vy: number; ttl: number };
export type World = {
  v: 3;
  hazards?: { id: number; x: number; y: number; r: number; warmup: number; ttl: number }[];
  chests: { id: number; x: number; y: number; cost: number; opened: boolean; owner?: string }[];
  players: Player[];
  enemies: Enemy[];
  shots: Shot[];
  events: Event[];
  builds: Build[];
  acid: Acid[];
  wave: number;
  phase: 'lobby' | 'combat' | 'break' | 'won' | 'lost';
  timer: number;
  left: number;
  spawn: number;
  time: number;
  seq: number;
  elapsed: number;
};
export type Command = { action?: string; gun?: number; kind?: string; chest?: number };
