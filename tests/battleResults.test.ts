import { describe, expect, it } from 'vitest';

import { createCreature, maxHp, type CreatureInstance } from '../src/battle/Creature';
import type { BattleAction } from '../src/battle/TurnResolver';
import { GameState } from '../src/core/GameState';
import { random } from '../src/core/SeededRNG';
import type { CreatureId } from '../src/data/creatures';
import type { ItemId } from '../src/data/items';
import { applyTrainerVictory, consumeBattleItem } from '../src/world/battleResults';
import { TRAINERS } from '../src/world/trainers';

const TRIALS: ReadonlyArray<readonly [string, string]> = [
  ['trial-ivy', 'sigil-grass'],
  ['trial-volta', 'sigil-electric'],
  ['trial-marin', 'sigil-water'],
  ['trial-blaze', 'sigil-fire'],
  ['trial-opal', 'sigil-crystal'],
  ['trial-raven', 'sigil-shadow'],
];

function creature(
  speciesId: CreatureId = 'sparkit',
  options: Partial<CreatureInstance> = {},
): CreatureInstance {
  return createCreature(speciesId, 5, { rng: random, ...options });
}

describe('applyTrainerVictory', () => {
  it('records the trial sequence and is idempotent on repeat', () => {
    const state = new GameState();
    for (const [trainerId, sigilId] of TRIALS) {
      const first = applyTrainerVictory(state, TRAINERS[trainerId]);
      expect(first.firstVictory).toBe(true);
      expect(first.trophyId).toBe(sigilId);
      expect(state.getFlag(`defeated-${trainerId}`)).toBe(true);
    }
    expect(state.getSigilCount()).toBe(6);
    expect(state.sigils).toEqual(TRIALS.map(([, sigilId]) => sigilId));
    for (const [, sigilId] of TRIALS) {
      expect(state.itemCount(sigilId as ItemId)).toBe(1);
    }

    for (const [trainerId] of TRIALS) {
      const repeat = applyTrainerVictory(state, TRAINERS[trainerId]);
      expect(repeat).toEqual({ firstVictory: false, trophyId: null });
    }
    expect(state.getSigilCount()).toBe(6);
    for (const [, sigilId] of TRIALS) {
      expect(state.itemCount(sigilId as ItemId)).toBe(1);
    }
  });

  it('sets story flags and reports a single first victory for plain trainers', () => {
    const state = new GameState();
    const trainer = TRAINERS['eclipse-grunt-1'];

    const first = applyTrainerVictory(state, trainer);
    expect(first).toEqual({ firstVictory: true, trophyId: null });
    expect(state.getFlag('eclipse-forest-cleared')).toBe(true);
    expect(state.getFlag('defeated-eclipse-grunt-1')).toBe(true);

    const second = applyTrainerVictory(state, trainer);
    expect(second).toEqual({ firstVictory: false, trophyId: null });
  });

  it('crowns the champion and records the Hall of Fame', () => {
    const state = new GameState();
    for (const [trainerId] of TRIALS) applyTrainerVictory(state, TRAINERS[trainerId]);

    const champ = applyTrainerVictory(state, TRAINERS['champion-aurelia']);
    expect(champ).toEqual({ firstVictory: true, trophyId: null });
    expect(state.hallOfFame).toBe(true);
    expect(state.getFlag('champion-defeated')).toBe(true);

    const repeat = applyTrainerVictory(state, TRAINERS['champion-aurelia']);
    expect(repeat).toEqual({ firstVictory: false, trophyId: null });
    expect(state.hallOfFame).toBe(true);
  });

  it('treats a pre-set story flag as already defeated but repairs a missing Sigil once', () => {
    const state = new GameState();
    state.setFlag('trial-1-cleared', true);

    const result = applyTrainerVictory(state, TRAINERS['trial-ivy']);
    expect(result.firstVictory).toBe(false);
    expect(result.trophyId).toBe('sigil-grass');
    expect(state.hasSigil('sigil-grass')).toBe(true);
    expect(state.itemCount('sigil-grass')).toBe(1);
    expect(state.getFlag('defeated-trial-ivy')).toBe(true);

    const repeat = applyTrainerVictory(state, TRAINERS['trial-ivy']);
    expect(repeat).toEqual({ firstVictory: false, trophyId: null });
    expect(state.getSigilCount()).toBe(1);
    expect(state.itemCount('sigil-grass')).toBe(1);
  });

  it('refuses a sigil that is not a real Sigil item', () => {
    const state = new GameState();
    const impostor = { ...TRAINERS['trial-ivy'], id: 'trial-impostor', sigil: 'sigil-moon' };

    const result = applyTrainerVictory(state, impostor);
    expect(result.trophyId).toBeNull();
    expect(state.getSigilCount()).toBe(0);
    expect(state.itemCount('sigil-moon' as ItemId)).toBe(0);
  });

  it('keeps trophies across a save round-trip', () => {
    const state = new GameState();
    for (const [trainerId] of TRIALS) applyTrainerVictory(state, TRAINERS[trainerId]);
    applyTrainerVictory(state, TRAINERS['champion-aurelia']);

    const restored = GameState.fromJSON(JSON.parse(JSON.stringify(state.toJSON())));
    expect(restored.sigils).toEqual(state.sigils);
    expect(restored.hallOfFame).toBe(true);
    for (const [, sigilId] of TRIALS) {
      expect(restored.itemCount(sigilId as ItemId)).toBe(1);
    }

    const again = applyTrainerVictory(restored, TRAINERS['trial-ivy']);
    expect(again).toEqual({ firstVictory: false, trophyId: null });
    expect(restored.getSigilCount()).toBe(6);
  });
});

