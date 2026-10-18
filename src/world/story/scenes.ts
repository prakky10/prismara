/**
 * The story script as data: 40 once-only scenes plus a handful of repeatable
 * NPC variants. See docs/STORY.md for the full script.
 *
 * A scene fires from one trigger (map entry, NPC talk or after a trainer
 * battle) while its `requires` flags are set and its `forbids` flags are not.
 * Once-only scenes record `scene-<id>` when they play. Lines use `{player}` and
 * `{rival}` placeholders and an optional "Speaker: text" prefix (see dialogue.ts).
 */

import type { ItemId } from '../../data/items';

export type SceneTrigger =
  | { kind: 'entry'; mapId: string }
  | { kind: 'talk'; mapId: string; npcId: string }
  | { kind: 'after'; trainerId: string };

export interface StoryScene {
  id: string;
  trigger: SceneTrigger | SceneTrigger[];
  /** Flags that must all be set. */
  requires?: string[];
  /** Flags that must all be clear. */
  forbids?: string[];
  /** Plot flags set when the scene plays (besides `scene-<id>`). */
  sets?: string[];
  lines: string[];
  /** Repeatable NPC variant: never marked done. */
  repeat?: boolean;
  /** On a talk trigger, keeps playing straight after the scene before it. */
  chain?: boolean;
  /** One-time item reward, skipped when `unlessFlag` is already set. */
  reward?: { item: ItemId; count: number; unlessFlag?: string; message: string };
}

const entry = (mapId: string): SceneTrigger => ({ kind: 'entry', mapId });
const talk = (mapId: string, npcId: string): SceneTrigger => ({ kind: 'talk', mapId, npcId });
const after = (trainerId: string): SceneTrigger => ({ kind: 'after', trainerId });

