/**
 * The Prismadex — all 40 creatures of Prismara.
 *
 * Every species is pure data: base stats, an ability, a learnset, an optional
 * evolution and an art description (body plan + palette) that the CreatureRig
 * renderer turns into a layered, procedurally-animated vector sprite.
 *
 * BST targets from the design doc (section 3):
 *   Basic ~300 | Stage 2 ~410 | Stage 3 ~520 | Single ~450
 *   Pseudo-legendary ~540 | Legendary ~600 | Mythical ~640
 */

import type { AbilityId } from './abilities';
import type { Element } from './types';

export type CreatureId = string;

/** Shared silhouettes. Each rig is parameterised by palette and shape hints. */
export type BodyPlan =
  | 'quadruped'
  | 'biped'
  | 'bird'
  | 'serpent'
  | 'floater'
  | 'bug'
  | 'mole'
  | 'crustacean'
  | 'moth';

export interface BaseStats {
  hp: number;
  attack: number;
  defense: number;
  spPower: number;
  spGuard: number;
  speed: number;
}

export type StatKey = keyof BaseStats;

export interface Palette {
  /** Main body colour. */
  primary: number;
  /** Belly / underside / secondary mass. */
  secondary: number;
  /** Horns, claws, gems, tail tips. */
  accent: number;
  eye: number;
}

export interface LearnEntry {
  level: number;
  move: string;
}

export interface Evolution {
  into: CreatureId;
  level: number;
}

export type Tier = 'basic' | 'stage2' | 'stage3' | 'single' | 'pseudo' | 'legendary' | 'mythical';

export interface CreatureSpecies {
  id: CreatureId;
  dexNumber: number;
  name: string;
  element: Element;
  tier: Tier;
  /** Short description of the creature's concept. */
  concept: string;
  /** Battle role, from the design doc. */
  role: string;
  baseStats: BaseStats;
  ability: AbilityId;
  /** Catch rate 3-255 (higher = easier). */
  catchRate: number;
  /** Experience awarded on defeat. */
  baseExp: number;
  /** Level-up learnset. */
  learnset: LearnEntry[];
  /** Evolution, if any. */
  evolution?: Evolution;
  body: BodyPlan;
  palette: Palette;
  /** Signature move id, also referenced from the move data. */
  signatureMove?: string;
  /** Extra note for legendaries and event creatures. */
  encounterNote?: string;
}

const M = (level: number, move: string): LearnEntry => ({ level, move });

/** Helper so every defensive stat block is easy to read at a glance. */
function stats(
  hp: number,
  attack: number,
  defense: number,
  spPower: number,
  spGuard: number,
  speed: number,
): BaseStats {
  return { hp, attack, defense, spPower, spGuard, speed };
}