describe('consumeBattleItem', () => {
  it('ignores non-item actions without touching the bag', () => {
    const state = new GameState();
    const before = { ...state.bag };
    const actions: BattleAction[] = [
      { kind: 'move', moveIndex: 0 },
      { kind: 'switch', index: 0 },
      { kind: 'flee' },
      { kind: 'forfeit' },
    ];
    for (const action of actions) {
      expect(consumeBattleItem(state, action, true)).toEqual({ ok: true });
    }
    expect(state.bag).toEqual(before);
  });

  it('spends exactly one orb for a legal wild throw', () => {
    const state = new GameState();
    const before = state.itemCount('prism-orb');

    const result = consumeBattleItem(state, { kind: 'orb', itemId: 'prism-orb' }, true);
    expect(result.ok).toBe(true);
    expect(state.itemCount('prism-orb')).toBe(before - 1);
  });

  it('refuses a trainer capture without spending the orb', () => {
    const state = new GameState();
    const before = state.itemCount('prism-orb');

    const result = consumeBattleItem(state, { kind: 'orb', itemId: 'prism-orb' }, false);
    expect(result.ok).toBe(false);
    expect(result.reason).toBeTruthy();
    expect(state.itemCount('prism-orb')).toBe(before);
  });

  it('blocks a capture when the party and every box are full', () => {
    const state = new GameState();
    state.party = [];
    for (let i = 0; i < 6; i++) state.party.push(creature());
    for (const box of state.boxes) {
      for (let i = 0; i < box.length; i++) box[i] = creature();
    }
    expect(state.partyHasSpace).toBe(false);
    expect(state.firstFreeBoxSlot()).toBeNull();

    const before = state.itemCount('prism-orb');
    const result = consumeBattleItem(state, { kind: 'orb', itemId: 'prism-orb' }, true);
    expect(result.ok).toBe(false);
    expect(state.itemCount('prism-orb')).toBe(before);
  });

  it('rejects unknown item ids without throwing', () => {
    const state = new GameState();
    expect(
      consumeBattleItem(state, { kind: 'orb', itemId: 'moon-orb' as ItemId }, true).ok,
    ).toBe(false);
    expect(
      consumeBattleItem(
        state,
        { kind: 'item', itemId: 'moon-orb' as ItemId, targetIndex: 0 },
        true,
      ).ok,
    ).toBe(false);
  });

  it('rejects an orb action aimed at a non-orb item', () => {
    const state = new GameState();
    expect(consumeBattleItem(state, { kind: 'orb', itemId: 'potion' }, true).ok).toBe(false);
  });

  it('consumes a potion exactly once for a damaged creature', () => {
    const state = new GameState();
    const mon = creature();
    mon.currentHp = Math.max(1, Math.floor(maxHp(mon) / 2));
    state.party = [mon];
    const before = state.itemCount('potion');
    const hpBefore = mon.currentHp;

    expect(
      consumeBattleItem(state, { kind: 'item', itemId: 'potion', targetIndex: 0 }, false).ok,
    ).toBe(true);
    expect(state.itemCount('potion')).toBe(before - 1);
    expect(mon.currentHp).toBe(hpBefore);
  });

  it('refuses a potion on a full-HP or fainted creature', () => {
    const state = new GameState();
    state.party = [creature()];
    expect(
      consumeBattleItem(state, { kind: 'item', itemId: 'potion', targetIndex: 0 }, false).ok,
    ).toBe(false);

    state.party = [creature('sparkit', { currentHp: 0 })];
    expect(
      consumeBattleItem(state, { kind: 'item', itemId: 'potion', targetIndex: 0 }, false).ok,
    ).toBe(false);
  });

  it('rejects an invalid target index instead of guessing one', () => {
    const state = new GameState();
    const mon = creature();
    mon.currentHp = Math.max(1, Math.floor(maxHp(mon) / 2));
    state.party = [mon];

    expect(
      consumeBattleItem(state, { kind: 'item', itemId: 'potion', targetIndex: 5 }, false).ok,
    ).toBe(false);
    expect(
      consumeBattleItem(state, { kind: 'item', itemId: 'potion', targetIndex: -1 }, false).ok,
    ).toBe(false);
  });

  it('only revives fainted creatures', () => {
    const state = new GameState();
    state.addItem('revive', 2);
    state.party = [creature('sparkit', { currentHp: 0 })];
    expect(
      consumeBattleItem(state, { kind: 'item', itemId: 'revive', targetIndex: 0 }, false).ok,
    ).toBe(true);

    state.party = [creature()];
    expect(
      consumeBattleItem(state, { kind: 'item', itemId: 'revive', targetIndex: 0 }, false).ok,
    ).toBe(false);
  });

  it('only cures a status the creature actually has', () => {
    const state = new GameState();
    state.addItem('burn-salve', 3);

    state.party = [creature('sparkit', { status: 'burn' })];
    expect(
      consumeBattleItem(state, { kind: 'item', itemId: 'burn-salve', targetIndex: 0 }, false).ok,
    ).toBe(true);

    state.party = [creature()];
    expect(
      consumeBattleItem(state, { kind: 'item', itemId: 'burn-salve', targetIndex: 0 }, false).ok,
    ).toBe(false);

    state.party = [creature('sparkit', { status: 'sleep' })];
    expect(
      consumeBattleItem(state, { kind: 'item', itemId: 'burn-salve', targetIndex: 0 }, false).ok,
    ).toBe(false);

    state.addItem('full-heal', 1);
    expect(
      consumeBattleItem(state, { kind: 'item', itemId: 'full-heal', targetIndex: 0 }, false).ok,
    ).toBe(true);
  });

  it('only restores PP when PP is missing', () => {
    const state = new GameState();
    state.addItem('elixir', 2);
    const mon = creature();
    state.party = [mon];

    expect(
      consumeBattleItem(state, { kind: 'item', itemId: 'elixir', targetIndex: 0 }, false).ok,
    ).toBe(false);

    mon.moves[0].pp = Math.max(0, mon.moves[0].pp - 1);
    expect(
      consumeBattleItem(state, { kind: 'item', itemId: 'elixir', targetIndex: 0 }, false).ok,
    ).toBe(true);
  });

  it('only uses battle-stat items on a living creature', () => {
    const state = new GameState();
    state.addItem('x-attack', 2);

    state.party = [creature('sparkit', { currentHp: 0 })];
    expect(
      consumeBattleItem(state, { kind: 'item', itemId: 'x-attack', targetIndex: 0 }, false).ok,
    ).toBe(false);

    state.party = [creature()];
    expect(
      consumeBattleItem(state, { kind: 'item', itemId: 'x-attack', targetIndex: 0 }, false).ok,
    ).toBe(true);
  });

  it('never spends an item the bag does not hold', () => {
    const state = new GameState();
    state.bag = {};
    state.party = [creature('sparkit', { currentHp: 1 })];

    expect(
      consumeBattleItem(state, { kind: 'item', itemId: 'potion', targetIndex: 0 }, false).ok,
    ).toBe(false);
    expect(state.itemCount('potion')).toBe(0);
  });
});
