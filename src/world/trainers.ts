/**
 * Every trainer in Prismara: route trainers, Team Eclipse, the rival Kai, the
 * six Trial Masters and the Champion.
 *
 * A trainer is data — a party, an AI tier, a purse and lines of dialogue. The
 * Battle scene turns a `TrainerDef` into a `BattleState`.
 */

import { rivalStarterFor, type CreatureId } from '../data/creatures';
import type { AITier } from '../battle/BattleState';
import { evolutionLine } from '../data/creatures';

export interface TrainerMon {
  speciesId: CreatureId;
  level: number;
  /** Override the default learnset (the last four moves at that level). */
  moves?: string[];
}

export interface TrainerDialogue {
  /** Line shown as the battle begins. */
  intro: string[];
  /** Line shown when the player wins. */
  defeat: string[];
  /** Line shown when the player loses. */
  victory?: string[];
  /** Line shown when the player talks again after winning. */
  after?: string[];
}

export interface TrainerDef {
  id: string;
  name: string;
  /** Class shown on the VS banner, e.g. "Youngster". */
  trainerClass: string;
  tier: AITier;
  party: TrainerMon[];
  /** Prize money on defeat. */
  purse: number;
  dialogue: TrainerDialogue;
  /** Trial Masters drop a Trophy. */
  sigil?: string;
  /** Body colour for the overworld sprite and VS banner. */
  color: number;
  /** Post-battle flag to set. */
  setsFlag?: string;
  /** Only fight when this flag is set. */
  requiresFlag?: string;
  /** Refuse to fight again when this flag is set. */
  onceFlag?: string;
  isChampion?: boolean;
}

function t(id: string, name: string, trainerClass: string, tier: AITier, purse: number, color: number): Omit<TrainerDef, 'party' | 'dialogue'> {
  return { id, name, trainerClass, tier, purse, color };
}

