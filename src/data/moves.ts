/**
 * Every move in Prismara — eight per element, eight Neutral moves, plus each
 * creature's signature move.
 *
 * A move is pure data. `effects` is a list of things that happen *on a
 * successful hit* (or on use, for status moves); the battle engine interprets
 * them. `tags` are extra damage rules the engine special-cases.
 */

import type {
  MoveCategory,
  MoveTarget,
  StageId,
  StatusId,
  WeatherKind,
  VolatileId,
} from './battleTypes';
import type { MoveType } from './types';

/** Extra damage rules the engine understands. */
export type MoveTag =
  /** Aetherion's Spectrum Burst: uses whichever element is best vs the target. */
  | 'best-type'
  /** Hex Bite and Soul Lantern: doubles power if the target has a status. */
  | 'double-vs-status'
  /** Chain Lightning: 1.5x against a Soaked target. */
  | 'bonus-vs-soaked'
  /** Multiplies power by 1.5 when the user has 1/3 HP or less. */
  | 'pinch-power'
  /** Cannot be blocked by Protect. */
  | 'unblockable'
  /** Hits every creature on the field, including the user's side (none yet). */
  | 'spread';

export type MoveEffect =
  | {
      kind: 'stat';
      target: 'self' | 'foe' | 'all-foes';
      changes: Partial<Record<StageId, number>>;
      chance?: number;
    }
  | { kind: 'status'; status: StatusId; chance?: number }
  | { kind: 'volatile'; volatile: VolatileId; target: 'self' | 'foe'; chance?: number }
  | { kind: 'weather'; weather: WeatherKind }
  | { kind: 'heal'; fraction: number }
  | { kind: 'drain'; fraction: number }
  | { kind: 'recoil'; fraction: number }
  | { kind: 'protect' }
  | { kind: 'reflect'; fraction: number; turns: number }
  | { kind: 'trap'; turns: number; damageFraction: number }
  | { kind: 'crit-stage'; stages: number }
  | { kind: 'sure-hit' }
  | { kind: 'prevent-flee' }
  | { kind: 'sleep-self'; turns: number }
  | { kind: 'reset-target-stages' };

export interface MoveData {
  id: string;
  name: string;
  type: MoveType;
  category: MoveCategory;
  /** 0 for status moves. */
  power: number;
  /** Percentage 1-100, or 'bypass' for moves that never miss. */
  accuracy: number | 'bypass';
  pp: number;
  /** +1 acts first, -1 acts last. */
  priority: number;
  target: MoveTarget;
  /** Physical contact — enables contact abilities and some reactions. */
  contact: boolean;
  /** 0 = normal crit rate (1/16), 1 = high (1/8), 2 = very high (1/2). */
  critStage?: number;
  effects?: MoveEffect[];
  /** [min, max] for multi-hit moves. */
  multihit?: [number, number];
  tags?: MoveTag[];
  /** VFX template key, one per element plus a few special cases. */
  vfx: string;
  description: string;
  /** Creature this is the signature move of, for the Dex display. */
  signatureOf?: string;
}

const M: Record<string, MoveData> = {};
function move(data: MoveData): MoveData {
  M[data.id] = data;
  return data;
}

/* ------------------------------------------------------------------ Fire -- */

move({
  id: 'ember',
  name: 'Ember',
  type: 'fire',
  category: 'special',
  power: 40,
  accuracy: 100,
  pp: 25,
  priority: 0,
  target: 'foe',
  contact: false,
  effects: [{ kind: 'status', status: 'burn', chance: 0.1 }],
  vfx: 'fire',
  description: 'A small burst of flame. May burn.',
});

move({
  id: 'flame-dash',
  name: 'Flame Dash',
  type: 'fire',
  category: 'physical',
  power: 60,
  accuracy: 100,
  pp: 20,
  priority: 1,
  target: 'foe',
  contact: true,
  vfx: 'fire',
  description: 'A blazing tackle that always strikes first.',
  signatureOf: 'pyrolynx',
});

move({
  id: 'fire-fang',
  name: 'Fire Fang',
  type: 'fire',
  category: 'physical',
  power: 65,
  accuracy: 95,
  pp: 15,
  priority: 0,
  target: 'foe',
  contact: true,
  effects: [{ kind: 'status', status: 'burn', chance: 0.1 }],
  vfx: 'fire',
  description: 'Bites with flame-wreathed fangs. May burn.',
});

