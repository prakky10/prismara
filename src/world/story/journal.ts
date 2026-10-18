/**
 * Edda's journal and the "what we know" recap, derived from story flags.
 *
 * This is the data for a Journal screen (STORY.md section 9, item 13) and the
 * place the recorded lore flags are read. It also holds the tolerant migration
 * that lets saves made before the story rewrite keep playing.
 */

import type { GameState } from '../../core/GameState';

export const JOURNAL_PAGES: ReadonlyArray<{ flag: string; text: string }> = [
  { flag: 'journal-page-1', text: 'Seven called. I will go. I will not be quiet.' },
  {
    flag: 'journal-page-2',
    text: 'They want one flame no keeper can drop. A shared light cannot be forced.',
  },
  {
    flag: 'journal-page-3',
    text: 'Soren is a good boy. If tonight goes wrong, none of it is his fault.',
  },
  { flag: 'journal-page-4', text: "The ring is too small. 'It only has to hold once,' she said." },
  { flag: 'journal-page-5', text: 'If the isles must be saved from our pride, I will stand between.' },
  {
    flag: 'journal-page-6',
    text: 'If six lights ever share freely, the prism will hold itself. Then I may let go.',
  },
  { flag: 'journal-page-7', text: 'Voss will try to keep me. Tell him I would rather be missed than kept.' },
  {
    flag: 'journal-complete',
    text: 'Still tending it. Still waiting. Not waiting any more. And now we all tend it.',
  },
];

/** Plot-state flags the scenes record, each with the one-line fact it stands for. */
export const LORE: ReadonlyArray<{ flag: string; fact: string }> = [
  { flag: 'voss-spares-player-known', fact: 'Voss ordered his grunts never to hurt Edda’s child.' },
  { flag: 'forest-note-found', fact: 'A note in Edda’s hand, with a tiny lantern, waited in Whisperwood.' },
  { flag: 'summons-known', fact: 'Seven keepers were summoned to Prism Summit at midnight.' },
  { flag: 'edda-seed-known', fact: 'Edda planted a green shoot in Thistlebrook a week before the crack.' },
  { flag: 'soren-pin-known', fact: 'Soren left his brass lantern pin on his brother’s pillow.' },
  { flag: 'altar-feed-known', fact: 'Eclipse drains the power grid to feed the Duskmoor altar.' },
  { flag: 'soren-met-plant', fact: 'Soren was seen at the Voltspire plant, tightening a breaker.' },
  { flag: 'pulse-known', fact: 'A timed pulse left the Summit at 11:58 pm.' },
  { flag: 'soren-sabotage-known', fact: 'A boy with a brass pin left a breaker half open and saved the turbines.' },
  { flag: 'aurelia-heard', fact: 'The Champion asks everyone to keep to their homes after dark.' },
  { flag: 'soren-letter-known', fact: 'Soren wrote that the lamp that night was his to light.' },
  { flag: 'soren-lever-known', fact: 'Soren pulled the shutter lever, then was pulled from the surf.' },
  { flag: 'lumen-pale-known', fact: 'Lumen went white when he was handed the journal.' },
  { flag: 'rival-softened', fact: 'Your companion would rather hear Soren out than drag him home.' },
  { flag: 'ring-known', fact: 'Blaze forged the Summit ring and knew it was too thin.' },
  { flag: 'cold-lantern-known', fact: 'A tall man ordered a cold-iron lantern and wept.' },
  { flag: 'pilgrim-met', fact: 'A veiled pilgrim lights a candle at the Ancient Stone each year.' },
  { flag: 'concord-known', fact: 'The fracture was the Concord: six lights forced into one flame.' },
  { flag: 'aurelia-ordered-known', fact: 'Aurelia signalled the lighthouse, then ordered silence.' },
  { flag: 'six-share-known', fact: 'If six lights share freely, the prism can hold itself.' },
  { flag: 'voss-met', fact: 'Voss waits at the Duskmoor altar and wants you to hear it from him.' },
  { flag: 'voss-truth-known', fact: 'Voss’s twilight is a cradle, not a weapon.' },
  { flag: 'edda-in-prism-known', fact: 'Edda is alive inside the prism, held from fading by Voss.' },
];

/** Journal pages the player has uncovered, in order. */
export function journalEntries(state: GameState): string[] {
  return JOURNAL_PAGES.filter((page) => state.getFlag(page.flag)).map((page) => page.text);
}

/** The facts the player has learned so far, in story order. */
export function knownLore(state: GameState): string[] {
  return LORE.filter((entry) => state.getFlag(entry.flag)).map((entry) => entry.fact);
}

/**
 * Saves from before the story rewrite never recorded `has-journal`. Anyone who
 * has already left Emberleaf is treated as holding it, so the opening scenes do
 * not replay mid-game. Idempotent; nothing is renamed or removed.
 */
export function migrateLegacyStoryFlags(state: GameState): void {
  const progressed =
    state.getSigilCount() > 0 ||
    state.getFlag('rival-1-defeated') ||
    state.getFlag('eclipse-forest-cleared') ||
    state.getFlag('champion-defeated');
  if (progressed && !state.getFlag('has-journal')) state.flags['has-journal'] = true;
}
