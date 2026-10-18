import { describe, expect, it, vi } from 'vitest';

// The map modules import TilePainter, which imports Phaser at module scope.
vi.mock('phaser', () => ({ default: {} }));

import { GameState } from '../src/core/GameState';
import { MAPS } from '../src/world/maps';
import { TRAINERS, rivalDialogue } from '../src/world/trainers';
import {
  SCENES,
  STORY_SCENES,
  triggersOf,
  type StoryScene,
} from '../src/world/story/scenes';
import {
  applyScene,
  runScenes,
  scenesAfterBattle,
  scenesForDefeatedTrainers,
  scenesForMapEntry,
  scenesForNpcTalk,
} from '../src/world/story/sceneRunner';
import { applyTrainerVictory } from '../src/world/battleResults';
import { formatLine, parseLine, toDialogue, KNOWN_SPEAKERS } from '../src/world/story/dialogue';
import {
  JOURNAL_PAGES,
  LORE,
  journalEntries,
  knownLore,
  migrateLegacyStoryFlags,
} from '../src/world/story/journal';
import { getChapter } from '../src/world/campaign';

const RIVAL_TRAINER = /^rival-[1-4]$/;

function freshState(player = 'Rowan', rival = 'Kai'): GameState {
  const state = new GameState();
  state.playerName = player;
  state.rivalName = rival;
  state.starterChosen = 'emberkit';
  return state;
}

function ids(scenes: StoryScene[]): string[] {
  return scenes.map((scene) => scene.id);
}

describe('story script data', () => {
  it('has the 40 once-only scenes with unique ids', () => {
    expect(STORY_SCENES).toHaveLength(40);
    const all = SCENES.map((scene) => scene.id);
    expect(new Set(all).size).toBe(all.length);
  });

  it('points every trigger at an existing map, NPC or trainer', () => {
    for (const scene of SCENES) {
      for (const trigger of triggersOf(scene)) {
        if (trigger.kind === 'after') {
          const known = TRAINERS[trigger.trainerId] !== undefined || RIVAL_TRAINER.test(trigger.trainerId);
          expect(known, `${scene.id}: trainer ${trigger.trainerId}`).toBe(true);
          continue;
        }
        const map = MAPS[trigger.mapId];
        expect(map, `${scene.id}: map ${trigger.mapId}`).toBeDefined();
        if (trigger.kind === 'talk') {
          const npc = map.npcs.find((n) => n.id === trigger.npcId);
          expect(npc, `${scene.id}: npc ${trigger.mapId}/${trigger.npcId}`).toBeDefined();
        }
      }
    }
  });

  it('only sets flags that something reads (or scene-/journal- bookkeeping)', () => {
    const read = new Set<string>();
    for (const scene of SCENES) {
      scene.requires?.forEach((flag) => read.add(flag));
      scene.forbids?.forEach((flag) => read.add(flag));
      if (scene.reward?.unlessFlag) read.add(scene.reward.unlessFlag);
    }
    for (const map of Object.values(MAPS)) {
      for (const npc of map.npcs) {
        if (npc.showWhenFlag) read.add(npc.showWhenFlag);
        if (npc.hideWhenFlag) read.add(npc.hideWhenFlag);
      }
    }
    for (const trainer of Object.values(TRAINERS)) {
      if (trainer.requiresFlag) read.add(trainer.requiresFlag);
    }
    const lore = new Set(LORE.map((entry) => entry.flag));
    const journal = new Set(JOURNAL_PAGES.map((page) => page.flag));

    for (const scene of SCENES) {
      for (const flag of scene.sets ?? []) {
        const ok =
          read.has(flag) || lore.has(flag) || journal.has(flag) || flag.startsWith('scene-');
        expect(ok, `${scene.id} sets unread flag ${flag}`).toBe(true);
      }
    }
    // Every recorded lore flag is actually set by some scene.
    const set = new Set(SCENES.flatMap((scene) => scene.sets ?? []));
    for (const flag of lore) expect(set.has(flag), `lore flag ${flag}`).toBe(true);
  });

  it('keeps authored lines short enough for one text-box page', () => {
    for (const scene of SCENES) {
      for (const line of scene.lines) {
        expect(line.length, `${scene.id}: ${line}`).toBeLessThanOrEqual(100);
      }
    }
  });

  it('only uses known speakers in "Name: text" lines', () => {
    for (const scene of SCENES) {
      for (const line of scene.lines) {
        const { speaker } = parseLine(line);
        if (!speaker) continue;
        expect(KNOWN_SPEAKERS.has(speaker.replace(/ \(.*\)$/, '')), `${scene.id}: ${speaker}`).toBe(
          true,
        );
      }
    }
  });
});