move({
  id: 'heat-wave',
  name: 'Heat Wave',
  type: 'fire',
  category: 'special',
  power: 80,
  accuracy: 90,
  pp: 10,
  priority: 0,
  target: 'all-foes',
  contact: false,
  effects: [{ kind: 'status', status: 'burn', chance: 0.1 }],
  tags: ['spread'],
  vfx: 'fire',
  description: 'A wave of searing air that washes over every foe.',
});

move({
  id: 'inferno-roar',
  name: 'Inferno Roar',
  type: 'fire',
  category: 'status',
  power: 0,
  accuracy: 100,
  pp: 15,
  priority: 0,
  target: 'foe',
  contact: false,
  effects: [{ kind: 'stat', target: 'foe', changes: { attack: -1 } }],
  vfx: 'fire',
  description: 'A terrifying roar that withers the foe\u2019s Attack.',
});

move({
  id: 'magma-burst',
  name: 'Magma Burst',
  type: 'fire',
  category: 'special',
  power: 110,
  accuracy: 85,
  pp: 5,
  priority: 0,
  target: 'foe',
  contact: false,
  effects: [{ kind: 'stat', target: 'self', changes: { defense: -1 } }],
  vfx: 'fire',
  description: 'A spectacular eruption. Lowers the user\u2019s Defense.',
  signatureOf: 'magmolith',
});

move({
  id: 'sunny-aura',
  name: 'Sunny Aura',
  type: 'fire',
  category: 'status',
  power: 0,
  accuracy: 'bypass',
  pp: 5,
  priority: 0,
  target: 'self',
  contact: false,
  effects: [{ kind: 'weather', weather: 'sunny' }],
  vfx: 'fire',
  description: 'Bathes the field in harsh sunlight for five turns.',
});

move({
  id: 'ninefold-blaze',
  name: 'Ninefold Blaze',
  type: 'fire',
  category: 'special',
  power: 120,
  accuracy: 90,
  pp: 5,
  priority: 0,
  target: 'foe',
  contact: false,
  effects: [{ kind: 'status', status: 'burn', chance: 0.2 }],
  vfx: 'fire-sig',
  description: 'Nine tails fan out and unleash a crown of fire.',
  signatureOf: 'infernyx',
});

move({
  id: 'ember-pounce',
  name: 'Ember Pounce',
  type: 'fire',
  category: 'physical',
  power: 70,
  accuracy: 100,
  pp: 10,
  priority: 0,
  target: 'foe',
  contact: true,
  effects: [{ kind: 'status', status: 'burn', chance: 0.15 }],
  vfx: 'fire',
  description: 'Leaps from the shadows with candle-flame claws.',
  signatureOf: 'emberkit',
});

move({
  id: 'ash-dig',
  name: 'Ash Dig',
  type: 'fire',
  category: 'physical',
  power: 70,
  accuracy: 100,
  pp: 15,
  priority: 0,
  target: 'foe',
  contact: true,
  effects: [{ kind: 'status', status: 'burn', chance: 0.1 }],
  vfx: 'fire',
  description: 'Burrows through cooling ash and erupts beneath the foe.',
  signatureOf: 'cindermole',
});

move({
  id: 'phoenix-dive',
  name: 'Phoenix Dive',
  type: 'fire',
  category: 'physical',
  power: 90,
  accuracy: 95,
  pp: 10,
  priority: 0,
  target: 'foe',
  contact: true,
  critStage: 1,
  vfx: 'fire',
  description: 'Dives wreathed in rebirth flames. Easily a critical hit.',
  signatureOf: 'ashwing',
});

move({
  id: 'solar-crown',
  name: 'Solar Crown',
  type: 'fire',
  category: 'special',
  power: 120,
  accuracy: 90,
  pp: 5,
  priority: 0,
  target: 'foe',
  contact: false,
  effects: [{ kind: 'status', status: 'burn', chance: 0.3 }],
  vfx: 'fire-sig',
  description: 'A corona of sunfire crashes down from the lion\u2019s mane.',
  signatureOf: 'solarion',
});

/* ----------------------------------------------------------------- Water -- */