const LIST: CreatureSpecies[] = [
  /* ------------------------------------------------------------ Fire (7) */
  {
    id: 'emberkit',
    dexNumber: 1,
    name: 'Emberkit',
    element: 'fire',
    tier: 'basic',
    concept: 'Fox cub with a candle-flame tail',
    role: 'Fast physical',
    baseStats: stats(45, 60, 40, 50, 40, 65),
    ability: 'blaze-heart',
    catchRate: 45,
    baseExp: 62,
    body: 'quadruped',
    palette: { primary: 0xff7a3c, secondary: 0xffd9a8, accent: 0xffd60a, eye: 0x2b1a12 },
    learnset: [
      M(1, 'tackle'),
      M(1, 'growl'),
      M(4, 'ember'),
      M(8, 'quick-strike'),
      M(12, 'fire-fang'),
      M(15, 'ember-pounce'),
      M(18, 'flame-dash'),
      M(22, 'inferno-roar'),
    ],
    evolution: { into: 'pyrolynx', level: 16 },
    signatureMove: 'ember-pounce',
    encounterNote: 'Choose it, or find one on Route 1 at dusk.',
  },
  {
    id: 'pyrolynx',
    dexNumber: 2,
    name: 'Pyrolynx',
    element: 'fire',
    tier: 'stage2',
    concept: 'Lynx with blazing ear tufts',
    role: 'Fast physical',
    baseStats: stats(65, 85, 60, 70, 60, 70),
    ability: 'blaze-heart',
    catchRate: 45,
    baseExp: 130,
    body: 'quadruped',
    palette: { primary: 0xff6b35, secondary: 0xffc27a, accent: 0xffe66d, eye: 0x2b1a12 },
    learnset: [
      M(1, 'ember'),
      M(1, 'flame-dash'),
      M(20, 'fire-fang'),
      M(24, 'ember-pounce'),
      M(28, 'inferno-roar'),
      M(32, 'heat-wave'),
      M(36, 'magma-burst'),
    ],
    evolution: { into: 'infernyx', level: 34 },
    signatureMove: 'flame-dash',
  },
  {
    id: 'infernyx',
    dexNumber: 3,
    name: 'Infernyx',
    element: 'fire',
    tier: 'stage3',
    concept: 'Nine-tailed flame lynx crowned with a halo of fire',
    role: 'Fast sweeper',
    baseStats: stats(75, 110, 70, 90, 70, 105),
    ability: 'blaze-heart',
    catchRate: 45,
    baseExp: 224,
    body: 'quadruped',
    palette: { primary: 0xff5a2b, secondary: 0xffb061, accent: 0xfff0a0, eye: 0xffe066 },
    learnset: [
      M(1, 'flame-dash'),
      M(1, 'heat-wave'),
      M(38, 'magma-burst'),
      M(42, 'sunny-aura'),
      M(44, 'ninefold-blaze'),
      M(50, 'inferno-roar'),
      M(56, 'ember-pounce'),
    ],
    signatureMove: 'ninefold-blaze',
  },
  {
    id: 'cindermole',
    dexNumber: 4,
    name: 'Cindermole',
    element: 'fire',
    tier: 'basic',
    concept: 'Mole with glowing coal claws',
    role: 'Tank',
    baseStats: stats(70, 55, 80, 35, 45, 15),
    ability: 'magma-armor',
    catchRate: 120,
    baseExp: 66,
    body: 'mole',
    palette: { primary: 0x8a4a2f, secondary: 0xd08b52, accent: 0xff6b35, eye: 0xffd60a },
    learnset: [
      M(1, 'tackle'),
      M(1, 'growl'),
      M(6, 'ember'),
      M(11, 'ash-dig'),
      M(16, 'fire-fang'),
      M(21, 'magma-burst'),
      M(27, 'inferno-roar'),
    ],
    evolution: { into: 'magmolith', level: 22 },
    signatureMove: 'ash-dig',
  },
  {
    id: 'magmolith',
    dexNumber: 5,
    name: 'Magmolith',
    element: 'fire',
    tier: 'stage3',
    concept: 'Hulking mole with a cracked magma-rock shell',
    role: 'Heavy tank',
    baseStats: stats(110, 95, 130, 55, 85, 45),
    ability: 'magma-armor',
    catchRate: 45,
    baseExp: 220,
    body: 'mole',
    palette: { primary: 0x5a3222, secondary: 0x9c5b34, accent: 0xff7a3c, eye: 0xffd60a },
    learnset: [
      M(1, 'ash-dig'),
      M(1, 'fire-fang'),
      M(26, 'magma-burst'),
      M(32, 'heat-wave'),
      M(40, 'inferno-roar'),
      M(48, 'sunny-aura'),
      M(54, 'ninefold-blaze'),
    ],
    signatureMove: 'magma-burst',
  },
  {
    id: 'ashwing',
    dexNumber: 6,
    name: 'Ashwing',
    element: 'fire',
    tier: 'single',
    concept: 'Sparrow that is reborn from its own ashes',
    role: 'Speedy, revives once per battle',
    baseStats: stats(70, 90, 60, 85, 60, 85),
    ability: 'rebirth',
    catchRate: 60,
    baseExp: 168,
    body: 'bird',
    palette: { primary: 0xd4632c, secondary: 0xffb673, accent: 0xffe066, eye: 0x2b1a12 },
    learnset: [
      M(1, 'quick-strike'),
      M(1, 'ember'),
      M(10, 'fire-fang'),
      M(18, 'flame-dash'),
      M(26, 'phoenix-dive'),
      M(34, 'heat-wave'),
      M(42, 'sunny-aura'),
      M(50, 'magma-burst'),
    ],
    signatureMove: 'phoenix-dive',
  },
  {
    id: 'solarion',
    dexNumber: 7,
    name: 'Solarion',
    element: 'fire',
    tier: 'legendary',
    concept: 'Golden lion with a sun-corona mane',
    role: 'Legendary',
    baseStats: stats(95, 125, 90, 130, 95, 65),
    ability: 'solar-corona',
    catchRate: 3,
    baseExp: 320,
    body: 'quadruped',
    palette: { primary: 0xffc233, secondary: 0xffe89c, accent: 0xff6b35, eye: 0xfff6d0 },
    learnset: [
      M(1, 'inferno-roar'),
      M(1, 'heat-wave'),
      M(1, 'magma-burst'),
      M(50, 'sunny-aura'),
      M(55, 'solar-crown'),
      M(60, 'ninefold-blaze'),
    ],
    signatureMove: 'solar-crown',
    encounterNote: 'Sleeps in the Cinder Peak caldera. Can only be challenged at noon.',
  },

  /* ----------------------------------------------------------- Water (7) */
  {
    id: 'drizzlet',
    dexNumber: 8,
    name: 'Drizzlet',
    element: 'water',
    tier: 'basic',
    concept: 'Otter pup with a bubble cape',
    role: 'Balanced special',
    baseStats: stats(55, 45, 50, 65, 55, 30),
    ability: 'torrent-soul',
    catchRate: 45,
    baseExp: 62,
    body: 'quadruped',
    palette: { primary: 0x3fa9e0, secondary: 0xbfe8ff, accent: 0x2ea8ff, eye: 0x10243a },
    learnset: [
      M(1, 'tackle'),
      M(1, 'growl'),
      M(4, 'splash-jet'),
      M(9, 'bubble-volley'),
      M(13, 'mist-veil'),
      M(17, 'tide-slam'),
      M(21, 'whirlpool'),
      M(25, 'riptide'),
    ],
    evolution: { into: 'torrentter', level: 16 },
    signatureMove: 'bubble-volley',
    encounterNote: 'Choose it, or find one beside Route 3\u2019s tide pools.',
  },
  {
    id: 'torrentter',
    dexNumber: 9,
    name: 'Torrentter',
    element: 'water',
    tier: 'stage2',
    concept: 'Sleek otter riding a water ring',
    role: 'Balanced special',
    baseStats: stats(75, 65, 70, 90, 75, 35),
    ability: 'torrent-soul',
    catchRate: 45,
    baseExp: 132,
    body: 'quadruped',
    palette: { primary: 0x2f8fd0, secondary: 0xa8ddff, accent: 0x7fffe5, eye: 0x10243a },
    learnset: [
      M(1, 'splash-jet'),
      M(1, 'riptide'),
      M(22, 'tide-slam'),
      M(26, 'whirlpool'),
      M(30, 'mist-veil'),
      M(34, 'rain-dance'),
      M(38, 'maelstrom'),
    ],
    evolution: { into: 'maelstrotter', level: 34 },
    signatureMove: 'riptide',
  },
  {
    id: 'maelstrotter',
    dexNumber: 10,
    name: 'Maelstrotter',
    element: 'water',
    tier: 'stage3',
    concept: 'Otter warlord wielding a whirlpool trident',
    role: 'Special sweeper',
    baseStats: stats(85, 70, 75, 120, 80, 90),
    ability: 'torrent-soul',
    catchRate: 45,
    baseExp: 226,
    body: 'biped',
    palette: { primary: 0x2478b8, secondary: 0x9bd6ff, accent: 0x7fffe5, eye: 0x0a1a2a },
    learnset: [
      M(1, 'riptide'),
      M(1, 'tide-slam'),
      M(38, 'rain-dance'),
      M(42, 'whirlpool'),
      M(46, 'maelstrom'),
      M(52, 'mist-veil'),
      M(58, 'splash-jet'),
    ],
    signatureMove: 'maelstrom',
  },
  {
    id: 'bubbloon',
    dexNumber: 11,
    name: 'Bubbloon',
    element: 'water',
    tier: 'basic',
    concept: 'Puffer-fish that floats in the air like a balloon',
    role: 'Defensive',
    baseStats: stats(65, 40, 65, 55, 55, 20),
    ability: 'buoyant',
    catchRate: 120,
    baseExp: 66,
    body: 'floater',
    palette: { primary: 0x5fc6ff, secondary: 0xd8f3ff, accent: 0x2ea8ff, eye: 0x10243a },
    learnset: [
      M(1, 'tackle'),
      M(1, 'splash-jet'),
      M(7, 'bubble-volley'),
      M(13, 'mist-veil'),
      M(19, 'pop-burst'),
      M(25, 'tide-slam'),
      M(31, 'rain-dance'),
    ],
    evolution: { into: 'puffathom', level: 24 },
    signatureMove: 'pop-burst',
  },
  {
    id: 'puffathom',
    dexNumber: 12,
    name: 'Puffathom',
    element: 'water',
    tier: 'stage3',
    concept: 'Deep-sea puffer with bioluminescent spikes',
    role: 'Wall',
    baseStats: stats(100, 55, 105, 80, 105, 75),
    ability: 'buoyant',
    catchRate: 60,
    baseExp: 222,
    body: 'floater',
    palette: { primary: 0x2b7fb8, secondary: 0xb8e6ff, accent: 0x7fffd0, eye: 0x081621 },
    learnset: [
      M(1, 'pop-burst'),
      M(1, 'tide-slam'),
      M(28, 'abyssal-spikes'),
      M(34, 'mist-veil'),
      M(40, 'rain-dance'),
      M(46, 'maelstrom'),
      M(52, 'whirlpool'),
    ],
    signatureMove: 'abyssal-spikes',
  },
  {
    id: 'coralisk',
    dexNumber: 13,
    name: 'Coralisk',
    element: 'water',
    tier: 'single',
    concept: 'Coral sea-serpent with a living reef on its back',
    role: 'Special attacker',
    baseStats: stats(80, 60, 75, 110, 90, 35),
    ability: 'living-reef',
    catchRate: 60,
    baseExp: 170,
    body: 'serpent',
    palette: { primary: 0xff8fb8, secondary: 0xffd0e0, accent: 0x7fffe5, eye: 0x10243a },
    learnset: [
      M(1, 'splash-jet'),
      M(1, 'mist-veil'),
      M(14, 'bubble-volley'),
      M(22, 'reef-coil'),
      M(30, 'tide-slam'),
      M(38, 'rain-dance'),
      M(46, 'maelstrom'),
      M(54, 'whirlpool'),
    ],
    signatureMove: 'reef-coil',
  },
  {
    id: 'krabrine',
    dexNumber: 14,
    name: 'Krabrine',
    element: 'water',
    tier: 'single',
    concept: 'Hermit crab whose shell is a sunken lighthouse',
    role: 'Physical tank',
    baseStats: stats(85, 105, 115, 50, 85, 10),
    ability: 'lighthouse-shell',
    catchRate: 60,
    baseExp: 172,
    body: 'crustacean',
    palette: { primary: 0xd06a4a, secondary: 0xffe6c0, accent: 0xffd60a, eye: 0x1a2a3a },
    learnset: [
      M(1, 'tackle'),
      M(1, 'splash-jet'),
      M(16, 'tide-slam'),
      M(24, 'lighthouse-slam'),
      M(32, 'mist-veil'),
      M(40, 'whirlpool'),
      M(48, 'rain-dance'),
      M(56, 'maelstrom'),
    ],
    signatureMove: 'lighthouse-slam',
  },

  /* ----------------------------------------------------------- Grass (7) */
  {
    id: 'sproutle',
    dexNumber: 15,
    name: 'Sproutle',
    element: 'grass',
    tier: 'basic',
    concept: 'Turtle with a sapling on its shell',
    role: 'Bulky',
    baseStats: stats(60, 50, 65, 50, 55, 20),
    ability: 'overgrow',
    catchRate: 45,
    baseExp: 62,
    body: 'quadruped',
    palette: { primary: 0x6fd15f, secondary: 0xd9f5b8, accent: 0x2f8f3c, eye: 0x1a2a12 },
    learnset: [
      M(1, 'tackle'),
      M(1, 'growl'),
      M(4, 'vine-lash'),
      M(9, 'leech-root'),
      M(14, 'spore-cloud'),
      M(18, 'ensnare'),
      M(22, 'thorn-barrage'),
      M(26, 'leaf-blade'),
    ],
    evolution: { into: 'thornshell', level: 16 },
    signatureMove: 'vine-lash',
    encounterNote: 'Choose it, or find one in Whisperwood Forest.',
  },
  {
    id: 'thornshell',
    dexNumber: 16,
    name: 'Thornshell',
    element: 'grass',
    tier: 'stage2',
    concept: 'Turtle wearing a thorny bush',
    role: 'Bulky',
    baseStats: stats(80, 70, 95, 65, 75, 25),
    ability: 'overgrow',
    catchRate: 45,
    baseExp: 132,
    body: 'quadruped',
    palette: { primary: 0x5cbf52, secondary: 0xc8ef9f, accent: 0x8a6b32, eye: 0x1a2a12 },
    learnset: [
      M(1, 'vine-lash'),
      M(1, 'thorn-barrage'),
      M(22, 'leaf-blade'),
      M(26, 'spore-cloud'),
      M(30, 'ensnare'),
      M(34, 'verdant-quake'),
      M(38, 'bloom-heal'),
    ],
    evolution: { into: 'grovetitan', level: 34 },
    signatureMove: 'thorn-barrage',
  },
  {
    id: 'grovetitan',
    dexNumber: 17,
    name: 'Grovetitan',
    element: 'grass',
    tier: 'stage3',
    concept: 'Colossal tortoise with an ancient forest on its back',
    role: 'Tank / healer',
    baseStats: stats(110, 80, 125, 85, 100, 20),
    ability: 'overgrow',
    catchRate: 45,
    baseExp: 228,
    body: 'quadruped',
    palette: { primary: 0x4aa544, secondary: 0xb8e88a, accent: 0x7a5a28, eye: 0xd9f5b8 },
    learnset: [
      M(1, 'thorn-barrage'),
      M(1, 'leaf-blade'),
      M(38, 'verdant-quake'),
      M(42, 'bloom-heal'),
      M(46, 'world-tree'),
      M(52, 'ensnare'),
      M(58, 'spore-cloud'),
    ],
    signatureMove: 'world-tree',
  },
  {
    id: 'mossprite',
    dexNumber: 18,
    name: 'Mossprite',
    element: 'grass',
    tier: 'basic',
    concept: 'Tiny moss fairy',
    role: 'Support',
    baseStats: stats(55, 35, 50, 60, 70, 30),
    ability: 'photosynth',
    catchRate: 150,
    baseExp: 64,
    body: 'floater',
    palette: { primary: 0x8fd98a, secondary: 0xe8f7c8, accent: 0x4cd964, eye: 0x1a2a12 },
    learnset: [
      M(1, 'growl'),
      M(1, 'vine-lash'),
      M(6, 'spore-cloud'),
      M(12, 'leech-root'),
      M(17, 'bloom-heal'),
      M(22, 'ensnare'),
      M(27, 'leaf-blade'),
    ],
    evolution: { into: 'bloomwisp', level: 20 },
  },
  {
    id: 'bloomwisp',
    dexNumber: 19,
    name: 'Bloomwisp',
    element: 'grass',
    tier: 'stage2',
    concept: 'Floating flower spirit that leaves trails of petals',
    role: 'Support / healer',
    baseStats: stats(80, 40, 65, 85, 95, 45),
    ability: 'photosynth',
    catchRate: 75,
    baseExp: 166,
    body: 'floater',
    palette: { primary: 0x7fcc6a, secondary: 0xf5e0ff, accent: 0xff8fc4, eye: 0x1a2a12 },
    learnset: [
      M(1, 'bloom-heal'),
      M(1, 'leech-root'),
      M(24, 'spore-cloud'),
      M(30, 'ensnare'),
      M(36, 'verdant-quake'),
      M(42, 'world-tree'),
      M(48, 'leaf-blade'),
    ],
    signatureMove: 'bloom-heal',
  },
  {
    id: 'shroomble',
    dexNumber: 20,
    name: 'Shroomble',
    element: 'grass',
    tier: 'single',
    concept: 'Grumpy mushroom that drops sleep spores',
    role: 'Status trickster',
    baseStats: stats(75, 55, 80, 85, 95, 60),
    ability: 'spore-burst',
    catchRate: 90,
    baseExp: 168,
    body: 'biped',
    palette: { primary: 0xd45a6a, secondary: 0xffe0c0, accent: 0xf0f0e0, eye: 0x2a1a12 },
    learnset: [
      M(1, 'tackle'),
      M(1, 'spore-cloud'),
      M(12, 'drowsy-spores'),
      M(20, 'leech-root'),
      M(28, 'ensnare'),
      M(36, 'verdant-quake'),
      M(44, 'bloom-heal'),
      M(52, 'world-tree'),
    ],
    signatureMove: 'drowsy-spores',
  },
  {
    id: 'vinesnap',
    dexNumber: 21,
    name: 'Vinesnap',
    element: 'grass',
    tier: 'single',
    concept: 'Venus-flytrap ambush hunter',
    role: 'Physical attacker',
    baseStats: stats(80, 115, 70, 55, 65, 65),
    ability: 'ambush',
    catchRate: 90,
    baseExp: 170,
    body: 'biped',
    palette: { primary: 0x4cae4a, secondary: 0xd94f6a, accent: 0xf5f0c0, eye: 0xffe066 },
    learnset: [
      M(1, 'vine-lash'),
      M(1, 'growl'),
      M(12, 'leech-root'),
      M(20, 'snap-trap'),
      M(28, 'ensnare'),
      M(36, 'leaf-blade'),
      M(44, 'thorn-barrage'),
      M(52, 'verdant-quake'),
    ],
    signatureMove: 'snap-trap',
  },

  /* -------------------------------------------------------- Electric (7) */
  {
    id: 'sparkit',
    dexNumber: 22,
    name: 'Sparkit',
    element: 'electric',
    tier: 'basic',
    concept: 'Ferret with tesla-coil whiskers',
    role: 'Fast',
    baseStats: stats(45, 55, 40, 50, 45, 65),
    ability: 'static-charge',
    catchRate: 150,
    baseExp: 62,
    body: 'quadruped',
    palette: { primary: 0xffd60a, secondary: 0xfff3b0, accent: 0xff9f1c, eye: 0x2a2410 },
    learnset: [
      M(1, 'tackle'),
      M(1, 'growl'),
      M(5, 'spark'),
      M(10, 'quick-strike'),
      M(15, 'volt-dash'),
      M(20, 'static-field'),
      M(25, 'overcharge'),
      M(30, 'chain-lightning'),
    ],
    evolution: { into: 'fulminx', level: 20 },
    signatureMove: 'volt-dash',
  },
  {
    id: 'fulminx',
    dexNumber: 23,
    name: 'Fulminx',
    element: 'electric',
    tier: 'stage2',
    concept: 'Lightning ferret that leaves after-images',
    role: 'Very fast sweeper',
    baseStats: stats(65, 75, 55, 75, 60, 80),
    ability: 'static-charge',
    catchRate: 75,
    baseExp: 166,
    body: 'quadruped',
    palette: { primary: 0xffcc00, secondary: 0xfff6c8, accent: 0x2ec4ff, eye: 0x2a2410 },
    learnset: [
      M(1, 'volt-dash'),
      M(1, 'spark'),
      M(24, 'chain-lightning'),
      M(28, 'static-field'),
      M(32, 'overcharge'),
      M(36, 'ion-shield'),
      M(42, 'thunderfall'),
    ],
    signatureMove: 'chain-lightning',
  },
  {
    id: 'ampuff',
    dexNumber: 24,
    name: 'Ampuff',
    element: 'electric',
    tier: 'basic',
    concept: 'Sheep whose wool is a static cloud',
    role: 'Special bulky',
    baseStats: stats(65, 40, 60, 65, 65, 5),
    ability: 'static-wool',
    catchRate: 150,
    baseExp: 64,
    body: 'quadruped',
    palette: { primary: 0xf5f2e0, secondary: 0xfff8d0, accent: 0xffd60a, eye: 0x3a3420 },
    learnset: [
      M(1, 'tackle'),
      M(1, 'growl'),
      M(6, 'spark'),
      M(12, 'static-field'),
      M(18, 'overcharge'),
      M(24, 'body-slam'),
      M(30, 'chain-lightning'),
    ],
    evolution: { into: 'stormfleece', level: 22 },
    signatureMove: 'static-field',
  },
  {
    id: 'stormfleece',
    dexNumber: 25,
    name: 'Stormfleece',
    element: 'electric',
    tier: 'stage2',
    concept: 'Ram walking inside its own thunderstorm',
    role: 'Special tank',
    baseStats: stats(90, 55, 85, 95, 80, 5),
    ability: 'static-wool',
    catchRate: 75,
    baseExp: 168,
    body: 'quadruped',
    palette: { primary: 0x6b6f8a, secondary: 0xf0f0ff, accent: 0xffd60a, eye: 0xfff3b0 },
    learnset: [
      M(1, 'static-field'),
      M(1, 'spark'),
      M(26, 'chain-lightning'),
      M(30, 'overcharge'),
      M(34, 'ion-shield'),
      M(38, 'thunderfall'),
      M(44, 'body-slam'),
    ],
    signatureMove: 'thunderfall',
  },
  {
    id: 'coilbug',
    dexNumber: 26,
    name: 'Coilbug',
    element: 'electric',
    tier: 'basic',
    concept: 'Copper-coil beetle',
    role: 'Physical',
    baseStats: stats(50, 65, 60, 40, 50, 35),
    ability: 'overcharge-core',
    catchRate: 150,
    baseExp: 63,
    body: 'bug',
    palette: { primary: 0xd98a3a, secondary: 0xffd9a0, accent: 0xffd60a, eye: 0x2a1a10 },
    learnset: [
      M(1, 'tackle'),
      M(1, 'spark'),
      M(7, 'quick-strike'),
      M(13, 'body-slam'),
      M(19, 'volt-dash'),
      M(25, 'overcharge'),
      M(31, 'arc-coil'),
    ],
    evolution: { into: 'teslapede', level: 25 },
    signatureMove: 'overcharge',
  },
  {
    id: 'teslapede',
    dexNumber: 27,
    name: 'Teslapede',
    element: 'electric',
    tier: 'stage2',
    concept: 'Centipede made of glowing magnetic segments',
    role: 'Physical sweeper',
    baseStats: stats(70, 105, 65, 55, 60, 55),
    ability: 'overcharge-core',
    catchRate: 75,
    baseExp: 170,
    body: 'bug',
    palette: { primary: 0xc4762a, secondary: 0xffe0a8, accent: 0x7fffe5, eye: 0xffd60a },
    learnset: [
      M(1, 'overcharge'),
      M(1, 'volt-dash'),
      M(28, 'arc-coil'),
      M(32, 'body-slam'),
      M(36, 'chain-lightning'),
      M(42, 'thunderfall'),
      M(48, 'skybreaker'),
    ],
    signatureMove: 'arc-coil',
  },
  {
    id: 'thundrake',
    dexNumber: 28,
    name: 'Thundrake',
    element: 'electric',
    tier: 'pseudo',
    concept: 'Small storm-dragon with lightning-rod horns',
    role: 'Pseudo-legendary',
    baseStats: stats(85, 115, 80, 110, 80, 70),
    ability: 'storm-caller',
    catchRate: 30,
    baseExp: 240,
    body: 'serpent',
    palette: { primary: 0x3f6fd0, secondary: 0xbfe0ff, accent: 0xffd60a, eye: 0xfff3b0 },
    learnset: [
      M(1, 'spark'),
      M(1, 'volt-dash'),
      M(30, 'chain-lightning'),
      M(36, 'overcharge'),
      M(42, 'ion-shield'),
      M(48, 'thunderfall'),
      M(54, 'skybreaker'),
      M(60, 'body-slam'),
    ],
    signatureMove: 'skybreaker',
    encounterNote: 'A rare storm-dweller found on Route 2 during thunderstorms.',
  },

  /* ---------------------------------------------------------- Shadow (6) */
  {
    id: 'gloomlet',
    dexNumber: 29,
    name: 'Gloomlet',
    element: 'shadow',
    tier: 'basic',
    concept: 'Shy little wisp with one big eye',
    role: 'Evasive',
    baseStats: stats(50, 40, 45, 60, 55, 50),
    ability: 'night-hunter',
    catchRate: 150,
    baseExp: 63,
    body: 'floater',
    palette: { primary: 0x6c4fd0, secondary: 0x3a2a70, accent: 0xc0a0ff, eye: 0xfff0a0 },
    learnset: [
      M(1, 'tackle'),
      M(1, 'growl'),
      M(6, 'shade-claw'),
      M(12, 'night-veil'),
      M(18, 'hex-bite'),
      M(24, 'nightmare'),
      M(30, 'void-pulse'),
    ],
    evolution: { into: 'shadeling', level: 18 },
    signatureMove: 'night-veil',
  },
  {
    id: 'shadeling',
    dexNumber: 30,
    name: 'Shadeling',
    element: 'shadow',
    tier: 'stage2',
    concept: 'Hooded shadow child holding a lantern',
    role: 'Special',
    baseStats: stats(70, 55, 60, 95, 80, 50),
    ability: 'night-hunter',
    catchRate: 90,
    baseExp: 166,
    body: 'biped',
    palette: { primary: 0x5a3fb8, secondary: 0x2a1e52, accent: 0xffd60a, eye: 0xffeeaa },
    learnset: [
      M(1, 'hex-bite'),
      M(1, 'night-veil'),
      M(22, 'void-pulse'),
      M(26, 'nightmare'),
      M(30, 'soul-drain'),
      M(36, 'dread-howl'),
      M(42, 'soul-lantern'),
    ],
    evolution: { into: 'umbrawraith', level: 36 },
    signatureMove: 'hex-bite',
  },
  {
    id: 'umbrawraith',
    dexNumber: 31,
    name: 'Umbrawraith',
    element: 'shadow',
    tier: 'stage3',
    concept: 'Towering wraith with lantern-lit eyes',
    role: 'Special sweeper',
    baseStats: stats(80, 60, 70, 125, 85, 100),
    ability: 'night-hunter',
    catchRate: 45,
    baseExp: 228,
    body: 'biped',
    palette: { primary: 0x452f92, secondary: 0x1c1440, accent: 0xffc233, eye: 0xfff0b0 },
    learnset: [
      M(1, 'soul-lantern'),
      M(1, 'void-pulse'),
      M(40, 'nightmare'),
      M(44, 'phantom-step'),
      M(48, 'dread-howl'),
      M(54, 'total-eclipse'),
      M(60, 'soul-drain'),
    ],
    signatureMove: 'soul-lantern',
  },
  {
    id: 'nightfang',
    dexNumber: 32,
    name: 'Nightfang',
    element: 'shadow',
    tier: 'single',
    concept: 'Bat with a crescent-moon wing pattern',
    role: 'Fast physical',
    baseStats: stats(70, 105, 60, 60, 60, 95),
    ability: 'echolocation',
    catchRate: 90,
    baseExp: 168,
    body: 'bird',
    palette: { primary: 0x5a4a8a, secondary: 0x2c2450, accent: 0xffe066, eye: 0xfff0b0 },
    learnset: [
      M(1, 'shade-claw'),
      M(1, 'quick-strike'),
      M(14, 'night-veil'),
      M(22, 'hex-bite'),
      M(30, 'phantom-step'),
      M(38, 'void-pulse'),
      M(46, 'soul-drain'),
      M(54, 'dread-howl'),
    ],
    signatureMove: 'shade-claw',
  },
  {
    id: 'duskmaw',
    dexNumber: 33,
    name: 'Duskmaw',
    element: 'shadow',
    tier: 'single',
    concept: 'Shadow hound with a smoke mane and ember eyes',
    role: 'Physical attacker',
    baseStats: stats(85, 110, 70, 65, 70, 50),
    ability: 'smoke-mane',
    catchRate: 75,
    baseExp: 172,
    body: 'quadruped',
    palette: { primary: 0x4a3a72, secondary: 0x241c3e, accent: 0xff6b35, eye: 0xff9f1c },
    learnset: [
      M(1, 'shade-claw'),
      M(1, 'growl'),
      M(15, 'hex-bite'),
      M(24, 'void-pulse'),
      M(32, 'night-veil'),
      M(40, 'soul-drain'),
      M(48, 'dread-howl'),
      M(56, 'total-eclipse'),
    ],
    signatureMove: 'void-pulse',
  },
  {
    id: 'eclipsor',
    dexNumber: 34,
    name: 'Eclipsor',
    element: 'shadow',
    tier: 'legendary',
    concept: 'Serpent-dragon that eats light, shaped like an eclipse',
    role: 'Legendary',
    baseStats: stats(100, 120, 85, 150, 110, 35),
    ability: 'total-eclipse',
    catchRate: 3,
    baseExp: 330,
    body: 'serpent',
    palette: { primary: 0x2e2050, secondary: 0x120c28, accent: 0x8e5cff, eye: 0xfff0a0 },
    learnset: [
      M(1, 'dread-howl'),
      M(1, 'void-pulse'),
      M(1, 'soul-lantern'),
      M(50, 'phantom-step'),
      M(56, 'nightmare'),
      M(62, 'total-eclipse'),
    ],
    signatureMove: 'total-eclipse',
    encounterNote: 'Rises at Duskmoor\u2019s altar at midnight after Team Eclipse\u2019s ritual.',
  },

  /* --------------------------------------------------------- Crystal (6) */
  {
    id: 'shardling',
    dexNumber: 35,
    name: 'Shardling',
    element: 'crystal',
    tier: 'basic',
    concept: 'Gem beetle with a quartz shell',
    role: 'Defensive',
    baseStats: stats(60, 45, 75, 50, 65, 5),
    ability: 'prism-skin',
    catchRate: 150,
    baseExp: 65,
    body: 'bug',
    palette: { primary: 0x9fe8dd, secondary: 0xe0fffa, accent: 0xff8fd0, eye: 0x1a3038 },
    learnset: [
      M(1, 'tackle'),
      M(1, 'shard-toss'),
      M(7, 'crystallize'),
      M(13, 'prism-beam'),
      M(19, 'gem-shield'),
      M(25, 'glitter-dust'),
      M(31, 'facet-storm'),
    ],
    evolution: { into: 'prismantis', level: 26 },
    signatureMove: 'shard-toss',
  },
  {
    id: 'prismantis',
    dexNumber: 36,
    name: 'Prismantis',
    element: 'crystal',
    tier: 'stage2',
    concept: 'Mantis with diamond scythes that split light',
    role: 'Physical sweeper',
    baseStats: stats(70, 115, 65, 55, 65, 40),
    ability: 'prism-skin',
    catchRate: 60,
    baseExp: 172,
    body: 'biped',
    palette: { primary: 0x7fffe5, secondary: 0xd6fff7, accent: 0xff8fd0, eye: 0x103038 },
    learnset: [
      M(1, 'facet-storm'),
      M(1, 'prism-beam'),
      M(30, 'crystallize'),
      M(34, 'glitter-dust'),
      M(38, 'gem-shield'),
      M(44, 'refract'),
      M(50, 'radiant-lance'),
    ],
    signatureMove: 'facet-storm',
  },
  {
    id: 'glimmoth',
    dexNumber: 37,
    name: 'Glimmoth',
    element: 'crystal',
    tier: 'single',
    concept: 'Moth with stained-glass wings',
    role: 'Special support',
    baseStats: stats(75, 45, 65, 100, 95, 70),
    ability: 'stained-glass',
    catchRate: 90,
    baseExp: 170,
    body: 'moth',
    palette: { primary: 0xbfd8ff, secondary: 0xf0f5ff, accent: 0xff8fd0, eye: 0x20303a },
    learnset: [
      M(1, 'prism-beam'),
      M(1, 'glitter-dust'),
      M(14, 'crystallize'),
      M(22, 'gem-shield'),
      M(30, 'refract'),
      M(38, 'radiant-lance'),
      M(46, 'facet-storm'),
      M(54, 'shard-toss'),
    ],
    signatureMove: 'prism-beam',
  },
  {
    id: 'facetoad',
    dexNumber: 38,
    name: 'Facetoad',
    element: 'crystal',
    tier: 'single',
    concept: 'Toad covered in geode warts that reflects attacks',
    role: 'Wall',
    baseStats: stats(95, 50, 115, 65, 95, 30),
    ability: 'refractive-hide',
    catchRate: 90,
    baseExp: 174,
    body: 'quadruped',
    palette: { primary: 0x5fcbb5, secondary: 0xd0fff0, accent: 0x8e5cff, eye: 0x1a3038 },
    learnset: [
      M(1, 'shard-toss'),
      M(1, 'growl'),
      M(16, 'crystallize'),
      M(24, 'refract'),
      M(32, 'gem-shield'),
      M(40, 'prism-beam'),
      M(48, 'glitter-dust'),
      M(56, 'radiant-lance'),
    ],
    signatureMove: 'refract',
  },
  {
    id: 'lumicorn',
    dexNumber: 39,
    name: 'Lumicorn',
    element: 'crystal',
    tier: 'single',
    concept: 'Unicorn with an amethyst horn and an aurora mane',
    role: 'Special attacker',
    baseStats: stats(75, 65, 65, 115, 95, 35),
    ability: 'aurora-mane',
    catchRate: 45,
    baseExp: 176,
    body: 'quadruped',
    palette: { primary: 0xf0f0ff, secondary: 0xffd9f0, accent: 0x9b5cff, eye: 0x7fffe5 },
    learnset: [
      M(1, 'shard-toss'),
      M(1, 'prism-beam'),
      M(18, 'crystallize'),
      M(26, 'glitter-dust'),
      M(34, 'radiant-lance'),
      M(42, 'gem-shield'),
      M(50, 'refract'),
      M(58, 'facet-storm'),
    ],
    signatureMove: 'radiant-lance',
    encounterNote: 'A rare creature that appears in Geode Hollow only at night.',
  },
  {
    id: 'aetherion',
    dexNumber: 40,
    name: 'Aetherion',
    element: 'crystal',
    tier: 'mythical',
    concept: 'Prism-winged celestial that holds all six elements',
    role: 'Mythical (final reward)',
    baseStats: stats(110, 120, 100, 150, 120, 40),
    ability: 'six-elements',
    catchRate: 3,
    baseExp: 360,
    body: 'bird',
    palette: { primary: 0xf5f0ff, secondary: 0xffe6ff, accent: 0x7fffe5, eye: 0xfff6c0 },
    learnset: [
      M(1, 'radiant-lance'),
      M(1, 'ninefold-blaze'),
      M(1, 'maelstrom'),
      M(1, 'thunderfall'),
      M(1, 'total-eclipse'),
      M(70, 'solar-crown'),
      M(75, 'world-tree'),
      M(80, 'spectrum-burst'),
    ],
    signatureMove: 'spectrum-burst',
    encounterNote:
      'Appears at Prism Summit after the Champion, once you have caught 39 of the other 40 creatures.',
  },
];

