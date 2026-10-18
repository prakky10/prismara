import { describe, expect, it } from 'vitest';

import {
  actionMenuItems,
  arenaBiomeFor,
  bagMenuItems,
  learnMenuItems,
  moveMenuItems,
  partyMenuItems,
  prettyMove,
  statLabel,
} from '../src/scenes/battle/battleMenus';
import { BattleState } from '../src/battle/BattleState';
import { createCreature, displayName, maxHp, type CreatureInstance } from '../src/battle/Creature';
import { createRNG } from '../src/core/SeededRNG';
import type { CreatureId } from '../src/data/creatures';
import { ITEMS, type ItemId } from '../src/data/items';
import { getMove } from '../src/data/moves';
import { ELEMENT_INFO } from '../src/data/types';

function ivs() {
  return { hp: 15, attack: 15, defense: 15, spPower: 15, spGuard: 15, speed: 15 };
}

function creature(id: CreatureId = 'emberkit', options: Partial<CreatureInstance> = {}) {
  return createCreature(id, 20, { ivs: ivs(), rng: createRNG(1), ...options });
}

function battleWith(
  playerParty: CreatureInstance[],
  options: { isWild?: boolean; canFlee?: boolean } = {},
): BattleState {
  return new BattleState({
    playerParty,
    enemyParty: [creature('drizzlet')],
    playerName: 'Ash',
    isWild: options.isWild ?? true,
    canFlee: options.canFlee,
    context: { weather: 'clear', timeOfDay: 'day', isCave: false },
    seed: 1,
  });
}

/* ------------------------------------------------------ actionMenuItems -- */

describe('actionMenuItems', () => {
  it('offers Fight, Bag, Creature and Run in that order', () => {
    const battle = battleWith([creature()]);
    expect(actionMenuItems(battle).map((item) => item.value)).toEqual([
      'fight',
      'bag',
      'party',
      'run',
    ]);
  });

  it('enables Run in a wild battle', () => {
    const run = actionMenuItems(battleWith([creature()], { isWild: true })).find(
      (item) => item.value === 'run',
    );
    expect(run).toMatchObject({ label: 'Run', disabled: false });
  });

  it('disables Run in a trainer battle and shows a dash instead', () => {
    const run = actionMenuItems(battleWith([creature()], { isWild: false })).find(
      (item) => item.value === 'run',
    );
    expect(run).toMatchObject({ label: '—', disabled: true });
  });

  it('disables Run when the battle says fleeing is not allowed, even if wild', () => {
    const run = actionMenuItems(battleWith([creature()], { isWild: true, canFlee: false })).find(
      (item) => item.value === 'run',
    );
    expect(run?.disabled).toBe(true);
  });

  it('leaves the other actions enabled', () => {
    const items = actionMenuItems(battleWith([creature()], { isWild: false }));
    for (const item of items.filter((i) => i.value !== 'run')) {
      expect(item.disabled).toBeFalsy();
    }
  });
});

/* -------------------------------------------------------- moveMenuItems -- */

describe('moveMenuItems', () => {
  it('lists each move with its PP and an index value', () => {
    const active = creature();
    active.moves = [
      { id: 'tackle', pp: 30, maxPp: 35 },
      { id: 'ember-pounce', pp: 10, maxPp: 15 },
    ];
    const items = moveMenuItems(battleWith([active]));
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      value: '0',
      label: getMove('tackle')?.name,
      sublabel: '30/35',
      disabled: false,
    });
    expect(items[1]).toMatchObject({ value: '1', sublabel: '10/15', disabled: false });
  });

  it('shows the move type as trailing text and its element colour', () => {
    const active = creature();
    active.moves = [{ id: 'tackle', pp: 35, maxPp: 35 }];
    const move = getMove('tackle');
    if (!move) throw new Error('tackle missing from move data');
    const [row] = moveMenuItems(battleWith([active]));
    expect(row.trailing).toBe(move.type.toUpperCase());
    expect(row.color).toBe(ELEMENT_INFO[move.type].color);
  });

  it('disables a move with no PP left while keeping the others usable', () => {
    const active = creature();
    active.moves = [
      { id: 'tackle', pp: 0, maxPp: 35 },
      { id: 'ember-pounce', pp: 4, maxPp: 15 },
    ];
    const items = moveMenuItems(battleWith([active]));
    expect(items[0].disabled).toBe(true);
    expect(items[1].disabled).toBe(false);
  });

  it('does not offer Struggle while any move still has PP', () => {
    const active = creature();
    active.moves = [
      { id: 'tackle', pp: 0, maxPp: 35 },
      { id: 'ember-pounce', pp: 1, maxPp: 15 },
    ];
    const items = moveMenuItems(battleWith([active]));
    expect(items.map((item) => item.value)).toEqual(['0', '1']);
  });

  it('falls back to Struggle when every move is out of PP', () => {
    const active = creature();
    active.moves = [
      { id: 'tackle', pp: 0, maxPp: 35 },
      { id: 'ember-pounce', pp: 0, maxPp: 15 },
    ];
    const items = moveMenuItems(battleWith([active]));
    expect(items).toHaveLength(3);
    expect(items[0].disabled).toBe(true);
    expect(items[1].disabled).toBe(true);
    expect(items[2]).toMatchObject({ value: '-1', label: 'Struggle' });
    expect(items[2].disabled).toBeFalsy();
  });

  it('offers only Struggle when the creature knows no moves at all', () => {
    const active = creature();
    active.moves = [];
    expect(moveMenuItems(battleWith([active]))).toEqual([{ value: '-1', label: 'Struggle' }]);
  });

  it('shows the raw id and no type details for a move missing from the data', () => {
    const active = creature();
    active.moves = [{ id: 'mystery-move', pp: 5, maxPp: 5 }];
    const [row] = moveMenuItems(battleWith([active]));
    expect(row).toMatchObject({ label: 'mystery-move', trailing: '', disabled: false });
    expect(row.color).toBeUndefined();
  });
});