move({
  id: 'splash-jet',
  name: 'Splash Jet',
  type: 'water',
  category: 'special',
  power: 40,
  accuracy: 100,
  pp: 25,
  priority: 0,
  target: 'foe',
  contact: false,
  vfx: 'water',
  description: 'A pressurised jet of water.',
});

move({
  id: 'bubble-volley',
  name: 'Bubble Volley',
  type: 'water',
  category: 'special',
  power: 55,
  accuracy: 100,
  pp: 20,
  priority: 0,
  target: 'foe',
  contact: false,
  effects: [{ kind: 'volatile', volatile: 'soaked', target: 'foe', chance: 0.2 }],
  vfx: 'water',
  description: 'A volley of bubbles. May leave the foe Soaked.',
  signatureOf: 'drizzlet',
});

move({
  id: 'tide-slam',
  name: 'Tide Slam',
  type: 'water',
  category: 'physical',
  power: 75,
  accuracy: 95,
  pp: 15,
  priority: 0,
  target: 'foe',
  contact: true,
  vfx: 'water',
  description: 'Slams the foe with the weight of a breaking wave.',
});

move({
  id: 'whirlpool',
  name: 'Whirlpool',
  type: 'water',
  category: 'special',
  power: 35,
  accuracy: 85,
  pp: 15,
  priority: 0,
  target: 'foe',
  contact: false,
  effects: [{ kind: 'trap', turns: 4, damageFraction: 0.125 }],
  vfx: 'water',
  description: 'Traps the foe in a vortex for four turns.',
});

move({
  id: 'mist-veil',
  name: 'Mist Veil',
  type: 'water',
  category: 'status',
  power: 0,
  accuracy: 'bypass',
  pp: 20,
  priority: 0,
  target: 'self',
  contact: false,
  effects: [{ kind: 'stat', target: 'self', changes: { evasion: 1 } }],
  vfx: 'water',
  description: 'Cloaks itself in mist, raising evasion.',
});

move({
  id: 'riptide',
  name: 'Riptide',
  type: 'water',
  category: 'special',
  power: 90,
  accuracy: 95,
  pp: 10,
  priority: 0,
  target: 'foe',
  contact: false,
  vfx: 'water',
  description: 'A sudden, powerful surge of water.',
  signatureOf: 'torrentter',
});

move({
  id: 'rain-dance',
  name: 'Rain Dance',
  type: 'water',
  category: 'status',
  power: 0,
  accuracy: 'bypass',
  pp: 5,
  priority: 0,
  target: 'self',
  contact: false,
  effects: [{ kind: 'weather', weather: 'rain' }],
  vfx: 'water',
  description: 'Summons rain for five turns, boosting Water moves.',
});

move({
  id: 'maelstrom',
  name: 'Maelstrom',
  type: 'water',
  category: 'special',
  power: 110,
  accuracy: 80,
  pp: 5,
  priority: 0,
  target: 'foe',
  contact: false,
  vfx: 'water-sig',
  description: 'A trident-driven whirlpool that tears the field apart.',
  signatureOf: 'maelstrotter',
});

move({
  id: 'pop-burst',
  name: 'Pop Burst',
  type: 'water',
  category: 'special',
  power: 65,
  accuracy: 100,
  pp: 15,
  priority: 0,
  target: 'foe',
  contact: false,
  effects: [{ kind: 'volatile', volatile: 'soaked', target: 'foe', chance: 0.2 }],
  vfx: 'water',
  description: 'Bursts like a balloon, drenching the foe.',
  signatureOf: 'bubbloon',
});

move({
  id: 'abyssal-spikes',
  name: 'Abyssal Spikes',
  type: 'water',
  category: 'physical',
  power: 90,
  accuracy: 95,
  pp: 10,
  priority: 0,
  target: 'foe',
  contact: true,
  effects: [{ kind: 'volatile', volatile: 'soaked', target: 'foe', chance: 0.2 }],
  vfx: 'water',
  description: 'Bioluminescent spines strike from the deep.',
  signatureOf: 'puffathom',
});

move({
  id: 'reef-coil',
  name: 'Reef Coil',
  type: 'water',
  category: 'special',
  power: 85,
  accuracy: 95,
  pp: 10,
  priority: 0,
  target: 'foe',
  contact: false,
  effects: [{ kind: 'drain', fraction: 0.25 }],
  vfx: 'water',
  description: 'Coils around the foe and siphons its energy.',
  signatureOf: 'coralisk',
});