interface Authored {
  where: string;
  text: string;
  kind: 'scene' | 'trainer' | 'npc' | 'sign';
}

/** Every authored string a text box can show, tagged with where it lives. */
function authoredDialogue(): Authored[] {
  const out: Authored[] = [];
  const add = (where: string, kind: Authored['kind'], texts: readonly string[]): void => {
    for (const text of texts) out.push({ where, kind, text });
  };
  for (const scene of SCENES) add(scene.id, 'scene', scene.lines);
  for (const [id, trainer] of Object.entries(TRAINERS)) {
    const d = trainer.dialogue;
    add(`trainer ${id}`, 'trainer', [...d.intro, ...d.defeat, ...(d.victory ?? []), ...(d.after ?? [])]);
  }
  for (let i = 1; i <= 4; i++) {
    const d = rivalDialogue(i);
    add(`rival battle ${i}`, 'trainer', [...d.intro, ...d.defeat, ...(d.after ?? [])]);
  }
  for (const map of Object.values(MAPS)) {
    for (const npc of map.npcs) {
      const kind = npc.kind === 'sign' ? 'sign' : 'npc';
      add(`${map.id}/${npc.id}`, kind, [...(npc.dialogue ?? []), ...(npc.chatter ?? [])]);
    }
  }
  return out;
}

describe('dialogue data across the game', () => {
  // Long enough to cover any name the naming screen might take.
  const WIDEST = { playerName: 'Maximilian', rivalName: 'Bartholomew' };
  const MAX_PAGE_CHARS = 100;

  it('keeps every authored line within one text-box page, whatever the names', () => {
    for (const { where, text } of authoredDialogue()) {
      const shown = parseLine(formatLine(text, WIDEST)).text;
      expect(shown.length, `${where}: ${shown}`).toBeLessThanOrEqual(MAX_PAGE_CHARS);
    }
  });

  it('tags trainer and NPC lines only with speakers in KNOWN_SPEAKERS', () => {
    for (const { where, text, kind } of authoredDialogue()) {
      if (kind !== 'trainer' && kind !== 'npc') continue;
      const prefix = /^([^:()]+?)(?: \([^)]*\))?: /.exec(text);
      if (!prefix) continue;
      expect(KNOWN_SPEAKERS.has(prefix[1]), `${where}: ${text}`).toBe(true);
    }
  });

  it('contains none of the retired names or contradictions', () => {
    const retired = /Aunt Mira|frozen north|wanderer|EMBELEAF|sky-crystal|shattered long ago/;
    for (const { where, text } of authoredDialogue()) {
      expect(text, where).not.toMatch(retired);
    }
  });
});

