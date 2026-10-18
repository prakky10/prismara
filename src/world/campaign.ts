/**
 * Campaign architecture: the six Trials, side quests, map stories and the
 * finale that ties Prismara's fractured light back together.
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
      'Ivy remembers the night the prism cracked and the wood went grey by morning. One green shoot refused to break, and she has grown it ever since.',
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
      'Volta watched every turbine stall the night the light fell, then rewired the grid by hand so the city would not go dark. She has never trusted an easy current since.',
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
      'Marin was at sea when the fracture came; the waves dragged a whole shore under while she could only hold her helm. She has been learning to give back what the water took.',
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
      'Blaze’s forge went cold in a single breath, because the beacons’ fire had always shared one heart. He learned that no lone flame can warm an entire land.',
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
      'Opal’s crystals kept the record, and it shows the six elements turning on one another the moment they were asked to share. The fracture was a fight, not a flood.',
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
      'Raven writes of the beacon keeper who walked into the dark alone to relight the last flame, and of the cold that Voss mistook for mercy.',
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
    title: 'Emberleaf Beginnings',
    objective:
      'Head north along Route 1 into Whisperwood Forest and drive out Team Eclipse, then earn the Verdant Trophy from Ivy in Thistlebrook.',
    done: (state) => state.getFlag('eclipse-forest-cleared'),
  },
  {
    title: 'Verdant Trophy',
    objective: 'Return to Thistlebrook and win the Verdant Trophy from Ivy.',
    done: (state) => state.getSigilCount() >= 1,
  },
  {
    title: 'Power Struggle',
    objective:
      'Team Eclipse has seized the Voltspire City power plant — head east from Thistlebrook and break their hold.',
    done: (state) => state.getFlag('eclipse-plant-cleared'),
  },
  {
    title: 'Sparks of Hope',
    objective: 'Challenge Volta at the Voltspire City power plant for the Storm Trophy.',
    done: (state) => state.getSigilCount() >= 2,
  },
  {
    title: 'The Turning Tide',
    objective: 'Sail with Captain Marin in Tidehaven and claim the Tide Trophy.',
    done: (state) => state.getSigilCount() >= 3,
  },
  {
    title: 'Ashes and Embers',
    objective: 'Face Blaze in Ashfall Town and earn the Ember Trophy.',
    done: (state) => state.getSigilCount() >= 4,
  },
  {
    title: 'Facets of Truth',
    objective: 'Descend into Geode Hollow and win the Facet Trophy from Opal.',
    done: (state) => state.getSigilCount() >= 5,
  },
  {
    title: 'The Long Twilight',
    objective: 'Brave the Duskmoor Ruins for the Twilight Trophy of Raven.',
    done: (state) => state.getSigilCount() >= 6,
  },
  {
    title: 'Eclipse',
    objective: 'Storm the Duskmoor altar and stop Voss before the ritual completes.',
    done: (state) => state.getFlag('eclipse-ritual-broken'),
  },
  {
    title: 'Prism Summit',
    objective: 'Climb Prism Summit and defeat Champion Aurelia.',
    done: (state) => state.getFlag('champion-defeated'),
  },
];

const EPILOGUE: Chapter = {
  number: MILESTONES.length + 1,
  title: 'The Last Light',
  objective: 'The beacons burn again across Prismara — walk the world you saved.',
};

export function getChapter(state: GameState): Chapter {
  if (state.getFlag('champion-defeated')) return { ...EPILOGUE };
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

const STORIES: Record<string, string[]> = {
  'emberleaf-town': [
    'Lumen: The prism cracked the night your mother vanished, keeper. Prismara has dimmed ever since.',
    'Kai: My brother walked off with Team Eclipse the same week. He says the dark keeps him safe.',
    'Lumen: Her damaged journal survived the fracture. Six beacon-keepers shared one light, and six Trophies still remember how to relight it.',
  ],
  'whisperwood-forest': [
    'Kai: Eclipse grunts hold this wood now. My brother marched in beside them.',
    'A half-buried keeper’s note: The beacons wait for someone who unites them, never for someone who freezes them.',
    'The ink looks like your mother’s hand. You fold the scrap into her journal.',
  ],
  'voltspire-city': [
    'Volta: The turbines stuttered when the prism broke, and Eclipse is draining what is left.',
    'Eclipse radio, thin with static: Voss tells his grunts to freeze the twilight. “Nothing here will ever break again.”',
    'Your mother’s journal, smudged: Six Trophies, one for each virtue. Together they remember the beacon.',
  ],
  tidehaven: [
    'Marin: The sea remembers the fracture. It swallowed a whole shore that night and kept the names.',
    'Kai: My brother swears Eclipse will spare us. I do not believe him any more.',
    'Your mother’s journal: Flow, not force. Water gave back what it took, and so must we.',
  ],
  'ashfall-town': [
    'Blaze: The forge went cold when the beacons died. We keep the embers lit by hand down here.',
    'Eclipse radio, through the smoke: Voss calls light a wound. “Courage only ever hurts the ones we love.”',
    'Your mother’s journal: Courage chooses repair over ruin, every time. She wrote that twice.',
  ],
  'geode-hollow': [
    'Opal: The crystals recorded it. The fracture was no accident — the elements turned on each other.',
    'Your mother’s journal, one page torn: Cooperation, not force, restores the beacons.',
    'Kai: I am going to find my brother in Duskmoor. Promise me you will finish what she started.',
  ],
  'duskmoor-ruins': [
    'Voss: I was a keeper too. I froze the twilight so nothing could break again.',
    'Kai: My brother is here, holding the altar. Let me reach him, please.',
    'Your mother’s journal, in her hand: Remembrance is not the same as living in the dark.',
  ],
  'prism-summit': [
    'Aurelia: You united six virtues. Now show me a heart that will not shatter under the last light.',
    'Voss: I see it now. The twilight was never the danger — isolation was.',
    'Lumen: Her journal stops mid-sentence — “still tending it, still waiting.” Climb, keeper.',
  ],
};

export function storyForMap(state: GameState, mapId: string): string[] | null {
  const pages = STORIES[mapId];
  if (!pages) return null;
  const flag = `story-${mapId}-seen`;
  if (state.getFlag(flag)) return null;
  state.setFlag(flag);
  return pages;
}

export function finaleLines(state: GameState): string[] {
  if (!state.getFlag('champion-defeated')) return [];
  return [
    'Above Prism Summit the last beacon kindles, and your mother is there, tending its flame at last.',
    'Kai: My brother came home. He set down the altar and walked into the light beside me.',
    'Voss: Let me mend what I froze. A broken world is better repaired together than preserved alone.',
    'Aurelia: You did not merely defeat me. You united what was scattered. Prismara is yours to keep bright.',
  ];
}