move({
  id: 'lighthouse-slam',
  name: 'Lighthouse Slam',
  type: 'water',
  category: 'physical',
  power: 95,
  accuracy: 90,
  pp: 10,
  priority: 0,
  target: 'foe',
  contact: true,
  vfx: 'water',
  description: 'Swings its entire lighthouse shell like a hammer.',
  signatureOf: 'krabrine',
});

/* ----------------------------------------------------------------- Grass -- */

move({
  id: 'vine-lash',
  name: 'Vine Lash',
  type: 'grass',
  category: 'physical',
  power: 45,
  accuracy: 100,
  pp: 25,
  priority: 0,
  target: 'foe',
  contact: true,
  vfx: 'grass',
  description: 'Whips the foe with a tough vine.',
  signatureOf: 'sproutle',
});

move({
  id: 'leech-root',
  name: 'Leech Root',
  type: 'grass',
  category: 'special',
  power: 60,
  accuracy: 90,
  pp: 15,
  priority: 0,
  target: 'foe',
  contact: false,
  effects: [{ kind: 'drain', fraction: 0.5 }],
  vfx: 'grass',
  description: 'Drains the foe\u2019s energy and heals half of it.',
});

move({
  id: 'spore-cloud',
  name: 'Spore Cloud',
  type: 'grass',
  category: 'status',
  power: 0,
  accuracy: 75,
  pp: 15,
  priority: 0,
  target: 'foe',
  contact: false,
  effects: [{ kind: 'status', status: 'sleep' }],
  vfx: 'grass',
  description: 'A cloud of spores that puts the foe to sleep.',
});

move({
  id: 'thorn-barrage',
  name: 'Thorn Barrage',
  type: 'grass',
  category: 'physical',
  power: 25,
  accuracy: 90,
  pp: 20,
  priority: 0,
  target: 'foe',
  contact: true,
  multihit: [2, 5],
  vfx: 'grass',
  description: 'Hurls a flurry of thorns two to five times.',
  signatureOf: 'thornshell',
});

move({
  id: 'leaf-blade',
  name: 'Leaf Blade',
  type: 'grass',
  category: 'physical',
  power: 80,
  accuracy: 100,
  pp: 15,
  priority: 0,
  target: 'foe',
  contact: true,
  critStage: 1,
  vfx: 'grass',
  description: 'Slices with a razor leaf. Easily a critical hit.',
});

move({
  id: 'bloom-heal',
  name: 'Bloom Heal',
  type: 'grass',
  category: 'status',
  power: 0,
  accuracy: 'bypass',
  pp: 10,
  priority: 0,
  target: 'self',
  contact: false,
  effects: [{ kind: 'heal', fraction: 0.5 }],
  vfx: 'grass',
  description: 'Petals swirl and restore half of its HP.',
  signatureOf: 'bloomwisp',
});

move({
  id: 'ensnare',
  name: 'Ensnare',
  type: 'grass',
  category: 'status',
  power: 0,
  accuracy: 90,
  pp: 20,
  priority: 0,
  target: 'foe',
  contact: false,
  effects: [{ kind: 'status', status: 'entangled' }],
  vfx: 'grass',
  description: 'Roots grip the foe, preventing escape.',
});

move({
  id: 'verdant-quake',
  name: 'Verdant Quake',
  type: 'grass',
  category: 'physical',
  power: 100,
  accuracy: 90,
  pp: 10,
  priority: 0,
  target: 'foe',
  contact: false,
  vfx: 'grass',
  description: 'Ancient roots erupt from the earth in a rolling quake.',
});

move({
  id: 'world-tree',
  name: 'World Tree',
  type: 'grass',
  category: 'special',
  power: 110,
  accuracy: 90,
  pp: 5,
  priority: 0,
  target: 'foe',
  contact: false,
  effects: [
    { kind: 'drain', fraction: 0.5 },
    { kind: 'heal', fraction: 0.25 },
  ],
  vfx: 'grass-sig',
  description: 'The forest on its back awakens and drains the foe.',
  signatureOf: 'grovetitan',
});