export const TRAINERS: Record<string, TrainerDef> = {
  /* ------------------------------------------------------- Route trainers -- */

  'youngster-ben': {
    ...t('youngster-ben', 'Ben', 'Youngster', 'youngster', 120, 0x4cd964),
    party: [{ speciesId: 'sparkit', level: 6 }],
    dialogue: {
      intro: ['Hey! You have a creature too?', 'Let\u2019s see whose is stronger!'],
      defeat: ['Aw, you got me.', 'I\u2019m going to train way harder!'],
      after: ['The tall grass on Route 1 is full of creatures.'],
    },
  },
  'lass-mira': {
    ...t('lass-mira', 'Mira', 'Lass', 'youngster', 150, 0xff8fc4),
    party: [
      { speciesId: 'mossprite', level: 6 },
      { speciesId: 'bubbloon', level: 7 },
    ],
    dialogue: {
      intro: ['I found these in Whisperwood!', 'They\u2019re adorable AND tough.'],
      defeat: ['So cute, so defeated...'],
      after: ['Whisperwood gets dark at night. Be careful.'],
    },
  },
  'bug-catcher-orel': {
    ...t('bug-catcher-orel', 'Orel', 'Bug Catcher', 'youngster', 140, 0xd98a3a),
    party: [
      { speciesId: 'coilbug', level: 8 },
      { speciesId: 'coilbug', level: 9 },
    ],
    dialogue: {
      intro: ['My coilbugs are buzzing with power!'],
      defeat: ['They short-circuited...'],
      after: ['Electric beats Water but loses to Grass. Remember that!'],
    },
  },
  'hiker-rolf': {
    ...t('hiker-rolf', 'Rolf', 'Hiker', 'trainer', 320, 0x8a4a2f),
    party: [
      { speciesId: 'cindermole', level: 14 },
      { speciesId: 'magmolith', level: 15 },
    ],
    dialogue: {
      intro: ['These caves are my second home.', 'Show me what you\u2019ve got!'],
      defeat: ['Solid effort, kid.'],
      after: ['The Ember Trophy lets you light up dark caves.'],
    },
  },
  'sailor-mako': {
    ...t('sailor-mako', 'Mako', 'Sailor', 'trainer', 380, 0x3f7fbf),
    party: [
      { speciesId: 'krabrine', level: 18 },
      { speciesId: 'coralisk', level: 19 },
    ],
    dialogue: {
      intro: ['Yarr! The tide brought you to me!'],
      defeat: ['Blown off course!'],
      after: ['Surf opens up the whole coast once you have the Tide Trophy.'],
    },
  },
  'ace-nerys': {
    ...t('ace-nerys', 'Nerys', 'Ace Trainer', 'master', 900, 0x8e5cff),
    party: [
      { speciesId: 'teslapede', level: 30 },
      { speciesId: 'lumicorn', level: 31 },
      { speciesId: 'duskmaw', level: 32 },
    ],
    dialogue: {
      intro: ['I only battle trainers worth my time.', 'Impress me.'],
      defeat: ['...Impressive.', 'Take this as respect, not charity.'],
      after: ['Aurelia stopped teaching a year ago. Go and see why.'],
    },
  },

  /* -------------------------------------------------------- Team Eclipse -- */

  'eclipse-grunt-1': {
    ...t('eclipse-grunt-1', 'Eclipse Grunt', 'Team Eclipse', 'trainer', 300, 0x4d2aa8),
    party: [
      { speciesId: 'gloomlet', level: 11 },
      { speciesId: 'duskmaw', level: 12 },
    ],
    dialogue: {
      intro: ['Voss says the twilight is a kindness.', 'Orders: slow Edda’s child. No harm done.'],
      defeat: ['You fight like the fracture never scared you.', 'Voss said nobody would fight back.'],
      after: ['The wood is clear. Ivy waits in Thistlebrook to test you.'],
    },
    setsFlag: 'eclipse-forest-cleared',
  },
  'eclipse-grunt-2': {
    ...t('eclipse-grunt-2', 'Eclipse Grunt', 'Team Eclipse', 'trainer', 420, 0x4d2aa8),
    party: [
      { speciesId: 'nightfang', level: 18 },
      { speciesId: 'shadeling', level: 19 },
      { speciesId: 'duskmaw', level: 19 },
    ],
    dialogue: {
      intro: ['This plant feeds the altar.', 'We drain it so the glass stays warm.'],
      defeat: ['Ugh... Voss will not be pleased.', 'He swore the turbines would never fail him.'],
      after: ['The plant is Volta\u2019s again. She is waiting for a real challenger.'],
    },
    setsFlag: 'eclipse-plant-cleared',
  },
  'eclipse-admin-voss': {
    ...t('eclipse-admin-voss', 'Voss', 'Eclipse Admin', 'master', 1600, 0x2e2050),
    party: [
      { speciesId: 'umbrawraith', level: 40 },
      { speciesId: 'duskmaw', level: 40 },
      { speciesId: 'nightfang', level: 41 },
      { speciesId: 'shadeling', level: 40 },
    ],
    dialogue: {
      intro: ['You carry her light. Forgive me.', 'I cannot let the cold go. Not yet.'],
      defeat: ['Six lights, and not one of them broke.', 'Perhaps I have feared the wrong thing.'],
      victory: ['Rest, child. Come back stronger.', 'I will keep the cold until you do.'],
      after: ['Go to the Summit. Aurelia owes you the truth.'],
    },
    setsFlag: 'eclipse-ritual-broken',
    requiresFlag: 'trial-6-cleared',
  },

  /* ------------------------------------------------------- Trial Masters -- */

  'trial-ivy': {
    ...t('trial-ivy', 'Ivy', 'Trial Master', 'master', 1200, 0x4cd964),
    sigil: 'sigil-grass',
    party: [
      { speciesId: 'sproutle', level: 11 },
      { speciesId: 'shroomble', level: 12 },
      { speciesId: 'bloomwisp', level: 14 },
    ],
    dialogue: {
      intro: ['Welcome to Thistlebrook, little sprout.', 'My trial is simple: outgrow the fracture.'],
      defeat: ['You bloomed beautifully.', 'Take the Verdant Trophy — its growth teaches Cut.'],
      after: ['Cut the little trees, then head east to Voltspire.'],
    },
    setsFlag: 'trial-1-cleared',
  },
  'trial-volta': {
    ...t('trial-volta', 'Volta', 'Trial Master', 'master', 2200, 0xffd60a),
    sigil: 'sigil-electric',
    party: [
      { speciesId: 'coilbug', level: 19 },
      { speciesId: 'fulminx', level: 21 },
      { speciesId: 'stormfleece', level: 22 },
    ],
    dialogue: {
      intro: ['Voltspire runs on my turbines alone.', 'Show me resilience the fracture could not short out.'],
      defeat: ['Circuit restored.', 'Take the Storm Trophy — its resilience powers the Magnet Lifts.'],
      after: ['Ride the yellow Magnet plates south to Tidehaven.'],
    },
    setsFlag: 'trial-2-cleared',
  },
  'trial-marin': {
    ...t('trial-marin', 'Marin', 'Trial Master', 'master', 3200, 0x2ea8ff),
    sigil: 'sigil-water',
    party: [
      { speciesId: 'puffathom', level: 26 },
      { speciesId: 'krabrine', level: 28 },
      { speciesId: 'coralisk', level: 29 },
    ],
    dialogue: {
      intro: ['The sea keeps no secrets from me, Captain Marin!', 'Show me you can flow with the tide, not against it.'],
      defeat: ['Smooth sailing.', 'The Tide Trophy is yours — its flow teaches Surf.'],
      after: ['Surf the southern sea toward Ashfall Town.'],
    },
    setsFlag: 'trial-3-cleared',
  },
  'trial-blaze': {
    ...t('trial-blaze', 'Blaze', 'Trial Master', 'master', 4200, 0xff6b35),
    sigil: 'sigil-fire',
    party: [
      { speciesId: 'cindermole', level: 32 },
      { speciesId: 'ashwing', level: 34 },
      { speciesId: 'magmolith', level: 35 },
    ],
    dialogue: {
      intro: ['I forge steel all day and battle all night.', 'Show me the courage to walk into the dark.'],
      defeat: ['Hammered flat!', 'The Ember Trophy is yours — its courage lights the darkest caves.'],
      after: ['Carry that light west into Geode Hollow.'],
    },
    setsFlag: 'trial-4-cleared',
  },
  'trial-opal': {
    ...t('trial-opal', 'Opal', 'Trial Master', 'master', 5200, 0x7fffe5),
    sigil: 'sigil-crystal',
    party: [
      { speciesId: 'facetoad', level: 38 },
      { speciesId: 'glimmoth', level: 40 },
      { speciesId: 'prismantis', level: 41 },
    ],
    dialogue: {
      intro: ['Geode Hollow is my gallery, and every gem is a masterpiece.', 'Show me the clarity to see what must break.'],
      defeat: ['Flawless. Utterly flawless.', 'Take the Facet Trophy — its clarity teaches Smash.'],
      after: ['Smash the crystal wall north toward Duskmoor Ruins.'],
    },
    setsFlag: 'trial-5-cleared',
  },
  'trial-raven': {
    ...t('trial-raven', 'Raven', 'Trial Master', 'master', 6200, 0x8e5cff),
    sigil: 'sigil-shadow',
    party: [
      { speciesId: 'nightfang', level: 43 },
      { speciesId: 'duskmaw', level: 44 },
      { speciesId: 'umbrawraith', level: 46 },
    ],
    dialogue: {
      intro: ['I write poems about the dark that nobody reads.', 'Show me you can remember what the twilight keeps.'],
      defeat: ['A verse worth keeping.', 'The Twilight Trophy is yours. Its remembrance grants Night Sight.'],
      after: ['Voss is waiting at the altar. Be gentle with him.'],
    },
    setsFlag: 'trial-6-cleared',
  },

  /* ------------------------------------------------------------- Champion -- */

  'champion-aurelia': {
    ...t('champion-aurelia', 'Aurelia', 'Champion', 'master', 12000, 0xffd60a),
    isChampion: true,
    party: [
      { speciesId: 'grovetitan', level: 50 },
      { speciesId: 'maelstrotter', level: 50 },
      { speciesId: 'infernyx', level: 52 },
      { speciesId: 'prismantis', level: 51 },
      { speciesId: 'thundrake', level: 54 },
    ],
    dialogue: {
      intro: [
        'Six Trophies. One summit. I am the last test.',
        'I led the Concord. I will tell you everything.',
        'First, show me a heart that will not break.',
      ],
      defeat: ['Wonderful. Truly wonderful.', 'The Lens is yours. The last stair is open.'],
      victory: ['Not yet. Rest, and try again.'],
      after: ['The altar waits for your six Trophies.', 'After that, the door is open to every trainer.'],
    },
    setsFlag: 'champion-defeated',
  },
};

