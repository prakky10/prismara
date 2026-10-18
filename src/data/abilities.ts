/**
 * Abilities — one per creature.
 *
 * Data only: the *behaviour* for each id lives in the battle engine so that the
 * engine stays pure and the data stays declarative. An ability declares a set
 * of mechanical "hooks" beside its flavour text; the engine reads those hooks
 * at the appropriate moment in the turn.
 *
 * Adding a new ability means (a) adding a record here and (b) teaching the
 * engine to honour its hook ids.
 */

export type AbilityId =
  | 'blaze-heart'
  | 'magma-armor'
  | 'rebirth'
  | 'solar-corona'
  | 'torrent-soul'
  | 'buoyant'
  | 'living-reef'
  | 'lighthouse-shell'
  | 'overgrow'
  | 'photosynth'
  | 'spore-burst'
  | 'ambush'
  | 'static-charge'
  | 'static-wool'
  | 'overcharge-core'
  | 'storm-caller'
  | 'night-hunter'
  | 'echolocation'
  | 'smoke-mane'
  | 'total-eclipse'
  | 'prism-skin'
  | 'stained-glass'
  | 'refractive-hide'
  | 'aurora-mane'
  | 'six-elements';

/** Hooks the engine understands. Keep this list in sync with the engine. */
export type AbilityHook =
  /** Boosts moves of `element` by 1.5x when the user is at <= 1/3 HP. */
  | 'pinch-boost'
  /** Immune to a major status (burn, etc). */
  | 'status-immune'
  /** On contact, may inflict a major status on the attacker. */
  | 'contact-status'
  /** Revives once per battle at `reviveFraction` max HP. */
  | 'revive-once'
  /** Heals 1/16 max HP each turn while the matching weather is active. */
  | 'weather-heal'
  /** Grants an extra STAB-like boost to `elements` while `weather` is active. */
  | 'weather-boost'
  /** Reduces incoming super-effective damage while at full HP. */
  | 'full-hp-resist'
  /** Reduces incoming special damage by a flat fraction. */
  | 'special-resist'
  /** Reflects a fraction of incoming special damage back at the attacker. */
  | 'special-reflect'
  /** Speed is multiplied while `timeOfDay` matches. */
  | 'time-speed'
  /** Evasion is raised while `weather` is active. */
  | 'weather-evasion'
  /** Accuracy cannot be lowered by the opponent. */
  | 'accuracy-lock'
  /** Sets `weather` when the creature enters the field. */
  | 'weather-on-entry'
  /** Doubles the chance of critical hits. */
  | 'crit-boost'
  /** All damaging moves get STAB regardless of element. */
  | 'omni-stab'
  /** Negates the opponent's weather-based bonuses. */
  | 'weather-suppress'
  /** Cannot be hit by critical hits. */
  | 'crit-immune';

export interface Ability {
  id: AbilityId;
  name: string;
  description: string;
  hooks: AbilityHook[];
  /** Element the pinch-boost / weather-boost applies to. */
  element?: import('./types').Element;
  /** Weather the hook cares about. */
  weather?: import('./battleTypes').WeatherKind;
  /** Time of day the hook cares about. */
  timeOfDay?: 'day' | 'night';
  /** Status or volatile the contact-status / status-immune hook cares about. */
  status?: import('./battleTypes').StatusId | import('./battleTypes').VolatileId;
  /** Probability for contact-status. */
  chance?: number;
  /** Fraction of max HP restored by revive-once / weather-heal. */
  fraction?: number;
}