describe('scene runner', () => {
  it('marks a scene done and sets its flags, so it plays only once', () => {
    const state = freshState();
    const first = scenesForMapEntry(state, 'emberleaf-town');
    expect(ids(first)).toEqual(['p-town-dawn']);
    const lines = runScenes(state, first);
    expect(lines.length).toBe(2);
    expect(state.getFlag('scene-p-town-dawn')).toBe(true);
    expect(scenesForMapEntry(state, 'emberleaf-town')).toEqual([]);

    const ivy = scenesAfterBattle(state, 'trial-ivy');
    expect(ivy).toEqual([]);
    state.setFlag('trial-1-cleared');
    const played = scenesAfterBattle(state, 'trial-ivy');
    expect(ids(played)).toEqual(['c2-ivy-after']);
    applyScene(state, played[0]);
    expect(state.getFlag('journal-page-1')).toBe(true);
    expect(state.getFlag('summons-known')).toBe(true);
    expect(scenesAfterBattle(state, 'trial-ivy')).toEqual([]);
  });

  it('has no recovery scenes on a fresh save', () => {
    const state = freshState();
    expect(scenesForDefeatedTrainers(state)).toEqual([]);
  });

  it('recovers an interrupted trial victory from the saved defeat marker', () => {
    const state = freshState();
    applyTrainerVictory(state, TRAINERS['trial-ivy']);

    // The trainer is beaten but the story never played. Game.lastOutcome is not
    // serialised, so only the defeat marker survives the save/load round trip.
    const reloaded = GameState.fromJSON(JSON.parse(JSON.stringify(state.toJSON())));
    const pending = scenesForDefeatedTrainers(reloaded);
    expect(ids(pending)).toEqual(['c2-ivy-after']);

    runScenes(reloaded, pending);
    expect(reloaded.getFlag('journal-page-1')).toBe(true);
    expect(reloaded.getFlag('summons-known')).toBe(true);

    // Running the scene records it, so a later reload must not replay it.
    const again = GameState.fromJSON(JSON.parse(JSON.stringify(reloaded.toJSON())));
    expect(scenesForDefeatedTrainers(again)).toEqual([]);
  });

  it('does not fire unearned after-scenes that have no required flags', () => {
    const state = freshState();
    // c7-nerys-after declares no `requires`; only Nerys' own defeat marker may
    // unlock it, so surrounding trial progress must not leak it in.
    state.setFlag('trial-6-cleared');
    expect(ids(scenesForDefeatedTrainers(state))).not.toContain('c7-nerys-after');

    applyTrainerVictory(state, TRAINERS['ace-nerys']);
    expect(ids(scenesForDefeatedTrainers(state))).toContain('c7-nerys-after');
  });

  it('recovers the Champion aftermath from its durable marker', () => {
    const state = freshState();
    applyTrainerVictory(state, TRAINERS['champion-aurelia']);
    expect(ids(scenesForDefeatedTrainers(state))).toContain('f-aurelia-after');
  });

  it('respects required and forbidden flags', () => {
    const state = freshState();
    expect(scenesForMapEntry(state, 'whisperwood-forest')).toEqual([]);
    state.setFlag('rival-1-defeated');
    expect(ids(scenesForMapEntry(state, 'whisperwood-forest'))).toEqual(['c1-forest-entry']);

    // Soren in the forest needs the grunt beaten and no earlier sighting.
    expect(scenesForNpcTalk(state, 'whisperwood-forest', 'soren-forest')).toEqual([]);
    state.setFlag('eclipse-forest-cleared');
    expect(ids(scenesForNpcTalk(state, 'whisperwood-forest', 'soren-forest'))).toEqual([
      'c1-soren-forest',
    ]);
    state.setFlag('soren-sighted');
    expect(scenesForNpcTalk(state, 'whisperwood-forest', 'soren-forest')).toEqual([]);
  });

  it('chains the journal scene after the first Lumen talk and never replays it', () => {
    const state = freshState();
    const talk = scenesForNpcTalk(state, 'lumen-lab', 'professor-lumen');
    expect(ids(talk)).toEqual(['p-lumen-offer', 'p-lumen-journal']);
    runScenes(state, talk);
    expect(state.getFlag('has-journal')).toBe(true);
    // Afterwards he repeats a state-dependent line instead.
    const again = scenesForNpcTalk(state, 'lumen-lab', 'professor-lumen');
    expect(ids(again)).toEqual(['r-lumen-partner']);
    runScenes(state, again);
    expect(state.getFlag('scene-r-lumen-partner')).toBe(false);
    expect(ids(scenesForNpcTalk(state, 'lumen-lab', 'professor-lumen'))).toEqual([
      'r-lumen-partner',
    ]);
  });

  it('grants the Master Prism once, and not again for saves that saw the old finale', () => {
    const fresh = freshState();
    fresh.setFlag('champion-defeated');
    const lines = runScenes(fresh, scenesForNpcTalk(fresh, 'prism-summit', 'aetherion-altar'));
    expect(fresh.bag['master-prism']).toBe(1);
    expect(lines.some((line) => line.text.includes('Master Prism'))).toBe(true);
    expect(fresh.getFlag('edda-returned')).toBe(true);
    expect(fresh.getFlag('journal-complete')).toBe(true);

    const legacy = freshState();
    legacy.setFlag('champion-defeated');
    legacy.setFlag('story-finale-seen');
    legacy.addItem('master-prism', 1);
    runScenes(legacy, scenesForNpcTalk(legacy, 'prism-summit', 'aetherion-altar'));
    expect(legacy.bag['master-prism']).toBe(1);
    expect(legacy.getFlag('edda-returned')).toBe(true);
  });
});

