/**
 * Shared battle-facing enums and small value types.
 *
 * Kept separate from `data/types.ts` (which is about the elemental chart) so
 * that abilities/items can reference these without a circular import.
 */

export type StatId = 'attack' | 'defense' | 'spPower' | 'spGuard' | 'speed';

/** Stats that can be raised/lowered by stat-stage moves. */
export type StageId = StatId | 'accuracy' | 'evasion';

export const STAGE_IDS: readonly StageId[] = [
  'attack',
  'defense',
  'spPower',
  'spGuard',
  'speed',
  'accuracy',
  'evasion',
];

/** Major status conditions — a creature may only have one at a time. */
export type StatusId = 'burn' | 'paralyze' | 'sleep' | 'entangled' | 'fear';

export const STATUS_IDS: readonly StatusId[] = [
  'burn',
  'paralyze',
  'sleep',
  'entangled',
  'fear',
];

/** Volatile conditions — stack freely, cleared on switch-out unless noted. */
export type VolatileId =
  | 'soaked'
  | 'dazzled'
  | 'trapped'
  | 'protected'
  | 'reflect'
  | 'flinch'
  | 'daze'
  | 'sure-hit'
  | 'focus-energy'
  | 'magnet-pull'
  | 'leech-seed'
  | 'charging';

export type WeatherKind = 'clear' | 'sunny' | 'rain' | 'spore-haze' | 'night-fog';

export interface WeatherInfo {
  id: WeatherKind;
  name: string;
  description: string;
  color: number;
  /** Default duration in turns when set by a move (0 = indefinite/clear). */
  duration: number;
}

export const WEATHERS: Record<WeatherKind, WeatherInfo> = {
  clear: {
    id: 'clear',
    name: 'Clear',
    description: 'The air is calm.',
    color: 0xbfe3ff,
    duration: 0,
  },
  sunny: {
    id: 'sunny',
    name: 'Harsh Sunlight',
    description: 'Fire moves are boosted; Water moves are weakened.',
    color: 0xffb066,
    duration: 5,
  },
  rain: {
    id: 'rain',
    name: 'Rain',
    description: 'Water moves are boosted; Electric moves never miss.',
    color: 0x5b9bd5,
    duration: 5,
  },
  'spore-haze': {
    id: 'spore-haze',
    name: 'Spore Haze',
    description: 'Grass creatures heal a little every turn.',
    color: 0x8fe07a,
    duration: 5,
  },
  'night-fog': {
    id: 'night-fog',
    name: 'Night Fog',
    description: 'Shadow creatures are harder to hit.',
    color: 0x6a5bb5,
    duration: 0,
  },
};

export const STATUS_INFO: Record<
  StatusId,
  { name: string; description: string; color: number; volatile: boolean }
> = {
  burn: {
    name: 'Burn',
    description: 'Loses 1/16 HP each turn and Attack is halved.',
    color: 0xff6b35,
    volatile: false,
  },
  paralyze: {
    name: 'Paralyze',
    description: '25% chance to lose the turn; Speed is halved.',
    color: 0xffd60a,
    volatile: false,
  },
  sleep: {
    name: 'Sleep',
    description: 'Cannot move for a few turns.',
    color: 0xb0b8c8,
    volatile: false,
  },
  entangled: {
    name: 'Entangled',
    description: 'Cannot switch out; roots drain HP to the attacker.',
    color: 0x4cd964,
    volatile: false,
  },
  fear: {
    name: 'Fear',
    description: '30% chance to flinch each turn for three turns.',
    color: 0x8e5cff,
    volatile: false,
  },
};

export const VOLATILE_INFO: Record<VolatileId, { name: string; description: string }> = {
  soaked: { name: 'Soaked', description: 'Speed is down and Electric moves hurt more.' },
  dazzled: { name: 'Dazzled', description: 'Accuracy is sharply reduced.' },
  trapped: { name: 'Trapped', description: 'Cannot switch out.' },
  protected: { name: 'Protected', description: 'Shields itself from attacks this turn.' },
  reflect: { name: 'Reflect', description: 'Halves incoming special damage.' },
  flinch: { name: 'Flinched', description: 'Lost this turn.' },
  daze: { name: 'Daze', description: 'May hurt itself in confusion.' },
  'sure-hit': { name: 'Locked On', description: 'The next move cannot miss.' },
  'focus-energy': { name: 'Focus', description: 'Critical-hit rate is raised.' },
  'magnet-pull': { name: 'Magnet Pull', description: 'The foe cannot flee.' },
  'leech-seed': { name: 'Leech Root', description: 'HP is drained to the foe each turn.' },
  charging: { name: 'Charging', description: 'Gathering power for the next turn.' },
};

/** Where a move points. */
export type MoveTarget = 'foe' | 'all-foes' | 'self' | 'ally' | 'all';

export type MoveCategory = 'physical' | 'special' | 'status';

/** A single side of the field. Used for doubles-agnostic single battles too. */
export type Side = 'player' | 'enemy';

/** Which side the player controls. */
export const PLAYER_SIDE: Side = 'player';