export const ABILITIES: Record<AbilityId, Ability> = {
  'blaze-heart': {
    id: 'blaze-heart',
    name: 'Blaze Heart',
    description: 'At 1/3 HP or less, Fire moves deal 1.5x damage.',
    hooks: ['pinch-boost'],
    element: 'fire',
  },
  'magma-armor': {
    id: 'magma-armor',
    name: 'Magma Armor',
    description: 'The heat inside makes it immune to burns.',
    hooks: ['status-immune'],
    status: 'burn',
  },
  rebirth: {
    id: 'rebirth',
    name: 'Rebirth',
    description: 'The first time it faints, it rises again with half its HP.',
    hooks: ['revive-once'],
    fraction: 0.5,
  },
  'solar-corona': {
    id: 'solar-corona',
    name: 'Solar Corona',
    description: 'In harsh sunlight, Fire moves are boosted and it heals each turn.',
    hooks: ['weather-boost', 'weather-heal'],
    element: 'fire',
    weather: 'sunny',
    fraction: 1 / 16,
  },
  'torrent-soul': {
    id: 'torrent-soul',
    name: 'Torrent Soul',
    description: 'At 1/3 HP or less, Water moves deal 1.5x damage.',
    hooks: ['pinch-boost'],
    element: 'water',
  },
  buoyant: {
    id: 'buoyant',
    name: 'Buoyant',
    description: 'Floats above the water, immune to being Soaked.',
    hooks: ['status-immune'],
    status: 'soaked',
  },
  'living-reef': {
    id: 'living-reef',
    name: 'Living Reef',
    description: 'The reef on its back heals 1/16 HP every turn.',
    hooks: ['weather-heal'],
    weather: 'clear',
    fraction: 1 / 16,
  },
  'lighthouse-shell': {
    id: 'lighthouse-shell',
    name: 'Lighthouse Shell',
    description: 'Its sturdy shell cannot be pierced by critical hits.',
    hooks: ['crit-immune'],
  },
  overgrow: {
    id: 'overgrow',
    name: 'Overgrow',
    description: 'At 1/3 HP or less, Grass moves deal 1.5x damage.',
    hooks: ['pinch-boost'],
    element: 'grass',
  },
  photosynth: {
    id: 'photosynth',
    name: 'Photosynth',
    description: 'Heals 1/16 HP each turn while Spore Haze drifts over the field.',
    hooks: ['weather-heal'],
    weather: 'spore-haze',
    fraction: 1 / 16,
  },
  'spore-burst': {
    id: 'spore-burst',
    name: 'Spore Burst',
    description: 'Contact may release a puff of sleep spores.',
    hooks: ['contact-status'],
    status: 'sleep',
    chance: 0.25,
  },
  ambush: {
    id: 'ambush',
    name: 'Ambush',
    description: 'Strikes faster while at full HP.',
    hooks: ['time-speed'],
    timeOfDay: 'day',
  },
  'static-charge': {
    id: 'static-charge',
    name: 'Static Charge',
    description: 'Contact may paralyze the attacker.',
    hooks: ['contact-status'],
    status: 'paralyze',
    chance: 0.3,
  },
  'static-wool': {
    id: 'static-wool',
    name: 'Static Wool',
    description: 'Its crackling fleece may paralyze anything that touches it.',
    hooks: ['contact-status'],
    status: 'paralyze',
    chance: 0.35,
  },
  'overcharge-core': {
    id: 'overcharge-core',
    name: 'Overcharge Core',
    description: 'At 1/3 HP or less, Electric moves deal 1.5x damage.',
    hooks: ['pinch-boost'],
    element: 'electric',
  },
  'storm-caller': {
    id: 'storm-caller',
    name: 'Storm Caller',
    description: 'Summons rain whenever it enters the field.',
    hooks: ['weather-on-entry'],
    weather: 'rain',
  },
  'night-hunter': {
    id: 'night-hunter',
    name: 'Night Hunter',
    description: 'Moves 50% faster at night.',
    hooks: ['time-speed'],
    timeOfDay: 'night',
  },
  echolocation: {
    id: 'echolocation',
    name: 'Echolocation',
    description: 'Uses sound to aim — its accuracy cannot be lowered.',
    hooks: ['accuracy-lock'],
  },
  'smoke-mane': {
    id: 'smoke-mane',
    name: 'Smoke Mane',
    description: 'Wreathed in smoke, it is harder to hit in Night Fog.',
    hooks: ['weather-evasion'],
    weather: 'night-fog',
  },
  'total-eclipse': {
    id: 'total-eclipse',
    name: 'Total Eclipse',
    description: 'Devours the weather itself, and Shadow moves are always boosted.',
    hooks: ['weather-suppress', 'weather-boost'],
    element: 'shadow',
  },
  'prism-skin': {
    id: 'prism-skin',
    name: 'Prism Skin',
    description: 'While at full HP, super-effective hits are refracted and weakened.',
    hooks: ['full-hp-resist'],
  },
  'stained-glass': {
    id: 'stained-glass',
    name: 'Stained Glass',
    description: 'Its wings scatter energy, softening special attacks.',
    hooks: ['special-resist'],
    fraction: 0.8,
  },
  'refractive-hide': {
    id: 'refractive-hide',
    name: 'Refractive Hide',
    description: 'Reflects a quarter of the special damage it takes.',
    hooks: ['special-reflect'],
    fraction: 0.25,
  },
  'aurora-mane': {
    id: 'aurora-mane',
    name: 'Aurora Mane',
    description: 'The aurora glows brightest at night, boosting Crystal moves.',
    hooks: ['weather-boost', 'time-speed'],
    element: 'crystal',
    timeOfDay: 'night',
  },
  'six-elements': {
    id: 'six-elements',
    name: 'Six Elements',
    description: 'Holds every element — all of its moves strike with STAB.',
    hooks: ['omni-stab'],
  },
};

export const ABILITY_IDS = Object.keys(ABILITIES) as AbilityId[];

export function getAbility(id: AbilityId): Ability {
  return ABILITIES[id];
}

/** True when `ability` declares `hook`. */
export function hasHook(id: AbilityId, hook: AbilityHook): boolean {
  return ABILITIES[id].hooks.includes(hook);
}