describe('main path progression', () => {
  it('fires every scene in order from the Prologue to the Epilogue', () => {
    const state = freshState();
    const played: string[] = [];
    const play = (scenes: StoryScene[]): void => {
      runScenes(state, scenes);
      played.push(...ids(scenes));
    };
    const win = (trainerId: string, flag: string, sigil?: string): void => {
      state.setFlag(`defeated-${trainerId}`);
      state.setFlag(flag);
      if (sigil && !state.hasSigil(sigil)) state.sigils.push(sigil);
    };

    // Prologue.
    play(scenesForMapEntry(state, 'emberleaf-town'));
    play(scenesForNpcTalk(state, 'emberleaf-town', 'aunt-wren'));
    play(scenesForMapEntry(state, 'lumen-lab'));
    play(scenesForNpcTalk(state, 'lumen-lab', 'professor-lumen'));
    win('rival-1', 'rival-1-defeated');
    play(scenesAfterBattle(state, 'rival-1'));

    // Chapter 1.
    play(scenesForMapEntry(state, 'whisperwood-forest'));
    win('eclipse-grunt-1', 'eclipse-forest-cleared');
    play(scenesAfterBattle(state, 'eclipse-grunt-1'));
    play(scenesForNpcTalk(state, 'whisperwood-forest', 'soren-forest'));

    // Chapter 2.
    play(scenesForMapEntry(state, 'thistlebrook'));
    win('trial-ivy', 'trial-1-cleared', 'sigil-grass');
    play(scenesAfterBattle(state, 'trial-ivy'));
    win('rival-2', 'rival-2-defeated');
    play(scenesAfterBattle(state, 'rival-2'));

    // Chapters 3 and 4.
    play(scenesForMapEntry(state, 'voltspire-city'));
    win('eclipse-grunt-2', 'eclipse-plant-cleared');
    play(scenesAfterBattle(state, 'eclipse-grunt-2'));
    play(scenesForNpcTalk(state, 'voltspire-city', 'soren-plant'));
    win('trial-volta', 'trial-2-cleared', 'sigil-electric');
    play(scenesAfterBattle(state, 'trial-volta'));
    play(scenesForMapEntry(state, 'voltspire-city'));

    // Chapter 5.
    play(scenesForNpcTalk(state, 'tidehaven', 'kai-dock'));
    win('trial-marin', 'trial-3-cleared', 'sigil-water');
    play(scenesAfterBattle(state, 'trial-marin'));
    win('rival-3', 'rival-3-defeated');
    play(scenesAfterBattle(state, 'rival-3'));

    // Chapter 6.
    play(scenesForMapEntry(state, 'ashfall-town'));
    win('trial-blaze', 'trial-4-cleared', 'sigil-fire');
    play(scenesAfterBattle(state, 'trial-blaze'));
    play(scenesForNpcTalk(state, 'cinder-peak', 'pilgrim-cinder'));

    // Chapter 7.
    win('trial-opal', 'trial-5-cleared', 'sigil-crystal');
    play(scenesAfterBattle(state, 'trial-opal'));
    play(scenesForNpcTalk(state, 'geode-hollow', 'lumen-geode'));
    play(scenesAfterBattle(state, 'ace-nerys'));
    win('rival-4', 'rival-4-defeated');
    play(scenesAfterBattle(state, 'rival-4'));

    // Chapter 8.
    play(scenesForMapEntry(state, 'duskmoor-ruins'));
    win('trial-raven', 'trial-6-cleared', 'sigil-shadow');
    play(scenesAfterBattle(state, 'trial-raven'));

    // Chapter 9: Voss speaks before the battle; the confession follows the win.
    play(scenesForNpcTalk(state, 'duskmoor-ruins', 'eclipse-admin-voss'));
    win('eclipse-admin-voss', 'eclipse-ritual-broken');
    play(scenesAfterBattle(state, 'eclipse-admin-voss'));

    // Finale.
    play(scenesForMapEntry(state, 'prism-summit'));
    win('champion-aurelia', 'champion-defeated');
    play(scenesAfterBattle(state, 'champion-aurelia'));
    play(scenesForNpcTalk(state, 'prism-summit', 'aetherion-altar'));

    // Epilogue.
    play(scenesForMapEntry(state, 'emberleaf-town'));
    play(scenesForNpcTalk(state, 'emberleaf-town', 'edda'));
    play(scenesForNpcTalk(state, 'emberleaf-town', 'kai-epilogue'));
    play(scenesForNpcTalk(state, 'lumen-lab', 'professor-lumen'));

    expect(played).toEqual([
      'p-town-dawn',
      'p-aunt-wren',
      'p-lab-arrival',
      'p-lumen-offer',
      'p-lumen-journal',
      'p-rival-1-after',
      'c1-forest-entry',
      'c1-grunt-after',
      'c1-soren-forest',
      'c2-thistle-entry',
      'c2-ivy-after',
      'c2-rival-2-after',
      'c3-voltspire-entry',
      'c3-grunt2-after',
      'c3-soren-plant',
      'c4-volta-after',
      'c4-summit-broadcast',
      'c5-kai-dock',
      'c5-marin-after',
      'c5-rival-3-after',
      'c6-ashfall-entry',
      'c6-blaze-after',
      'c6-pilgrim',
      'c7-opal-after',
      'c7-lumen-geode',
      'c7-nerys-after',
      'c7-rival-4-after',
      'c8-duskmoor-entry',
      'c8-raven-after',
      'c9-voss-before',
      'c9-voss-after',
      'c9-soren-confession',
      'f-summit-entry',
      'f-aurelia-after',
      'f-sockets',
      'f-last-page',
      'e-lighthouse-relit',
      'e-edda-home',
      'e-kai-farewell',
      'e-lumen-archive',
    ]);
    expect(new Set(played)).toEqual(new Set(STORY_SCENES.map((scene) => scene.id)));
    expect(getChapter(state).title).toBe('Still Tending It');
    expect(journalEntries(state)).toHaveLength(JOURNAL_PAGES.length);
    expect(knownLore(state)).toHaveLength(LORE.length);
  });
});

