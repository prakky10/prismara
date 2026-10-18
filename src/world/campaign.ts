/**
 * Campaign architecture: the six Trials, chapters and side quests. The story
 * scenes themselves live in ./story (scenes.ts and sceneRunner.ts).
 *
 * Everything here is derived from existing GameState flags, so no save schema
 * change is required and old saves keep working.
 */

import type { GameState } from '../core/GameState';
import type { ItemId } from '../data/items';

export interface Trophy {
  id: string;
  name: string;
  keeper: string;
  trainerId: string;
  mapId: string;
  element: string;
  color: number;
  virtue: string;
  memory: string;
  reward: ItemId;
}

export const TROPHIES: Trophy[] = [
  {
    id: 'sigil-grass',
    name: 'Verdant Trophy',
    keeper: 'Ivy',
    trainerId: 'trial-ivy',
    mapId: 'thistlebrook',
    element: 'grass',
    color: 0x4cd964,
    virtue: 'Growth',
    memory:
      'Ivy still tends the shoot Edda planted a week before the crack, and she has broken the Summit’s silence: seven keepers were called that night.',
    reward: 'nest-orb',
  },
  {
    id: 'sigil-electric',
    name: 'Storm Trophy',
    keeper: 'Volta',
    trainerId: 'trial-volta',
    mapId: 'voltspire-city',
    element: 'electric',
    color: 0xffd60a,
    virtue: 'Resilience',
    memory:
      'Volta’s logs show a timed pulse from the Summit at 11:58, and a stranger’s lantern pin on the breaker that saved her turbines. She has never trusted an easy current since.',
    reward: 'quick-orb',
  },
  {
    id: 'sigil-water',
    name: 'Tide Trophy',
    keeper: 'Marin',
    trainerId: 'trial-marin',
    mapId: 'tidehaven',
    element: 'water',
    color: 0x2ea8ff,
    virtue: 'Flow',
    memory:
      'Marin pulled a sobbing boy from the surf, and carried your mother’s journal ashore. She is learning to give back what the sea took, one truth at a time.',
    reward: 'tide-orb',
  },
  {
    id: 'sigil-fire',
    name: 'Ember Trophy',
    keeper: 'Blaze',
    trainerId: 'trial-blaze',
    mapId: 'ashfall-town',
    element: 'fire',
    color: 0xff6b35,
    virtue: 'Courage',
    memory:
      'Blaze forged the Summit ring and knew it was too thin. He broke his silence, and learned that no lone flame should be asked to hold six.',
    reward: 'ultra-prism',
  },
  {
    id: 'sigil-crystal',
    name: 'Facet Trophy',
    keeper: 'Opal',
    trainerId: 'trial-opal',
    mapId: 'geode-hollow',
    element: 'crystal',
    color: 0x7fffe5,
    virtue: 'Clarity',
    memory:
      'Opal’s crystals saw the Concord: six lights forced into one, and a fracture that was a fight, not a flood. She carved it though the Summit asked her not to.',
    reward: 'timer-orb',
  },
  {
    id: 'sigil-shadow',
    name: 'Twilight Trophy',
    keeper: 'Raven',
    trainerId: 'trial-raven',
    mapId: 'duskmoor-ruins',
    element: 'shadow',
    color: 0x8e5cff,
    virtue: 'Remembrance',
    memory:
      'Raven remembers the keeper who walked into the broken prism alone, and the cold Voss built around her out of love, and fear.',
    reward: 'dusk-orb',
  },
];

export interface Chapter {
  number: number;
  title: string;
  objective: string;
}

interface Milestone {
  title: string;
  objective: string;
  done: (state: GameState) => boolean;
}

const MILESTONES: Milestone[] = [
  {
    title: 'A Dark Lighthouse',
    objective:
      'Take Lumen’s journal and a partner, then follow your friend north through Route 1 into Whisperwood and drive Team Eclipse from the wood.',
    done: (state) => state.getFlag('eclipse-forest-cleared'),
  },
  {
    title: 'The Shoot That Stayed Green',
    objective:
      'Return to Thistlebrook and win the Verdant Trophy. Ivy knows why a green shoot grew before the crack.',
    done: (state) => state.getSigilCount() >= 1,
  },
  {
    title: 'Drained',
    objective:
      'Team Eclipse is draining Voltspire’s power plant for something at Duskmoor. Head east and break their hold.',
    done: (state) => state.getFlag('eclipse-plant-cleared'),
  },
  {
    title: 'The 11:58 Pulse',
    objective:
      'Challenge Volta for the Storm Trophy. Her logs may show what really triggered the crack.',
    done: (state) => state.getSigilCount() >= 2,
  },
  {
    title: 'What the Tide Returned',
    objective:
      'Sail to Tidehaven, read the bottle on the dock, and win the Tide Trophy from Captain Marin.',
    done: (state) => state.getSigilCount() >= 3,
  },
  {
    title: 'The Ring and the Lantern',
    objective:
      'Face Blaze in Ashfall Town for the Ember Trophy. Ask about the forge, and visit the Ancient Stone at Cinder Peak.',
    done: (state) => state.getSigilCount() >= 4,
  },
  {
    title: 'The Record Wall',
    objective:
      'Descend into Geode Hollow and win the Facet Trophy from Opal. Her crystals remember the night.',
    done: (state) => state.getSigilCount() >= 5,
  },
  {
    title: 'Lantern Verse',
    objective:
      'Brave the Duskmoor Ruins for the Twilight Trophy of Raven. She knows what Voss is holding.',
    done: (state) => state.getSigilCount() >= 6,
  },
  {
    title: 'Eclipse',
    objective:
      'Face Voss at the Duskmoor altar. Break the ritual without losing what he is protecting.',
    done: (state) => state.getFlag('eclipse-ritual-broken'),
  },
  {
    title: 'The Last Light',
    objective: 'Climb Prism Summit, defeat Aurelia, and place the six Trophies in the altar.',
    // The epilogue starts once Edda steps out of the prism, not at Aurelia's defeat.
    done: (state) => state.getFlag('edda-returned'),
  },
];