/**
 * Build the rival's party. Kai always takes the starter that beats yours, and
 * his team grows across the four battles.
 */
export function buildRivalParty(battleIndex: number, playerStarter: CreatureId): TrainerMon[] {
  const rivalStarter = rivalStarterFor(playerStarter);
  const line = evolutionLine(rivalStarter).map((s) => s.id);
  const beats: Array<Array<{ stage: 0 | 1 | 2; level: number }>> = [
    [{ stage: 0, level: 5 }],
    [
      { stage: 1, level: 16 },
      { stage: 0, level: 15 },
    ],
    [
      { stage: 1, level: 26 },
      { stage: 1, level: 27 },
      { stage: 0, level: 25 },
    ],
    [
      { stage: 2, level: 40 },
      { stage: 2, level: 41 },
      { stage: 1, level: 39 },
      { stage: 1, level: 38 },
    ],
  ];
  const plan = beats[Math.max(0, Math.min(beats.length - 1, battleIndex - 1))];
  const filler = FILLERS[rivalStarter] ?? FILLERS.drizzlet;

  return plan.map((entry, index) => {
    const speciesId =
      entry.stage === 0 ? line[0] : entry.stage === 1 ? (line[1] ?? line[0]) : (line[2] ?? line[1] ?? line[0]);
    if (index === 0) return { speciesId, level: entry.level };
    return { speciesId: filler[Math.min(filler.length - 1, index - 1)], level: entry.level };
  });
}