describe('name substitution', () => {
  it('replaces {player} and {rival} everywhere, including speaker names', () => {
    const names = { playerName: 'Wren', rivalName: 'Juno' };
    expect(formatLine('{rival} says hi to {player}. {rival}!', names)).toBe(
      'Juno says hi to Wren. Juno!',
    );
    const [line] = toDialogue(['{rival} (ahead on the path): Hello, {player}.'], names);
    expect(line.speaker).toBe('Juno (ahead on the path)');
    expect(line.text).toBe('Hello, Wren.');
  });

  it('is safe against names containing replacement patterns', () => {
    expect(formatLine('{rival}', { playerName: 'a', rivalName: '$&$1' })).toBe('$&$1');
  });

  it('shows the renamed companion in played scenes and rival battles', () => {
    const state = freshState('Wren', 'Juno');
    state.setFlag('rival-1-defeated');
    const lines = runScenes(state, scenesAfterBattle(state, 'rival-1'));
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((line) => !line.text.includes('{') && !(line.speaker ?? '').includes('{'))).toBe(
      true,
    );
    expect(lines[0].speaker).toBe('Juno');

    const rival = toDialogue(rivalDialogue(1).intro, state, 'Juno');
    expect(rival[0].text).toBe('Wren! You took a partner too?');
    expect(rival[0].speaker).toBe('Juno');
  });

  it('never hardcodes the default companion name in dialogue text', () => {
    const strings: string[] = [];
    for (const scene of SCENES) strings.push(...scene.lines);
    for (const trainer of Object.values(TRAINERS)) {
      const d = trainer.dialogue;
      strings.push(trainer.name, ...d.intro, ...d.defeat, ...(d.victory ?? []), ...(d.after ?? []));
    }
    for (let i = 1; i <= 4; i++) {
      const d = rivalDialogue(i);
      strings.push(...d.intro, ...d.defeat, ...(d.after ?? []));
    }
    for (const map of Object.values(MAPS)) {
      for (const npc of map.npcs) {
        strings.push(npc.name, ...(npc.dialogue ?? []), ...(npc.chatter ?? []));
      }
    }
    for (const text of strings) expect(text, text).not.toMatch(/\bKai\b/);
  });
});