export const SCENES: StoryScene[] = [
  /* ---------------------------------------------------------------- Prologue -- */
  {
    id: 'p-town-dawn',
    trigger: entry('emberleaf-town'),
    forbids: ['edda-returned'],
    lines: [
      `The lighthouse on the headland stands dark. It has not turned in a year.`,
      `Aunt Wren waves from the square. She has been waiting for you.`,
    ],
  },
  {
    id: 'p-aunt-wren',
    trigger: talk('emberleaf-town', 'aunt-wren'),
    forbids: ['has-journal'],
    lines: [
      `Aunt Wren: There you are, {player}. I brought bread, in case you forgot to eat.`,
      `Aunt Wren: A year of dark. I still check the headland every night.`,
      `Aunt Wren: Professor Lumen sent word. He has your mother's journal.`,
      `Aunt Wren: Go on. Before you lose your nerve, and before I lose mine.`,
    ],
  },
  {
    id: 'p-lab-arrival',
    trigger: entry('lumen-lab'),
    forbids: ['has-journal'],
    lines: [
      `Shelves of prism glass hum softly. A cracked lens sits under a green lamp.`,
      `Prof. Lumen: Ah. Edda's child. Come in, mind the cables.`,
      `{rival}: Professor, any word? About Soren? Anything at all?`,
      `Prof. Lumen: Nothing new, I am sorry. Eclipse sends no letters.`,
      `{rival}: Then I will ask them myself. I already have my partner.`,
      `{rival}: Don't peek at which one, {player}.`,
    ],
  },
  {
    id: 'p-lumen-offer',
    trigger: talk('lumen-lab', 'professor-lumen'),
    forbids: ['has-journal'],
    lines: [
      `Prof. Lumen: The sky prism fed six beacons, one for each element.`,
      `Prof. Lumen: Last winter it cracked, and your mother vanished with its light.`,
      `Prof. Lumen: Captain Marin found her journal on the tide. I have kept it safe.`,
      `Prof. Lumen: The road is not safe. It is good that you have a partner.`,
    ],
  },
  {
    id: 'p-lumen-journal',
    trigger: talk('lumen-lab', 'professor-lumen'),
    forbids: ['has-journal'],
    sets: ['has-journal'],
    chain: true,
    lines: [
      `Prof. Lumen: Your partner looks eager. Now, her journal. It is yours.`,
      `Prof. Lumen: I have read it twice. I have kept it safe. That is all I have done.`,
      `You receive Edda's Journal.`,
      `Page 1 is mostly blank. A line reads: "Six beacons. One keeper. Not enough hands."`,
      `Prof. Lumen: {rival} left at dawn. He went north, very fast.`,
    ],
  },
  {
    id: 'p-rival-1-after',
    trigger: after('rival-1'),
    requires: ['rival-1-defeated'],
    lines: [
      `{rival}: Not fair. I trained every day since he left.`,
      `{rival}: My brother Soren worked the lighthouse shutters for your mom.`,
      `{rival}: He knows these isles. He said the dark would keep me safe.`,
      `{rival}: He is wrong, and I will tell him so. Whisperwood is next.`,
    ],
  },

  /* --------------------------------------------------------------- Chapter 1 -- */
  {
    id: 'c1-forest-entry',
    trigger: entry('whisperwood-forest'),
    requires: ['rival-1-defeated'],
    lines: [
      `The leaves have gone grey. Nothing sings here.`,
      `{rival} (ahead on the path): Last spring this wood was loud with birds.`,
    ],
  },
  {
    id: 'c1-grunt-after',
    trigger: after('eclipse-grunt-1'),
    requires: ['eclipse-forest-cleared'],
    sets: ['voss-spares-player-known'],
    lines: [
      `Eclipse Grunt: I lost my sister to the fracture. Voss says twilight keeps what is left.`,
      `Eclipse Grunt: His orders: slow Edda's child. Never hurt her.`,
      `Eclipse Grunt: I don't know why. He goes quiet whenever he says her name.`,
    ],
  },
  {
    id: 'c1-soren-forest',
    trigger: talk('whisperwood-forest', 'soren-forest'),
    requires: ['eclipse-forest-cleared'],
    forbids: ['soren-sighted'],
    sets: ['soren-sighted', 'forest-note-found'],
    lines: [
      `A hooded boy waits on the path, a small brass lantern at his belt.`,
      `{rival} (running up): Soren! It's me. Look at me!`,
      `Soren: You should not be here, {rival}.`,
      `{rival}: Not without you.`,
      `Soren: Then walk with her child, not me.`,
      `Soren: You have her eyes. Be careful what you promise the beacons.`,
      `The boy slips into the trees. {rival} stares after him, silent.`,
      `Under the roots lies a damp, folded note. The ink looks like your mother's hand.`,
      `"The beacons wait for someone who unites them, never for someone who freezes them."`,
      `A tiny lantern is drawn in the corner. You fold it into the journal.`,
      `{rival}: He didn't even say goodbye. Come on. Thistlebrook.`,
    ],
  },

  /* --------------------------------------------------------------- Chapter 2 -- */
  {
    id: 'c2-thistle-entry',
    trigger: entry('thistlebrook'),
    requires: ['eclipse-forest-cleared'],
    lines: [
      `A great thorn tree holds the town in its roots.`,
      `One green shoot climbs its grey bark. It is the only green for a mile.`,
    ],
  },
  {
    id: 'c2-ivy-after',
    trigger: after('trial-ivy'),
    requires: ['trial-1-cleared'],
    sets: ['journal-page-1', 'summons-known', 'edda-seed-known'],
    lines: [
      `Ivy: That green shoot? Your mother planted it. A week before the crack.`,
      `Ivy: She told me, "Something is coming that I cannot stop."`,
      `Ivy: That week, all seven keepers got a summons. Midnight. Prism Summit.`,
      `Ivy: No reason given. I stayed home. She went.`,
      `Ivy: Next day the Summit sent word: say nothing of that night.`,
      `Ivy: I obeyed for a year. I am done obeying.`,
      `Journal page 1 fills in: "Seven called. I will go. I will not be quiet."`,
    ],
  },
  {
    id: 'c2-rival-2-after',
    trigger: after('rival-2'),
    requires: ['rival-2-defeated'],
    sets: ['soren-pin-known'],
    lines: [
      `{rival}: You beat Ivy and me. I'm not jealous. Much.`,
      `{rival}: Soren left this on my pillow before he went. A brass lantern pin.`,
      `{rival}: Every apprentice at your mom's lighthouse wears one.`,
      `{rival}: If he's Eclipse, why keep it? Why leave it for me?`,
      `{rival}: Voltspire is next. Soren always liked places with lights.`,
    ],
  },

  /* --------------------------------------------------------------- Chapter 3 -- */
  {
    id: 'c3-voltspire-entry',
    trigger: entry('voltspire-city'),
    requires: ['trial-1-cleared'],
    forbids: ['trial-2-cleared'],
    lines: [
      `Half the streetlamps are dark. Cables snake into the plant like roots.`,
      `Voltspire Tech (voice): Eclipse crews drain us every night. Where does it go?`,
      `Eclipse radio (static): Draw it all to the altar. Keep the glass warm until dawn.`,
    ],
  },
  {
    id: 'c3-grunt2-after',
    trigger: after('eclipse-grunt-2'),
    requires: ['eclipse-plant-cleared'],
    sets: ['altar-feed-known'],
    lines: [
      `Eclipse Grunt: We drain the grid for the altar. If it fails, the glass goes cold.`,
      `Eclipse Grunt: Voss sits up there every night. He talks to the glass like it hears.`,
      `Eclipse Grunt: He told us to leave you whole. So... I am glad you won.`,
    ],
  },
  {
    id: 'c3-soren-plant',
    trigger: talk('voltspire-city', 'soren-plant'),
    requires: ['eclipse-plant-cleared'],
    forbids: ['trial-2-cleared'],
    sets: ['soren-met-plant'],
    lines: [
      `Behind the control-room door, a hooded boy is tightening a breaker. He freezes.`,
      `Soren: You are quick. Good.`,
      `Soren: Tell {rival} to stop chasing me. Please. I cannot be what he wants.`,
      `Soren: Take the plant back. Volta has been holding it with one hand.`,
      `He hops the railing and is gone. The breaker he touched hangs half open.`,
    ],
  },

  /* --------------------------------------------------------------- Chapter 4 -- */
  {
    id: 'c4-volta-after',
    trigger: after('trial-volta'),
    requires: ['trial-2-cleared'],
    sets: ['journal-page-2', 'pulse-known', 'soren-sabotage-known'],
    lines: [
      `Volta: Look at the plant log. See that spike at 11:58?`,
      `Volta: A timed pulse, sent down every line. From the Summit.`,
      `Volta: Six beacon cities got the same order: "Full power at midnight."`,
      `Volta: We all obeyed. Then the sky broke.`,
      `Volta: Last week a breaker was left half open. It saved my turbines.`,
      `Volta: A boy with a brass pin did it. Eclipse, but he helped me. It doesn't add up.`,
      `Volta: I never trusted an easy current. Keep your eyes open, keeper.`,
      `Page 2: "They want one flame no keeper can drop. A shared light cannot be forced."`,
    ],
  },
  {
    id: 'c4-summit-broadcast',
    trigger: entry('voltspire-city'),
    requires: ['trial-2-cleared'],
    sets: ['aurelia-heard'],
    lines: [
      `A clear, warm voice crackles over the city speakers.`,
      `Aurelia (radio): People of Prismara, the Summit is listening. The Champion's door is open.`,
      `Aurelia (radio): Keep to your homes after dark. The beacons will be restored.`,
      `Aurelia (radio): Trust the Keepers. We will make this right.`,
      `Voltspire Tech: She talks like she's guarding something instead of fixing it.`,
    ],
  },

  /* --------------------------------------------------------------- Chapter 5 -- */
  {
    id: 'c5-kai-dock',
    trigger: talk('tidehaven', 'kai-dock'),
    requires: ['trial-2-cleared'],
    forbids: ['trial-3-cleared'],
    sets: ['soren-letter-known'],
    lines: [
      `{rival} sits on a crate by the dock, turning a green glass bottle in his hands.`,
      `{rival}: It washed up this morning. My name, in Soren's handwriting.`,
      `{rival}: "I cannot come home. The lamp that night was mine to light. I am sorry."`,
      `{rival}: What lamp? What did he do, {player}?`,
      `{rival}: Marin was at sea that night. Ask her. I'll catch up.`,
    ],
  },
  {
    id: 'c5-marin-after',
    trigger: after('trial-marin'),
    requires: ['trial-3-cleared'],
    sets: ['journal-page-3', 'soren-lever-known', 'lumen-pale-known'],
    lines: [
      `Marin: That week I ferried six crates of beacon-glass to the Summit. Nobody said why.`,
      `Marin: At dawn after the crack I pulled a boy from the surf.`,
      `Marin: He kept saying, "I pulled the lever. I opened the shutters."`,
      `Marin: A tall man in dusk-grey waited on the shore. I thought he was a friend.`,
      `Marin: I found your mother's journal in the same tide. I took it to Lumen.`,
      `Marin: He went white as foam. Never asked where I found it.`,
      `Marin: The sea gives back what it takes, keeper. Slowly.`,
      `Page 3: "Soren is a good boy. If tonight goes wrong, none of it is his fault."`,
    ],
  },
  {
    id: 'c5-rival-3-after',
    trigger: after('rival-3'),
    requires: ['rival-3-defeated'],
    sets: ['rival-softened'],
    lines: [
      `{rival}: You win again. I'm done being angry about that.`,
      `{rival}: He pulled a lever. That's all we know. He's not a villain.`,
      `{rival}: I thought I'd drag him home. Maybe I'm meant to hear him first.`,
      `{rival}: Ashfall next, partner. Light the dark for me.`,
    ],
  },

  /* --------------------------------------------------------------- Chapter 6 -- */
  {
    id: 'c6-ashfall-entry',
    trigger: entry('ashfall-town'),
    requires: ['trial-3-cleared'],
    lines: [
      `Ash drifts like grey snow. The great forge in the square glows weakly.`,
      `Every hearth here is lit by hand. No flame holds on its own anymore.`,
    ],
  },
  {
    id: 'c6-blaze-after',
    trigger: after('trial-blaze'),
    requires: ['trial-4-cleared'],
    sets: ['journal-page-4', 'ring-known', 'cold-lantern-known'],
    lines: [
      `Blaze: Courage. I owe you the real kind. I forged the ring.`,
      `Blaze: A brass ring for the Summit, thick as my arm.`,
      `Blaze: It was too thin for six flames. I said so once. Quietly.`,
      `Blaze: Then I kept quiet. That silence is my shame.`,
      `Blaze: Two months after the crack, a tall man came. He ordered a lantern of cold iron.`,
      `Blaze: He paid double and cried a little. I never asked why.`,
      `Blaze: Ask now, keeper. Someone should.`,
      `Page 4: "The ring is too small. 'It only has to hold once,' she said."`,
    ],
  },
  {
    id: 'c6-pilgrim',
    trigger: talk('cinder-peak', 'pilgrim-cinder'),
    requires: ['trial-3-cleared'],
    forbids: ['aurelia-confessed'],
    sets: ['pilgrim-met'],
    lines: [
      `A pilgrim in a pale veil is lighting a single candle at the Ancient Stone.`,
      `Pilgrim: I come each year. The stone says the sun wakes at noon.`,
      `Pilgrim: I only wish I could wake things that sleep.`,
      `Pilgrim: You carry a keeper's journal. May I ask... is your mother well?`,
      `Pilgrim: No. Forgive me. That is not a question for a child.`,
      `Pilgrim: If you ever find her, tell her the lamp was never hers to hold alone.`,
      `The veil trembles. She leaves before you can ask her name.`,
    ],
  },

  /* --------------------------------------------------------------- Chapter 7 -- */
  {
    id: 'c7-opal-after',
    trigger: after('trial-opal'),
    requires: ['trial-5-cleared'],
    sets: ['journal-page-5', 'concord-known', 'aurelia-ordered-known'],
    lines: [
      `Opal: Clarity is not always kind. Come. The Record Wall is yours to see.`,
      `Opal presses a gem. The crystal fills with a silent memory of that night.`,
      `Seven keepers stand around the prism. Light climbs a brass ring.`,
      `A tall woman in gold stands apart and raises a lamp. It is Aurelia, the Champion.`,
      `Opal: She signalled the lighthouse. A boy pulled the shutter. Six lights poured into one.`,
      `Opal: That was the Concord. A rite to bind six lights into one flame.`,
      `The elements flare, then turn on each other. The prism cracks like ice.`,
      `Opal: They fought because they were forced to share. A fight, not a flood.`,
      `A woman with a lantern steps into the cracks, into the light. The wall goes white.`,
      `Opal: Your mother stayed. Or was kept. The crystal does not say.`,
      `Opal: The Summit told us to bury this. I carved it instead.`,
      `Page 5: "If the isles must be saved from our pride, I will stand between."`,
    ],
  },
  {
    id: 'c7-lumen-geode',
    trigger: talk('geode-hollow', 'lumen-geode'),
    requires: ['trial-5-cleared'],
    forbids: ['lumen-confessed'],
    sets: ['lumen-confessed', 'journal-page-6', 'six-share-known'],
    lines: [
      `Prof. Lumen sits on the steps, ink on his sleeves, not meeting your eyes.`,
      `Prof. Lumen: I heard you saw the Record. Then you know what I am.`,
      `Prof. Lumen: I wrote the Concord's numbers. Aurelia asked me, and I liked being asked.`,
      `Prof. Lumen: Your mother read them and said they would fail.`,
      `Prof. Lumen: I told her I was nearly sure. Nearly. I have lived on that word.`,
      `Prof. Lumen: I kept the last pages of her journal. I could not bear to read them aloud.`,
      `He hands you a damp bundle, tied with a lantern-shaped string.`,
      `Page 6: "If six lights ever share freely, the prism will hold itself. Then I may let go."`,
      `Prof. Lumen: Go, {player}. Finish it. And I am sorry.`,
    ],
  },
  {
    id: 'c7-nerys-after',
    trigger: after('ace-nerys'),
    lines: [
      `Nerys: I trained under Aurelia once. She stopped teaching a year ago.`,
      `Nerys: Now she stands on the Summit like she is guarding a grave.`,
      `Nerys: Go see. Then tell me I'm wrong.`,
    ],
  },
  {
    id: 'c7-rival-4-after',
    trigger: after('rival-4'),
    requires: ['rival-4-defeated'],
    lines: [
      `{rival}: Don't say it. I know I lost.`,
      `{rival}: You told me what the Record showed. Soren followed a signal.`,
      `{rival}: He still thinks it was his fault. That's why he stays with Voss.`,
      `{rival}: I'm done fighting him. I'll say sorry for being loud about it.`,
      `{rival}: He's at the altar. Meet me there.`,
    ],
  },

  /* --------------------------------------------------------------- Chapter 8 -- */
  {
    id: 'c8-duskmoor-entry',
    trigger: entry('duskmoor-ruins'),
    requires: ['trial-5-cleared'],
    forbids: ['trial-6-cleared'],
    sets: ['voss-met'],
    lines: [
      `The altar hums like a held breath. The night here is almost kind.`,
      `Voss (face in shadow): You walked all this way. I told them not to stop you.`,
      `Voss: Finish Raven's trial. Then come to me. I would rather you heard it from me.`,
      `Beside him, a hooded boy keeps a lantern raised. He will not look at you.`,
      `Voss and the boy melt into the dark.`,
    ],
  },
  {
    id: 'c8-raven-after',
    trigger: after('trial-raven'),
    requires: ['trial-6-cleared'],
    sets: ['journal-page-7', 'voss-truth-known', 'edda-in-prism-known'],
    lines: [
      `Raven: I write poems no one reads. This one is for you. It is about a lantern.`,
      `Raven: Voss was the Twilight Keeper before me. He taught me the dark can be gentle.`,
      `Raven: When the prism cracked, he saw your mother walk into the heart of it.`,
      `Raven: She held the break shut with her own light. He ran for her. Too late.`,
      `Raven: He built this altar with a cold-iron lantern. The twilight cradles her.`,
      `Raven: As long as it holds, she cannot fade. He is not holding the world.`,
      `Raven: He is holding her.`,
      `Raven: But the cold costs the isles every night. If it finishes at midnight, she is frozen forever.`,
      `Raven: Six beacons can hold her instead. That is what your Trophies are for.`,
      `Page 7: "Voss will try to keep me. Tell him I would rather be missed than kept."`,
    ],
  },

  /* --------------------------------------------------------------- Chapter 9 -- */
  {
    id: 'c9-voss-before',
    trigger: talk('duskmoor-ruins', 'eclipse-admin-voss'),
    requires: ['trial-6-cleared'],
    forbids: ['eclipse-ritual-broken'],
    lines: [
      `Voss: Raven told you. Good. I did not want to lie to Edda's child.`,
      `Voss: I held her hand as the light took her. Then it let go, and I held nothing.`,
      `Voss: Every night I keep the cold around her. Every night the isles pay.`,
      `Voss: You will tell me the beacons can hold her. I want to believe you.`,
      `{rival} (running in): Soren! Please. Just look at me!`,
      `Soren: Stay back, {rival}. If I put this lantern down, the cold goes with it.`,
      `Soren: I pulled the lever. She went into the light. I cannot lose her twice.`,
      `Voss: Enough, boy. This is mine to carry.`,
      `Voss: If I am wrong, she is gone. If you are wrong, she is gone. So prove me wrong.`,
    ],
  },
  {
    id: 'c9-voss-after',
    trigger: after('eclipse-admin-voss'),
    requires: ['eclipse-ritual-broken'],
    sets: ['voss-surrendered'],
    lines: [
      `The cold lantern flickers. The altar's hum drops to a whisper.`,
      `Voss: Six virtues, and not one of them broke. Neither did she.`,
      `Voss: I stopped living the night she walked into the light. I was so afraid.`,
      `Voss: Aurelia holds the Lens that opens the last stair. Go to her.`,
      `Voss: Take my lantern. When she steps out, someone must carry it for her.`,
      `The twilight loosens around the altar. Around the ruins, grunts lower their hoods.`,
    ],
  },
  {
    id: 'c9-soren-confession',
    trigger: [after('eclipse-admin-voss'), talk('duskmoor-ruins', 'soren-duskmoor')],
    requires: ['eclipse-ritual-broken'],
    forbids: ['soren-stood-down'],
    sets: ['soren-stood-down'],
    lines: [
      `Soren sets his lantern on the altar steps. His hands are shaking.`,
      `Soren: {rival}. I opened the shutter. I put out the light.`,
      `{rival}: You were seventeen. Someone older gave you the signal.`,
      `Soren: I left the note in the forest. I copied her handwriting so you would follow it.`,
      `Soren: The half-open breaker, too. I tried to help without being caught.`,
      `Soren: It was so little. I'm sorry.`,
      `{rival}: You're my brother. That's all. Come home when you're ready.`,
      `Soren: Not yet. I'll stand with {player} at the Summit. Then I'll come home.`,
    ],
  },

  /* ------------------------------------------------------------------ Finale -- */
  {
    id: 'f-summit-entry',
    trigger: entry('prism-summit'),
    requires: ['eclipse-ritual-broken'],
    forbids: ['champion-defeated'],
    lines: [
      `Snow falls upward here, toward a ring of six empty sockets.`,
      `Aurelia stands before the altar, her back to you, lamp in hand.`,
      `Aurelia: I wondered which of them would reach me. I hoped it would be you.`,
      `Aurelia: Before we battle, you should know who ordered the Concord.`,
      `Aurelia: It was me. Now show me you can carry that, without breaking.`,
    ],
  },
  {
    id: 'f-aurelia-after',
    trigger: after('champion-aurelia'),
    requires: ['champion-defeated'],
    sets: ['aurelia-confessed'],
    lines: [
      `Aurelia: I was the Pilgrim at the Ancient Stone. I could not say my name to Edda's child.`,
      `Aurelia: Seven fragile keepers. One unbreakable flame. That was my whole plan.`,
      `Aurelia: Voss feared the same loss and chose stillness. I chose force.`,
      `Aurelia: Two halves of one mistake. I hid it to keep the isles calm.`,
      `Aurelia: Take the Lens. It opens the last stair. I give it freely.`,
      `She places a golden lens in your hands. The six Trophies hum in answer.`,
      `Aurelia: Place your Trophies in the altar. Let them share.`,
    ],
  },
  {
    id: 'f-sockets',
    trigger: talk('prism-summit', 'aetherion-altar'),
    requires: ['champion-defeated'],
    forbids: ['edda-returned'],
    sets: ['edda-returned', 'journal-complete', 'story-finale-seen'],
    reward: {
      item: 'master-prism',
      count: 1,
      unlessFlag: 'story-finale-seen',
      message: 'The last beacon burns again: a Master Prism is yours.',
    },
    lines: [
      `You press each Trophy into its socket. Leaf, spark, tide, flame, gem, dusk.`,
      `Six lights rise. For the first time they do not fight. They lean together.`,
      `The cracked prism hums. A figure steps out of the white, lantern in hand.`,
      `Edda: {player}. You've grown. That is entirely unfair.`,
      `Edda: Six lights, freely shared. I hoped someone would ask them nicely.`,
      `Edda: I felt every beacon you lit. I have been listening for you all year.`,
      `Voss (hood down, at the stair): Edda.`,
      `Edda: You kept me warm, you foolish man. Now let the sun do it.`,
      `Voss: I was so afraid.`,
      `Edda: I know. So was Aurelia. So was I. That is not a crime. Only a start.`,
      `Aurelia: I will answer for the Concord before every keeper.`,
      `Edda: You will answer beside me.`,
      `Soren: Edda, I opened the shutter. I am so sorry.`,
      `Edda: You trusted your keepers. The fault was theirs, and mine for not stopping them.`,
      `{rival} hugs his brother so hard the lantern pin pops loose.`,
    ],
  },
  {
    id: 'f-last-page',
    trigger: talk('prism-summit', 'aetherion-altar'),
    requires: ['edda-returned'],
    chain: true,
    lines: [
      `Edda opens the journal. The last page is blank.`,
      `She writes in a steady hand: "Still tending it. Still waiting."`,
      `Edda: Not waiting any more.`,
      `She writes beneath it: "And now we all tend it."`,
    ],
  },

  /* ---------------------------------------------------------------- Epilogue -- */
  {
    id: 'e-lighthouse-relit',
    trigger: entry('emberleaf-town'),
    requires: ['edda-returned'],
    lines: [
      `That night the lighthouse turns for the first time in a year.`,
      `The whole town cheers. A creature on every rooftop answers with a glow.`,
      `Aunt Wren: Now THAT is a light. I am going to cry. Nobody look.`,
    ],
  },
  {
    id: 'e-edda-home',
    trigger: talk('emberleaf-town', 'edda'),
    requires: ['edda-returned'],
    lines: [
      `Edda: I want to hear everything. After you've changed your socks.`,
      `Edda: Aunt Wren says I'm not allowed to hug you in wet ones.`,
      `Edda: Voss and Aurelia are teaching the Keepers' Council the whole truth.`,
      `Edda: The beacons need seven hands. Would you walk the rounds with me?`,
    ],
  },
  {
    id: 'e-kai-farewell',
    trigger: talk('emberleaf-town', 'kai-epilogue'),
    requires: ['edda-returned'],
    lines: [
      `{rival}: Soren is back at the lighthouse shutters. I check he's not sneaking out.`,
      `{rival}: I'm going to see the isles before the next dark. Properly this time.`,
      `{rival}: Want to battle on the way? I'm kidding. Mostly.`,
      `{rival}: Thanks for finding him. And her.`,
    ],
  },
  {
    id: 'e-lumen-archive',
    trigger: talk('lumen-lab', 'professor-lumen'),
    requires: ['edda-returned'],
    lines: [
      `Prof. Lumen: The lab is open to everyone now. The Concord's papers are on the wall.`,
      `Prof. Lumen: If a rite like that is ever tried again, someone will read this first.`,
      `Prof. Lumen: Edda says I may keep the green lamp. I think she is being kind.`,
    ],
  },

  /* ------------------------------------------- repeatable NPC state variants -- */
  {
    id: 'r-wren-waiting',
    trigger: talk('emberleaf-town', 'aunt-wren'),
    requires: ['has-journal'],
    forbids: ['edda-returned'],
    repeat: true,
    lines: [
      `Aunt Wren: Pack Potions. A good keeper checks the lamp before the road.`,
      `Aunt Wren: Come home when it's dark. Even brave people eat dinner.`,
    ],
  },
  {
    id: 'r-wren-home',
    trigger: talk('emberleaf-town', 'aunt-wren'),
    requires: ['edda-returned'],
    repeat: true,
    lines: [`Aunt Wren: She's home, and already bossing the lamp. I could cry.`],
  },
  {
    id: 'r-lumen-partner',
    trigger: talk('lumen-lab', 'professor-lumen'),
    requires: ['has-journal'],
    forbids: ['lumen-confessed', 'edda-returned'],
    repeat: true,
    lines: [`Prof. Lumen: Your partner looks eager. Check the journal now and then.`],
  },
  {
    id: 'r-lumen-braver',
    trigger: talk('lumen-lab', 'professor-lumen'),
    requires: ['lumen-confessed'],
    forbids: ['edda-returned'],
    repeat: true,
    lines: [`Prof. Lumen: I am trying to be braver than my math.`],
  },
  {
    id: 'r-lumen-archive',
    trigger: talk('lumen-lab', 'professor-lumen'),
    requires: ['edda-returned'],
    repeat: true,
    lines: [
      `Prof. Lumen: The lab is open to everyone now. The Concord's papers are on the wall.`,
    ],
  },
  {
    id: 'r-cinder-stone-lit',
    trigger: talk('cinder-peak', 'cinder-sign'),
    requires: ['aurelia-confessed'],
    repeat: true,
    lines: [
      `Carved here: "When the sun is highest, the golden one wakes." A candle burns beneath it.`,
      `Solarion can only be challenged at noon.`,
    ],
  },
  {
    id: 'r-altar-quiet',
    trigger: talk('duskmoor-ruins', 'duskmoor-altar'),
    requires: ['eclipse-ritual-broken'],
    repeat: true,
    lines: [
      `The altar is quiet. A faint voice from the dark seems to hum a lullaby.`,
      `At midnight, something old may answer.`,
    ],
  },
  {
    id: 'r-summit-altar-lit',
    trigger: talk('prism-summit', 'aetherion-altar'),
    requires: ['edda-returned'],
    repeat: true,
    lines: [
      `Six sockets, six Trophies, one steady light.`,
      `Something vast circles above the clouds, waiting for a gatherer of many friends.`,
    ],
  },
];

/** Every once-only (non-repeat) scene: the 40-scene script. */
export const STORY_SCENES: StoryScene[] = SCENES.filter((scene) => !scene.repeat);

export function triggersOf(scene: StoryScene): SceneTrigger[] {
  return Array.isArray(scene.trigger) ? scene.trigger : [scene.trigger];
}
