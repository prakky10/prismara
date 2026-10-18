import { describe, expect, it } from 'vitest';
import { createRNG } from '../src/core/SeededRNG';
import {
  createCreature,
  expProgress,
  gainExp,
  maxHp,
  movesForLevel,
  statBlock,
} from '../src/battle/Creature';
import {
  applyExp,
  calcHp,
  calcStat,
  expAward,
  expForLevel,
  expToNextLevel,
  MAX_LEVEL,
  stageMultiplier,
  accuracyMultiplier,
} from '../src/battle/stats';
import { getSpecies } from '../src/data/creatures';

function ivs() {
  return { hp: 15, attack: 15, defense: 15, spPower: 15, spGuard: 15, speed: 15 };
}

describe('experience curve', () => {
  it('is the cubic medium-fast curve (n^3)', () => {
    expect(expForLevel(1)).toBe(1);
    expect(expForLevel(10)).toBe(1000);
    expect(expForLevel(50)).toBe(125000);
  });

  it('never returns a negative requirement', () => {
    for (let lvl = 1; lvl < MAX_LEVEL; lvl++) {
      expect(expToNextLevel(lvl)).toBeGreaterThan(0);
    }
  });

  it('levels up when enough XP is banked', () => {
    const result = applyExp(5, 0, expToNextLevel(5));
    expect(result.level).toBe(6);
    expect(result.expIntoLevel).toBe(0);
  });

  it('carries surplus XP into the next level', () => {
    const result = applyExp(5, 0, expToNextLevel(5) + 10);
    expect(result.level).toBe(6);
    expect(result.expIntoLevel).toBe(10);
  });

  it('stops at the level cap', () => {
    const result = applyExp(MAX_LEVEL, 0, 10_000_000);
    expect(result.level).toBe(MAX_LEVEL);
    expect(result.expIntoLevel).toBe(0);
  });

  it('awards more XP for a higher-level foe', () => {
    expect(expAward(100, 30)).toBeGreaterThan(expAward(100, 10));
  });
});

describe('stat formulas', () => {
  it('matches the documented HP formula', () => {
    expect(calcHp(45, 15, 10)).toBe(Math.floor(((2 * 45 + 15) * 10) / 100) + 10 + 10);
  });

  it('matches the documented non-HP formula', () => {
    expect(calcStat(60, 15, 10)).toBe(Math.floor(((2 * 60 + 15) * 10) / 100) + 5);
  });

  it('scales HP and stats with level', () => {
    const rng = createRNG(1);
    const low = createCreature('emberkit', 5, { ivs: ivs(), rng });
    const high = createCreature('emberkit', 50, { ivs: ivs(), rng });
    expect(maxHp(high)).toBeGreaterThan(maxHp(low));
    expect(statBlock(high).attack).toBeGreaterThan(statBlock(low).attack);
  });
});

describe('stage multipliers', () => {
  it('follows (2+s)/2 above zero', () => {
    expect(stageMultiplier(0)).toBe(1);
    expect(stageMultiplier(1)).toBe(1.5);
    expect(stageMultiplier(2)).toBe(2);
    expect(stageMultiplier(6)).toBe(4);
  });

  it('follows 2/(2-s) below zero', () => {
    expect(stageMultiplier(-1)).toBeCloseTo(2 / 3);
    expect(stageMultiplier(-2)).toBeCloseTo(0.5);
    expect(stageMultiplier(-6)).toBeCloseTo(0.25);
  });

  it('clamps beyond +-6', () => {
    expect(stageMultiplier(99)).toBe(stageMultiplier(6));
    expect(stageMultiplier(-99)).toBe(stageMultiplier(-6));
  });

  it('uses thirds for accuracy and evasion', () => {
    expect(accuracyMultiplier(0)).toBe(1);
    expect(accuracyMultiplier(3)).toBe(2);
    expect(accuracyMultiplier(-3)).toBeCloseTo(0.5);
  });
});

describe('gainExp on a creature', () => {
  it('raises the level and reports the change', () => {
    const rng = createRNG(2);
    const c = createCreature('emberkit', 10, { ivs: ivs(), rng });
    const result = gainExp(c, expToNextLevel(10) + 1);
    expect(result.levelsGained).toBe(1);
    expect(c.level).toBe(11);
  });

  it('keeps HP within the new maximum after levelling', () => {
    const rng = createRNG(2);
    const c = createCreature('emberkit', 10, { ivs: ivs(), rng });
    c.currentHp = maxHp(c);
    gainExp(c, expToNextLevel(10));
    expect(c.currentHp).toBeLessThanOrEqual(maxHp(c));
    expect(c.currentHp).toBeGreaterThan(0);
  });

  it('marks an evolution pending at the evolution level', () => {
    const rng = createRNG(3);
    const c = createCreature('emberkit', 15, { ivs: ivs(), rng });
    const result = gainExp(c, expToNextLevel(15));
    expect(c.level).toBe(16);
    expect(result.evolutionPending).toBe('pyrolynx');
  });

  it('does not evolve before the required level', () => {
    const rng = createRNG(3);
    const c = createCreature('emberkit', 10, { ivs: ivs(), rng });
    gainExp(c, expToNextLevel(10));
    expect(c.pendingEvolution).toBeNull();
  });

  it('reports EXP progress between 0 and 1', () => {
    const rng = createRNG(4);
    const c = createCreature('emberkit', 10, { ivs: ivs(), rng });
    expect(expProgress(c)).toBeGreaterThanOrEqual(0);
    expect(expProgress(c)).toBeLessThanOrEqual(1);
  });
});

describe('learnsets', () => {
  it('gives a level-1 creature at least one move', () => {
    for (const id of ['emberkit', 'drizzlet', 'sproutle']) {
      const species = getSpecies(id);
      expect(movesForLevel(species, 1).length).toBeGreaterThan(0);
    }
  });

  it('never returns more than four starting moves', () => {
    const species = getSpecies('infernyx');
    expect(movesForLevel(species, 60).length).toBeLessThanOrEqual(4);
  });
});