/** Secondary creatures the rival brings, themed to his starter. */
const FILLERS: Record<string, CreatureId[]> = {
  emberkit: ['cindermole', 'sparkit', 'nightfang'],
  drizzlet: ['bubbloon', 'coralisk', 'glimmoth'],
  sproutle: ['mossprite', 'vinesnap', 'shroomble'],
};

/**
 * Rival dialogue, which changes with the story beat. Lines are templates:
 * `{player}` and `{rival}` are replaced at display time (see story/dialogue.ts)
 * so a renamed companion is never shown as "Kai".
 */
export function rivalDialogue(battleIndex: number): TrainerDialogue {
  switch (battleIndex) {
    case 1:
      return {
        intro: [
          '{player}! You took a partner too?',
          'Mine beats yours, obviously.',
          'I have to be strong enough to find Soren.',
        ],
        defeat: ['What?! Already?', 'Fine. I’ll train twice as hard.'],
        after: ['Meet me in Whisperwood. Eclipse hides there.'],
      };
    case 2:
      return {
        intro: ['You again! I have new teammates.', 'Soren would have loved a fight like this.'],
        defeat: ['No way... I still have a long way to go.'],
        after: ['Voltspire next. Soren always liked places with lights.'],
      };
    case 3:
      return {
        intro: ['Eclipse is dangerous. Even for you.', 'Win, and I’ll believe you can reach him.'],
        defeat: ['You really are something.', 'Go on. I’ll hold the rear.'],
        after: ['Ashfall next. Don’t lose to Eclipse.'],
      };
    default:
      return {
        intro: ['Last battle before the Summit.', 'Win, and I’ll let you tell me all of it.'],
        defeat: ['...You win. All of it.', 'Go. I’ll meet you at the altar.'],
        after: ['He’s at the altar with Voss. I’m going to listen.'],
      };
  }
}

export function getTrainer(id: string): TrainerDef | undefined {
  return TRAINERS[id];
}

/** Trainers that should be present on a given map. */
export function trainersOnMap(mapId: string): TrainerDef[] {
  return Object.values(TRAINERS).filter((trainer) => trainerLocation(trainer.id) === mapId);
}

/** Where each named trainer stands, for the overworld NPC builder. */
export function trainerLocation(id: string): string | undefined {
  const table: Record<string, string> = {
    'youngster-ben': 'route-1',
    'lass-mira': 'whisperwood-forest',
    'bug-catcher-orel': 'route-2',
    'hiker-rolf': 'glimmer-caverns',
    'sailor-mako': 'route-3',
    'ace-nerys': 'route-7',
    'eclipse-grunt-1': 'whisperwood-forest',
    'eclipse-grunt-2': 'voltspire-city',
    'eclipse-admin-voss': 'duskmoor-ruins',
    'trial-ivy': 'thistlebrook',
    'trial-volta': 'voltspire-city',
    'trial-marin': 'tidehaven',
    'trial-blaze': 'ashfall-town',
    'trial-opal': 'geode-hollow',
    'trial-raven': 'duskmoor-ruins',
    'champion-aurelia': 'prism-summit',
  };
  return table[id];
}