move({
  id: 'drowsy-spores',
  name: 'Drowsy Spores',
  type: 'grass',
  category: 'status',
  power: 0,
  accuracy: 85,
  pp: 10,
  priority: 0,
  target: 'foe',
  contact: false,
  effects: [{ kind: 'status', status: 'sleep' }],
  vfx: 'grass',
  description: 'A grumpy puff of spores that always seems to land.',
  signatureOf: 'shroomble',
});

move({
  id: 'snap-trap',
  name: 'Snap Trap',
  type: 'grass',
  category: 'physical',
  power: 85,
  accuracy: 100,
  pp: 10,
  priority: 0,
  target: 'foe',
  contact: true,
  critStage: 1,
  vfx: 'grass',
  description: 'An ambush bite from a hidden flytrap.',
  signatureOf: 'vinesnap',
});

/* -------------------------------------------------------------- Electric -- */

move({
  id: 'spark',
  name: 'Spark',
  type: 'electric',
  category: 'physical',
  power: 40,
  accuracy: 100,
  pp: 25,
  priority: 0,
  target: 'foe',
  contact: true,
  effects: [{ kind: 'status', status: 'paralyze', chance: 0.1 }],
  vfx: 'electric',
  description: 'A crackling tackle. May paralyze.',
});

move({
  id: 'volt-dash',
  name: 'Volt Dash',
  type: 'electric',
  category: 'physical',
  power: 60,
  accuracy: 100,
  pp: 20,
  priority: 1,
  target: 'foe',
  contact: true,
  vfx: 'electric',
  description: 'A lightning-fast charge that always strikes first.',
  signatureOf: 'sparkit',
});

move({
  id: 'static-field',
  name: 'Static Field',
  type: 'electric',
  category: 'status',
  power: 0,
  accuracy: 90,
  pp: 20,
  priority: 0,
  target: 'foe',
  contact: false,
  effects: [{ kind: 'status', status: 'paralyze' }],
  vfx: 'electric',
  description: 'A field of static that paralyzes the foe.',
  signatureOf: 'ampuff',
});

move({
  id: 'chain-lightning',
  name: 'Chain Lightning',
  type: 'electric',
  category: 'special',
  power: 80,
  accuracy: 95,
  pp: 10,
  priority: 0,
  target: 'foe',
  contact: false,
  tags: ['bonus-vs-soaked'],
  vfx: 'electric',
  description: 'Arcs between targets, especially painful to a Soaked foe.',
  signatureOf: 'fulminx',
});

move({
  id: 'overcharge',
  name: 'Overcharge',
  type: 'electric',
  category: 'status',
  power: 0,
  accuracy: 'bypass',
  pp: 10,
  priority: 0,
  target: 'self',
  contact: false,
  effects: [{ kind: 'stat', target: 'self', changes: { spPower: 2 } }],
  vfx: 'electric',
  description: 'Draws in power, sharply raising Sp. Power.',
  signatureOf: 'coilbug',
});

move({
  id: 'magnet-pull',
  name: 'Magnet Pull',
  type: 'electric',
  category: 'status',
  power: 0,
  accuracy: 'bypass',
  pp: 20,
  priority: 0,
  target: 'foe',
  contact: false,
  effects: [{ kind: 'prevent-flee' }],
  vfx: 'electric',
  description: 'A magnetic field locks the foe in place.',
});

move({
  id: 'ion-shield',
  name: 'Ion Shield',
  type: 'electric',
  category: 'status',
  power: 0,
  accuracy: 'bypass',
  pp: 10,
  priority: 4,
  target: 'self',
  contact: false,
  effects: [{ kind: 'protect' }],
  vfx: 'electric',
  description: 'An ionised barrier blocks all attacks this turn.',
});

move({
  id: 'thunderfall',
  name: 'Thunderfall',
  type: 'electric',
  category: 'special',
  power: 110,
  accuracy: 70,
  pp: 5,
  priority: 0,
  target: 'foe',
  contact: false,
  effects: [{ kind: 'status', status: 'paralyze', chance: 0.3 }],
  vfx: 'electric-sig',
  description: 'A ram calls down a pillar of lightning. May paralyze.',
  signatureOf: 'stormfleece',
});