describe('world data for the new story', () => {
  it('adds the eleven new NPCs with sensible show/hide flags', () => {
    const expected: Array<[string, string]> = [
      ['whisperwood-forest', 'soren-forest'],
      ['voltspire-city', 'soren-plant'],
      ['tidehaven', 'kai-dock'],
      ['cinder-peak', 'pilgrim-cinder'],
      ['geode-hollow', 'lumen-geode'],
      ['duskmoor-ruins', 'soren-duskmoor'],
      ['prism-summit', 'soren-summit'],
      ['prism-summit', 'voss-summit'],
      ['emberleaf-town', 'edda'],
      ['emberleaf-town', 'kai-epilogue'],
      ['emberleaf-town', 'soren-home'],
    ];
    for (const [mapId, npcId] of expected) {
      const npc = MAPS[mapId].npcs.find((n) => n.id === npcId);
      expect(npc, `${mapId}/${npcId}`).toBeDefined();
      expect(npc?.showWhenFlag, npcId).toBeTruthy();
    }
  });

  it('renames mom to Aunt Wren, fixes the sign and holds Voss back until Raven', () => {
    const town = MAPS['emberleaf-town'];
    expect(town.npcs.some((n) => n.id === 'mom')).toBe(false);
    expect(town.npcs.find((n) => n.id === 'aunt-wren')?.name).toBe('Aunt Wren');
    expect(town.npcs.find((n) => n.id === 'emberleaf-sign')?.dialogue?.[0]).toBe('EMBERLEAF TOWN');
    const voss = MAPS['duskmoor-ruins'].npcs.find((n) => n.id === 'eclipse-admin-voss');
    expect(voss?.showWhenFlag).toBe('trial-6-cleared');
    expect(TRAINERS['eclipse-admin-voss'].requiresFlag).toBe('trial-6-cleared');
  });

  it('never stacks two visible NPCs on one tile for any story state', () => {
    for (const map of Object.values(MAPS)) {
      const seen = new Map<string, string>();
      for (const npc of map.npcs) {
        const key = `${npc.x},${npc.y}`;
        const other = seen.get(key);
        if (other) {
          // Lit and dark signs share a tile on purpose; they have opposite flags.
          expect(npc.showWhenFlag ?? npc.hideWhenFlag, `${map.id} ${npc.id}/${other}`).toBeTruthy();
        }
        seen.set(key, npc.id);
      }
    }
  });
});

describe('old saves', () => {
  it('loads a save with legacy flags and keeps them', () => {
    const old = freshState();
    old.setFlag('story-emberleaf-town-seen');
    old.setFlag('story-geode-hollow-seen');
    old.setFlag('rival-1-defeated');
    old.setFlag('eclipse-forest-cleared');
    old.sigils.push('sigil-grass');
    const data = JSON.parse(JSON.stringify(old.toJSON()));
    // Saves written before the rewrite have none of the new story flags.
    expect(data.flags['has-journal']).toBeUndefined();

    const loaded = GameState.fromJSON(data);
    expect(loaded.getFlag('story-emberleaf-town-seen')).toBe(true);
    expect(loaded.getFlag('rival-1-defeated')).toBe(true);
    expect(loaded.hasSigil('sigil-grass')).toBe(true);
    // Already past the lab, so the opening scenes do not replay.
    expect(loaded.getFlag('has-journal')).toBe(true);
    expect(scenesForNpcTalk(loaded, 'emberleaf-town', 'aunt-wren').map((s) => s.id)).toEqual([
      'r-wren-waiting',
    ]);
    expect(scenesForNpcTalk(loaded, 'lumen-lab', 'professor-lumen').map((s) => s.id)).toEqual([
      'r-lumen-partner',
    ]);
  });

  it('leaves a brand-new save without the journal and migrating is idempotent', () => {
    const state = freshState();
    migrateLegacyStoryFlags(state);
    expect(state.getFlag('has-journal')).toBe(false);
    state.sigils.push('sigil-grass');
    migrateLegacyStoryFlags(state);
    migrateLegacyStoryFlags(state);
    expect(state.getFlag('has-journal')).toBe(true);
  });

  it('lets a save that already beat the Champion reach the new finale', () => {
    const old = freshState();
    old.setFlag('champion-defeated');
    old.setFlag('story-finale-seen');
    const loaded = GameState.fromJSON(JSON.parse(JSON.stringify(old.toJSON())));
    const scenes = scenesForNpcTalk(loaded, 'prism-summit', 'aetherion-altar');
    expect(ids(scenes)).toEqual(['f-sockets', 'f-last-page']);
  });
});
