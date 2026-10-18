import { describe, expect, it } from 'vitest';
import {
  CREATURES,
  CREATURE_IDS,
  DEX_ORDER,
  LEGENDARIES,
  MYTHICALS,
  STARTERS,
  bst,
  evolutionLine,
  getSpecies,
  totalDexCount,
} from '../src/data/creatures';
import { ABILITIES } from '../src/data/abilities';
import { ITEMS, ITEM_IDS } from '../src/data/items';
import { MOVES, MOVE_IDS, getMove, isDamaging } from '../src/data/moves';
import { ELEMENTS, MOVE_TYPES, ELEMENT_INFO } from '../src/data/types';

describe('the Prismadex', () => {
  it('contains exactly 40 creatures', () => {
    expect(totalDexCount()).toBe(40);
    expect(CREATURE_IDS).toHaveLength(40);
  });

  it('numbers the dex 1..40 with no gaps or duplicates', () => {
    const numbers = CREATURE_IDS.map((id) => getSpecies(id).dexNumber).sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: 40 }, (_, i) => i + 1));
  });

  it('orders the dex by dex number', () => {
    const numbers = DEX_ORDER.map((id) => getSpecies(id).dexNumber);
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
  });

  it('gives every creature a valid element', () => {
    for (const id of CREATURE_IDS) {
      expect(ELEMENTS).toContain(getSpecies(id).element);
    }
  });

  it('gives every creature a known ability', () => {
    for (const id of CREATURE_IDS) {
      const species = getSpecies(id);
      expect(ABILITIES[species.ability], `${id} -> ${species.ability}`).toBeDefined();
    }
  });

  it('gives every creature only known moves in its learnset', () => {
    for (const id of CREATURE_IDS) {
      for (const entry of getSpecies(id).learnset) {
        expect(MOVES[entry.move], `${id} learns unknown move ${entry.move}`).toBeDefined();
      }
    }
  });

  it('gives every creature 8-10 learnset entries', () => {
    for (const id of CREATURE_IDS) {
      const count = getSpecies(id).learnset.length;
      expect(count, `${id} has ${count} moves`).toBeGreaterThanOrEqual(6);
      expect(count, `${id} has ${count} moves`).toBeLessThanOrEqual(11);
    }
  });

  it('points every evolution at a real creature at a higher level', () => {
    for (const id of CREATURE_IDS) {
      const species = getSpecies(id);
      if (!species.evolution) continue;
      const into = getSpecies(species.evolution.into);
      expect(into).toBeDefined();
      expect(species.evolution.level).toBeGreaterThan(0);
      expect(species.evolution.level).toBeLessThanOrEqual(60);
    }
  });

  it('keeps base stat totals inside their tier band', () => {
    const bands: Record<string, [number, number]> = {
      basic: [290, 315],
      stage2: [400, 420],
      stage3: [510, 530],
      single: [440, 460],
      pseudo: [530, 550],
      legendary: [595, 605],
      mythical: [635, 645],
    };
    for (const id of CREATURE_IDS) {
      const species = getSpecies(id);
      const [min, max] = bands[species.tier];
      const total = bst(species);
      expect(total, `${id} (${species.tier}) has BST ${total}`).toBeGreaterThanOrEqual(min);
      expect(total, `${id} (${species.tier}) has BST ${total}`).toBeLessThanOrEqual(max);
    }
  });

  it('never gives a creature a negative or zero stat', () => {
    for (const id of CREATURE_IDS) {
      const s = getSpecies(id).baseStats;
      for (const value of Object.values(s)) expect(value).toBeGreaterThan(0);
    }
  });

  it('references a real signature move for creatures that declare one', () => {
    for (const id of CREATURE_IDS) {
      const species = getSpecies(id);
      if (!species.signatureMove) continue;
      expect(MOVES[species.signatureMove], `${id} -> ${species.signatureMove}`).toBeDefined();
    }
  });

  it('links signature moves back to their creature', () => {
    for (const id of CREATURE_IDS) {
      const species = getSpecies(id);
      if (!species.signatureMove) continue;
      const move = getMove(species.signatureMove)!;
      expect(move.signatureOf).toBe(id);
    }
  });

  it('has three starters that are all basic evolution-line roots', () => {
    expect(STARTERS).toHaveLength(3);
    for (const id of STARTERS) {
      expect(evolutionLine(id)).toHaveLength(3);
    }
  });

  it('knows its legendaries and mythicals', () => {
    expect(LEGENDARIES).toHaveLength(2);
    expect(MYTHICALS).toHaveLength(1);
    for (const id of [...LEGENDARIES, ...MYTHICALS]) {
      expect(CREATURES[id]).toBeDefined();
    }
  });

  it('gives legendary and mythical creatures very low catch rates', () => {
    for (const id of [...LEGENDARIES, ...MYTHICALS]) {
      expect(getSpecies(id).catchRate).toBeLessThanOrEqual(5);
    }
  });
});