move({
  id: 'arc-coil',
  name: 'Arc Coil',
  type: 'electric',
  category: 'physical',
  power: 85,
  accuracy: 100,
  pp: 10,
  priority: 0,
  target: 'foe',
  contact: true,
  effects: [{ kind: 'status', status: 'paralyze', chance: 0.2 }],
  vfx: 'electric',
  description: 'Segments coil and discharge along the whole body.',
  signatureOf: 'teslapede',
});

move({
  id: 'skybreaker',
  name: 'Skybreaker',
  type: 'electric',
  category: 'physical',
  power: 110,
  accuracy: 85,
  pp: 5,
  priority: 0,
  target: 'foe',
  contact: true,
  effects: [{ kind: 'status', status: 'paralyze', chance: 0.2 }],
  vfx: 'electric-sig',
  description: 'A storm-dragon drives its lightning-rod horns home.',
  signatureOf: 'thundrake',
});

/* ---------------------------------------------------------------- Shadow -- */

move({
  id: 'shade-claw',
  name: 'Shade Claw',
  type: 'shadow',
  category: 'physical',
  power: 50,
  accuracy: 100,
  pp: 25,
  priority: 0,
  target: 'foe',
  contact: true,
  critStage: 1,
  vfx: 'shadow',
  description: 'A claw of solid darkness. Easily a critical hit.',
  signatureOf: 'nightfang',
});

move({
  id: 'night-veil',
  name: 'Night Veil',
  type: 'shadow',
  category: 'status',
  power: 0,
  accuracy: 'bypass',
  pp: 20,
  priority: 0,
  target: 'self',
  contact: false,
  effects: [{ kind: 'stat', target: 'self', changes: { evasion: 2 } }],
  vfx: 'shadow',
  description: 'Wraps itself in night, sharply raising evasion.',
  signatureOf: 'gloomlet',
});

move({
  id: 'hex-bite',
  name: 'Hex Bite',
  type: 'shadow',
  category: 'physical',
  power: 65,
  accuracy: 100,
  pp: 15,
  priority: 0,
  target: 'foe',
  contact: true,
  tags: ['double-vs-status'],
  vfx: 'shadow',
  description: 'Doubles in power against a foe with a status condition.',
  signatureOf: 'shadeling',
});

move({
  id: 'nightmare',
  name: 'Nightmare',
  type: 'shadow',
  category: 'status',
  power: 0,
  accuracy: 90,
  pp: 15,
  priority: 0,
  target: 'foe',
  contact: false,
  effects: [{ kind: 'status', status: 'fear' }],
  vfx: 'shadow',
  description: 'Wakes a lingering terror in the foe\u2019s mind.',
});

move({
  id: 'void-pulse',
  name: 'Void Pulse',
  type: 'shadow',
  category: 'special',
  power: 85,
  accuracy: 95,
  pp: 10,
  priority: 0,
  target: 'foe',
  contact: false,
  vfx: 'shadow',
  description: 'A pulse of pure absence from the void.',
  signatureOf: 'duskmaw',
});

move({
  id: 'soul-drain',
  name: 'Soul Drain',
  type: 'shadow',
  category: 'special',
  power: 70,
  accuracy: 90,
  pp: 15,
  priority: 0,
  target: 'foe',
  contact: false,
  effects: [{ kind: 'drain', fraction: 0.5 }],
  vfx: 'shadow',
  description: 'Siphons vitality and heals half of it.',
});

move({
  id: 'phantom-step',
  name: 'Phantom Step',
  type: 'shadow',
  category: 'status',
  power: 0,
  accuracy: 'bypass',
  pp: 10,
  priority: 0,
  target: 'self',
  contact: false,
  effects: [{ kind: 'sure-hit' }],
  vfx: 'shadow',
  description: 'Phase out of step — the next move cannot miss.',
});

move({
  id: 'dread-howl',
  name: 'Dread Howl',
  type: 'shadow',
  category: 'status',
  power: 0,
  accuracy: 100,
  pp: 15,
  priority: 0,
  target: 'all-foes',
  contact: false,
  effects: [{ kind: 'stat', target: 'all-foes', changes: { spGuard: -1 } }],
  tags: ['spread'],
  vfx: 'shadow',
  description: 'A howl from the dark that lowers every foe\u2019s Sp. Guard.',
});