export const CREATURES: Record<CreatureId, CreatureSpecies> = Object.fromEntries(
  LIST.map((c) => [c.id, c]),
);

export const CREATURE_IDS: CreatureId[] = LIST.map((c) => c.id);

export const DEX_ORDER: CreatureId[] = [...LIST]
  .sort((a, b) => a.dexNumber - b.dexNumber)
  .map((c) => c.id);

export function getSpecies(id: CreatureId): CreatureSpecies {
  const c = CREATURES[id];
  if (!c) throw new Error(`Unknown creature id: ${id}`);
  return c;
}

export function speciesByDexNumber(n: number): CreatureSpecies | undefined {
  return LIST.find((c) => c.dexNumber === n);
}

export function totalDexCount(): number {
  return LIST.length;
}

/** Base stat total. */
export function bst(species: CreatureSpecies): number {
  const s = species.baseStats;
  return s.hp + s.attack + s.defense + s.spPower + s.spGuard + s.speed;
}

/** The three starters, in the order they appear on the selection screen. */
export const STARTERS: CreatureId[] = ['emberkit', 'drizzlet', 'sproutle'];

/** Legendary and mythical creatures, which have special encounter rules. */
export const LEGENDARIES: CreatureId[] = ['solarion', 'eclipsor'];
export const MYTHICALS: CreatureId[] = ['aetherion'];