describe('moves', () => {
  it('defines every move with a name and description', () => {
    for (const id of MOVE_IDS) {
      const move = MOVES[id];
      expect(move.name.length).toBeGreaterThan(0);
      expect(move.description.length).toBeGreaterThan(0);
      expect(move.pp).toBeGreaterThan(0);
    }
  });

  it('uses a valid move type for every move', () => {
    for (const id of MOVE_IDS) {
      expect(MOVE_TYPES).toContain(MOVES[id].type);
    }
  });

  it('gives status moves zero power and damaging moves positive power', () => {
    for (const id of MOVE_IDS) {
      const move = MOVES[id];
      if (move.category === 'status') expect(move.power).toBe(0);
      else expect(move.power).toBeGreaterThan(0);
    }
  });

  it('provides at least 8 moves of every element', () => {
    for (const element of ELEMENTS) {
      const count = MOVE_IDS.filter((id) => MOVES[id].type === element).length;
      expect(count, `${element} has ${count} moves`).toBeGreaterThanOrEqual(8);
    }
  });

  it('has 8 Neutral moves', () => {
    const neutral = MOVE_IDS.filter((id) => MOVES[id].type === 'neutral');
    // 8 neutral moves plus Spectrum Burst, which is Neutral by design.
    expect(neutral.length).toBeGreaterThanOrEqual(8);
  });

  it('defines at least 55 moves in total', () => {
    expect(MOVE_IDS.length).toBeGreaterThanOrEqual(55);
  });

  it('agrees with isDamaging', () => {
    for (const id of MOVE_IDS) {
      const move = MOVES[id];
      expect(isDamaging(move)).toBe(move.category !== 'status' && move.power > 0);
    }
  });
});

describe('types', () => {
  it('has display info for every move type', () => {
    for (const type of MOVE_TYPES) {
      const info = ELEMENT_INFO[type];
      expect(info).toBeDefined();
      expect(info.hex).toMatch(/^#[0-9A-F]{6}$/i);
      expect(info.name.length).toBeGreaterThan(0);
    }
  });
});

describe('items', () => {
  it('gives every item a name, description and non-negative price', () => {
    for (const id of ITEM_IDS) {
      const item = ITEMS[id];
      expect(item.name.length).toBeGreaterThan(0);
      expect(item.description.length).toBeGreaterThan(0);
      expect(item.price).toBeGreaterThanOrEqual(0);
    }
  });

  it('has exactly one Master Prism', () => {
    const masters = ITEM_IDS.filter(
      (id) => ITEMS[id].effect.kind === 'orb' && ITEMS[id].effect.master === true,
    );
    expect(masters).toEqual(['master-prism']);
  });

  it('provides all six sigils as key items', () => {
    const sigils = ITEM_IDS.filter((id) => id.startsWith('sigil-'));
    expect(sigils).toHaveLength(6);
  });
});