move({
  id: 'soul-lantern',
  name: 'Soul Lantern',
  type: 'shadow',
  category: 'special',
  power: 105,
  accuracy: 90,
  pp: 5,
  priority: 0,
  target: 'foe',
  contact: false,
  tags: ['double-vs-status'],
  vfx: 'shadow-sig',
  description: 'Its lantern flares, doubling power against an afflicted foe.',
  signatureOf: 'umbrawraith',
});

move({
  id: 'total-eclipse',
  name: 'Total Eclipse',
  type: 'shadow',
  category: 'special',
  power: 130,
  accuracy: 85,
  pp: 5,
  priority: 0,
  target: 'foe',
  contact: false,
  effects: [{ kind: 'status', status: 'fear', chance: 0.3 }],
  vfx: 'shadow-sig',
  description: 'The sun goes out. All light is swallowed whole.',
  signatureOf: 'eclipsor',
});

/* --------------------------------------------------------------- Crystal -- */

move({
  id: 'shard-toss',
  name: 'Shard Toss',
  type: 'crystal',
  category: 'physical',
  power: 45,
  accuracy: 100,
  pp: 25,
  priority: 0,
  target: 'foe',
  contact: false,
  vfx: 'crystal',
  description: 'Flings a jagged quartz shard.',
  signatureOf: 'shardling',
});

move({
  id: 'prism-beam',
  name: 'Prism Beam',
  type: 'crystal',
  category: 'special',
  power: 70,
  accuracy: 100,
  pp: 15,
  priority: 0,
  target: 'foe',
  contact: false,
  effects: [{ kind: 'volatile', volatile: 'dazzled', target: 'foe', chance: 0.2 }],
  vfx: 'crystal',
  description: 'A refracted beam. May Dazzle the foe.',
  signatureOf: 'glimmoth',
});

move({
  id: 'gem-shield',
  name: 'Gem Shield',
  type: 'crystal',
  category: 'status',
  power: 0,
  accuracy: 'bypass',
  pp: 15,
  priority: 0,
  target: 'self',
  contact: false,
  effects: [{ kind: 'stat', target: 'self', changes: { defense: 2 } }],
  vfx: 'crystal',
  description: 'Grows a layer of gemstone, sharply raising Defense.',
});

move({
  id: 'refract',
  name: 'Refract',
  type: 'crystal',
  category: 'status',
  power: 0,
  accuracy: 'bypass',
  pp: 10,
  priority: 0,
  target: 'self',
  contact: false,
  effects: [{ kind: 'reflect', fraction: 0.5, turns: 3 }],
  vfx: 'crystal',
  description: 'Bends incoming special attacks back for three turns.',
  signatureOf: 'facetoad',
});

move({
  id: 'facet-storm',
  name: 'Facet Storm',
  type: 'crystal',
  category: 'physical',
  power: 90,
  accuracy: 95,
  pp: 10,
  priority: 0,
  target: 'foe',
  contact: true,
  vfx: 'crystal',
  description: 'A whirlwind of diamond scythes that split the light.',
  signatureOf: 'prismantis',
});

move({
  id: 'glitter-dust',
  name: 'Glitter Dust',
  type: 'crystal',
  category: 'status',
  power: 0,
  accuracy: 90,
  pp: 20,
  priority: 0,
  target: 'foe',
  contact: false,
  effects: [{ kind: 'volatile', volatile: 'dazzled', target: 'foe' }],
  vfx: 'crystal',
  description: 'Sparkling dust that sharply reduces the foe\u2019s accuracy.',
});

move({
  id: 'crystallize',
  name: 'Crystallize',
  type: 'crystal',
  category: 'status',
  power: 0,
  accuracy: 'bypass',
  pp: 20,
  priority: 0,
  target: 'self',
  contact: false,
  effects: [
    { kind: 'stat', target: 'self', changes: { defense: 1, spGuard: 1 } },
  ],
  vfx: 'crystal',
  description: 'Hardens its shell, raising Defense and Sp. Guard.',
});

move({
  id: 'radiant-lance',
  name: 'Radiant Lance',
  type: 'crystal',
  category: 'special',
  power: 100,
  accuracy: 90,
  pp: 10,
  priority: 0,
  target: 'foe',
  contact: false,
  vfx: 'crystal-sig',
  description: 'A lance of pure aurora light pierces the foe.',
  signatureOf: 'lumicorn',
});

/* --------------------------------------------------------------- Neutral -- */