/** The evolution line a creature belongs to (base form first). */
export function evolutionLine(id: CreatureId): CreatureSpecies[] {
  let base = getSpecies(id);
  // Walk backwards to the base form.
  let guard = 0;
  while (guard++ < 10) {
    const prev = LIST.find((c) => c.evolution?.into === base.id);
    if (!prev) break;
    base = prev;
  }
  const line: CreatureSpecies[] = [base];
  let cur = base;
  while (cur.evolution) {
    cur = getSpecies(cur.evolution.into);
    line.push(cur);
  }
  return line;
}

/** Species this one evolves into, if any. */
export function evolvesInto(id: CreatureId): CreatureSpecies | undefined {
  const evo = getSpecies(id).evolution;
  return evo ? getSpecies(evo.into) : undefined;
}

/**
 * The rival always picks the starter that beats yours:
 * Fire beats Grass, Grass beats Water, Water beats Fire.
 */
export function rivalStarterFor(playerStarter: CreatureId): CreatureId {
  const beats: Record<string, CreatureId> = {
    emberkit: 'sproutle',
    sproutle: 'drizzlet',
    drizzlet: 'emberkit',
  };
  return beats[playerStarter] ?? 'drizzlet';
}

/** Name of the body plan, for the Dex art description. */
export const BODY_PLAN_NAMES: Record<BodyPlan, string> = {
  quadruped: 'Quadruped',
  biped: 'Biped',
  bird: 'Winged',
  serpent: 'Serpentine',
  floater: 'Floating',
  bug: 'Insectoid',
  mole: 'Burrowing',
  crustacean: 'Shelled',
  moth: 'Winged insect',
};