/* ------------------------------------------------------- partyMenuItems -- */

describe('partyMenuItems', () => {
  // Party layout used by most tests:
  //   0: healthy, becomes the active creature
  //   1: fainted
  //   2: healthy but entangled
  //   3: healthy
  function sampleParty() {
    const healthy = creature('emberkit');
    const fainted = creature('drizzlet', { currentHp: 0 });
    const entangled = creature('sproutle', { status: 'entangled' });
    const reserve = creature('emberkit');
    return { party: [healthy, fainted, entangled, reserve], healthy, fainted, entangled, reserve };
  }

  it('disables the fainted and active creatures on a voluntary switch', () => {
    const { party } = sampleParty();
    const items = partyMenuItems(battleWith(party), false);
    expect(items.map((item) => item.disabled)).toEqual([true, true, true, false]);
  });

  it('keeps an entangled creature selectable on a forced switch', () => {
    const { party } = sampleParty();
    const items = partyMenuItems(battleWith(party), true);
    expect(items.map((item) => item.disabled)).toEqual([true, true, false, false]);
  });

  it('still never allows the active or fainted creature on a forced switch', () => {
    const { party } = sampleParty();
    const items = partyMenuItems(battleWith(party), true);
    expect(items[0].disabled).toBe(true);
    expect(items[1].disabled).toBe(true);
  });

  it('disables whichever creature is currently active', () => {
    const { party } = sampleParty();
    const battle = battleWith(party);
    battle.player.activeIndex = 3;
    const items = partyMenuItems(battle, false);
    expect(items[3].disabled).toBe(true);
    expect(items[0].disabled).toBe(false);
  });

  it('labels each row with the display name and HP over max HP', () => {
    const { party, healthy, fainted } = sampleParty();
    const items = partyMenuItems(battleWith(party), false);
    expect(items[0]).toMatchObject({
      value: '0',
      label: displayName(healthy),
      sublabel: `${healthy.currentHp}/${maxHp(healthy)}`,
    });
    expect(items[1]).toMatchObject({
      value: '1',
      label: displayName(fainted),
      sublabel: '0/' + maxHp(fainted),
    });
  });
});

/* --------------------------------------------------------- bagMenuItems -- */