move({
  id: 'tackle',
  name: 'Tackle',
  type: 'neutral',
  category: 'physical',
  power: 40,
  accuracy: 100,
  pp: 35,
  priority: 0,
  target: 'foe',
  contact: true,
  vfx: 'neutral',
  description: 'A straightforward body slam.',
});

move({
  id: 'scratch',
  name: 'Scratch',
  type: 'neutral',
  category: 'physical',
  power: 40,
  accuracy: 100,
  pp: 35,
  priority: 0,
  target: 'foe',
  contact: true,
  vfx: 'neutral',
  description: 'Rakes the foe with sharp claws.',
});

move({
  id: 'quick-strike',
  name: 'Quick Strike',
  type: 'neutral',
  category: 'physical',
  power: 40,
  accuracy: 100,
  pp: 30,
  priority: 1,
  target: 'foe',
  contact: true,
  vfx: 'neutral',
  description: 'A blindingly fast jab that always strikes first.',
});

move({
  id: 'body-slam',
  name: 'Body Slam',
  type: 'neutral',
  category: 'physical',
  power: 85,
  accuracy: 100,
  pp: 15,
  priority: 0,
  target: 'foe',
  contact: true,
  effects: [{ kind: 'status', status: 'paralyze', chance: 0.3 }],
  vfx: 'neutral',
  description: 'A full-body crushing slam. May paralyze.',
});

move({
  id: 'growl',
  name: 'Growl',
  type: 'neutral',
  category: 'status',
  power: 0,
  accuracy: 100,
  pp: 40,
  priority: 0,
  target: 'foe',
  contact: false,
  effects: [{ kind: 'stat', target: 'foe', changes: { attack: -1 } }],
  vfx: 'neutral',
  description: 'A cute growl that lowers the foe\u2019s Attack.',
});

move({
  id: 'focus',
  name: 'Focus',
  type: 'neutral',
  category: 'status',
  power: 0,
  accuracy: 'bypass',
  pp: 20,
  priority: 0,
  target: 'self',
  contact: false,
  effects: [{ kind: 'crit-stage', stages: 2 }],
  vfx: 'neutral',
  description: 'Sharpens the mind to land critical hits more often.',
});

move({
  id: 'rest',
  name: 'Rest',
  type: 'neutral',
  category: 'status',
  power: 0,
  accuracy: 'bypass',
  pp: 5,
  priority: 0,
  target: 'self',
  contact: false,
  effects: [
    { kind: 'heal', fraction: 1 },
    { kind: 'sleep-self', turns: 2 },
  ],
  vfx: 'neutral',
  description: 'Sleeps for two turns to fully restore HP.',
});

move({
  id: 'struggle',
  name: 'Struggle',
  type: 'neutral',
  category: 'physical',
  power: 50,
  accuracy: 'bypass',
  pp: 1,
  priority: 0,
  target: 'foe',
  contact: true,
  effects: [{ kind: 'recoil', fraction: 0.25 }],
  tags: ['unblockable'],
  vfx: 'neutral',
  description: 'Used when out of PP. Hurts the user a little too.',
});

/* ------------------------------------------------- Special / mythical -- */

move({
  id: 'spectrum-burst',
  name: 'Spectrum Burst',
  type: 'neutral',
  category: 'special',
  power: 120,
  accuracy: 95,
  pp: 5,
  priority: 0,
  target: 'foe',
  contact: false,
  tags: ['best-type'],
  vfx: 'prism-sig',
  description: 'Unleashes all six elements, striking the foe\u2019s weakest point.',
  signatureOf: 'aetherion',
});

export const MOVES = M;

export const MOVE_IDS = Object.keys(MOVES);

export function getMove(id: string): MoveData | undefined {
  return MOVES[id];
}

/** Throws when a move id is unknown — used by the data integrity tests. */
export function requireMove(id: string): MoveData {
  const m = MOVES[id];
  if (!m) throw new Error(`Unknown move id: ${id}`);
  return m;
}

export function movesOfType(type: MoveType): MoveData[] {
  return MOVE_IDS.map((id) => MOVES[id]).filter((m) => m.type === type);
}

/** True when the move deals damage (used for AI and for animation choice). */
export function isDamaging(move: MoveData): boolean {
  return move.power > 0 && move.category !== 'status';
}