const EPILOGUE: Chapter = {
  number: MILESTONES.length + 1,
  title: 'Still Tending It',
  objective:
    'The beacons burn again. Walk the isles with your mother, and find the legends the light woke.',
};

export function getChapter(state: GameState): Chapter {
  if (state.getFlag('edda-returned')) return { ...EPILOGUE };
  for (let i = 0; i < MILESTONES.length; i++) {
    if (!MILESTONES[i].done(state)) {
      return { number: i + 1, title: MILESTONES[i].title, objective: MILESTONES[i].objective };
    }
  }
  return { ...EPILOGUE };
}

export function trialLockedReason(state: GameState, trainerId: string): string | null {
  switch (trainerId) {
    case 'trial-ivy':
      if (!state.getFlag('eclipse-forest-cleared')) {
        return 'Whisperwood Forest must be cleared of Team Eclipse before Ivy will test you.';
      }
      return null;
    case 'trial-volta':
      if (!state.hasSigil('sigil-grass')) {
        return 'You must earn the Verdant Trophy before Volta will test you.';
      }
      if (!state.getFlag('eclipse-plant-cleared')) {
        return 'The Voltspire plant must be secured before Volta will test you.';
      }
      return null;
    case 'trial-marin':
      if (!state.hasSigil('sigil-electric')) {
        return 'You must earn the Storm Trophy before Marin will test you.';
      }
      return null;
    case 'trial-blaze':
      if (!state.hasSigil('sigil-water')) {
        return 'You must earn the Tide Trophy before Blaze will test you.';
      }
      return null;
    case 'trial-opal':
      if (!state.hasSigil('sigil-fire')) {
        return 'You must earn the Ember Trophy before Opal will test you.';
      }
      return null;
    case 'trial-raven':
      if (!state.hasSigil('sigil-crystal')) {
        return 'You must earn the Facet Trophy before Raven will test you.';
      }
      return null;
    case 'champion-aurelia':
      if (state.getSigilCount() < 6) {
        return 'All six Trophies are required before the Champion will face you.';
      }
      if (!state.getFlag('eclipse-ritual-broken')) {
        return 'The Eclipse ritual at Duskmoor must be stopped before the summit.';
      }
      return null;
    default:
      return null;
  }
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  location: string;
  rewardLabel: string;
}

export const QUESTS: Quest[] = [
  {
    id: 'first-catch',
    title: 'First Friends',
    description: 'Catch your first wild species. Your starter counts toward two species.',
    location: 'Any route',
    rewardLabel: '5 Prism Orbs',
  },
  {
    id: 'explorer',
    title: 'Well-Travelled',
    description: 'Walk 100 steps across Prismara.',
    location: 'Anywhere',
    rewardLabel: '1,000 money',
  },
  {
    id: 'collector',
    title: 'Growing Collection',
    description: 'Catch five different creatures.',
    location: 'Anywhere',
    rewardLabel: '2 Great Prisms',
  },
  {
    id: 'rescue',
    title: 'Forest Rescue',
    description: 'Free Whisperwood Forest from Team Eclipse.',
    location: 'Whisperwood Forest',
    rewardLabel: '2 Super Potions',
  },
  {
    id: 'scholar',
    title: 'Field Scholar',
    description: 'See twelve different creatures.',
    location: 'Anywhere',
    rewardLabel: '2,000 money',
  },
];

interface QuestDef {
  quest: Quest;
  check: (state: GameState) => boolean;
  grant: (state: GameState) => void;
}

const QUEST_DEFS: Record<string, QuestDef> = {
  'first-catch': {
    quest: QUESTS[0],
    check: (state) => state.caughtCount() >= 2,
    grant: (state) => state.addItem('prism-orb', 5),
  },
  explorer: {
    quest: QUESTS[1],
    check: (state) => state.steps >= 100,
    grant: (state) => state.addMoney(1000),
  },
  collector: {
    quest: QUESTS[2],
    check: (state) => state.caughtCount() >= 5,
    grant: (state) => state.addItem('great-prism', 2),
  },
  rescue: {
    quest: QUESTS[3],
    check: (state) => state.getFlag('eclipse-forest-cleared'),
    grant: (state) => state.addItem('super-potion', 2),
  },
  scholar: {
    quest: QUESTS[4],
    check: (state) => state.seenCount() >= 12,
    grant: (state) => state.addMoney(2000),
  },
};

export function questStatus(state: GameState, quest: Quest): 'active' | 'ready' | 'claimed' {
  if (state.getFlag(`quest-${quest.id}-claimed`)) return 'claimed';
  const def = QUEST_DEFS[quest.id];
  return def && def.check(state) ? 'ready' : 'active';
}

export function claimQuest(state: GameState, id: string): string[] {
  const def = QUEST_DEFS[id];
  if (!def) return [];
  if (state.getFlag(`quest-${id}-claimed`)) return [];
  if (!def.check(state)) return [];
  state.setFlag(`quest-${id}-claimed`);
  def.grant(state);
  return [`Quest complete: ${def.quest.title}`, `You received ${def.quest.rewardLabel}.`];
}