describe('bagMenuItems', () => {
  it('drops entries with a zero count', () => {
    const items = bagMenuItems(
      [
        { id: 'potion', count: 0 },
        { id: 'super-potion', count: 2 },
      ],
      true,
    );
    expect(items.map((item) => item.value)).toEqual(['item-super-potion', 'back']);
  });

  it('drops items that cannot be used in battle or thrown', () => {
    const items = bagMenuItems(
      [
        { id: 'bike', count: 1 },
        { id: 'prismadex', count: 1 },
        { id: 'sigil-grass', count: 1 },
      ],
      true,
    );
    expect(items.map((item) => item.value)).toEqual(['back']);
  });

  it('shows the item name and count for usable items', () => {
    const [row] = bagMenuItems([{ id: 'x-attack', count: 3 }], true);
    expect(row).toMatchObject({
      value: 'item-x-attack',
      label: ITEMS['x-attack'].name,
      trailing: 'x3',
      disabled: false,
    });
  });

  it('keeps potions and other battle items enabled in trainer battles', () => {
    const items = bagMenuItems([{ id: 'potion', count: 1 }], false);
    expect(items[0].disabled).toBeFalsy();
  });

  it('enables orbs on wild creatures', () => {
    const [orb] = bagMenuItems([{ id: 'prism-orb', count: 5 }], true);
    expect(orb).toMatchObject({ value: 'item-prism-orb', disabled: false });
  });

  it('disables orbs in trainer battles, where catching is not allowed', () => {
    const [orb] = bagMenuItems([{ id: 'prism-orb', count: 5 }], false);
    expect(orb).toMatchObject({ value: 'item-prism-orb', trailing: 'x5', disabled: true });
  });

  it('always ends with a Back row', () => {
    const items = bagMenuItems(
      [
        { id: 'potion', count: 1 },
        { id: 'prism-orb', count: 2 },
      ],
      true,
    );
    expect(items[items.length - 1]).toEqual({ value: 'back', label: 'Back' });
  });

  it('preserves the order of the entries it was given', () => {
    const order: ItemId[] = ['x-attack', 'potion', 'prism-orb'];
    const items = bagMenuItems(
      order.map((id) => ({ id, count: 1 })),
      true,
    );
    expect(items.slice(0, -1).map((item) => item.value)).toEqual(order.map((id) => `item-${id}`));
  });

  it('shows only Back for an empty bag', () => {
    expect(bagMenuItems([], true)).toEqual([{ value: 'back', label: 'Back' }]);
  });
});

/* ------------------------------------------------------- learnMenuItems -- */

describe('learnMenuItems', () => {
  it('lists each known move with a pretty name and PP, then a skip row', () => {
    const items = learnMenuItems([
      { id: 'tackle', pp: 35, maxPp: 35 },
      { id: 'thunder-shock', pp: 30, maxPp: 30 },
    ]);
    expect(items).toEqual([
      { value: '0', label: 'Tackle', sublabel: '35/35' },
      { value: '1', label: 'Thunder Shock', sublabel: '30/30' },
      { value: 'skip', label: "Don't learn it" },
    ]);
  });

  it('offers only the skip row when there is nothing to learn from', () => {
    expect(learnMenuItems([])).toEqual([{ value: 'skip', label: "Don't learn it" }]);
  });
});

/* ------------------------------------------------------------ statLabel -- */

describe('statLabel', () => {
  it.each([
    ['attack', 'Attack'],
    ['defense', 'Defense'],
    ['spPower', 'Sp. Power'],
    ['spGuard', 'Sp. Guard'],
    ['speed', 'Speed'],
    ['accuracy', 'accuracy'],
    ['evasion', 'evasiveness'],
  ])('labels %s as %s', (stat, label) => {
    expect(statLabel(stat)).toBe(label);
  });

  it('returns unknown stats unchanged', () => {
    expect(statLabel('luck')).toBe('luck');
  });
});

/* ------------------------------------------------------------ prettyMove -- */

describe('prettyMove', () => {
  it('capitalises each hyphen-separated word', () => {
    expect(prettyMove('thunder-shock')).toBe('Thunder Shock');
    expect(prettyMove('x-attack')).toBe('X Attack');
  });

  it('capitalises a single word', () => {
    expect(prettyMove('tackle')).toBe('Tackle');
  });

  it('returns an empty string for an empty id', () => {
    expect(prettyMove('')).toBe('');
  });
});

/* ------------------------------------------------------- arenaBiomeFor -- */

describe('arenaBiomeFor', () => {
  it.each([
    ['emberleaf-town', 'meadow'],
    ['route-1', 'meadow'],
    ['whisperwood-forest', 'forest'],
    ['route-7', 'forest'],
    ['voltspire-city', 'city'],
    ['route-3', 'beach'],
    ['tidehaven', 'beach'],
    ['cinder-peak', 'volcano'],
    ['route-6', 'ruins'],
    ['glimmer-caverns', 'cave'],
    ['duskmoor-ruins', 'ruins'],
    ['prism-summit', 'summit'],
  ])('uses the %s arena for %s', (mapId, biome) => {
    expect(arenaBiomeFor(mapId)).toBe(biome);
  });

  it('falls back to meadow for a map it does not know', () => {
    expect(arenaBiomeFor('nowhere-special')).toBe('meadow');
    expect(arenaBiomeFor('')).toBe('meadow');
  });
});
