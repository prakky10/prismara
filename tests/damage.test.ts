import { describe, expect, it } from 'vitest';
import { createRNG } from '../src/core/SeededRNG';
import { createCreature, resetBattleState } from '../src/battle/Creature';
import {
  calculateDamage,
  critChance,
  effectivePower,
  hitChance,
  resolvedMoveType,
  weatherDamageMultiplier,
  type FieldContext,
} from '../src/battle/DamageCalc';
import { getMove } from '../src/data/moves';

const CONTEXT: FieldContext = { weather: 'clear', timeOfDay: 'day', isCave: false };

function fixedIvs() {
  return { hp: 15, attack: 15, defense: 15, spPower: 15, spGuard: 15, speed: 15 };
}

describe('damage formula', () => {
  it('produces a positive number for a connecting damaging move', () => {
    const rng = createRNG(1);
    const a = createCreature('emberkit', 10, { ivs: fixedIvs(), rng });
    const d = createCreature('drizzlet', 10, { ivs: fixedIvs(), rng });
    resetBattleState(a);
    resetBattleState(d);
    const result = calculateDamage(a, d, getMove('ember')!, { context: CONTEXT, rng });
    expect(result.damage).toBeGreaterThan(0);
  });

  it('increases with level', () => {
    const rng = createRNG(2);
    const low = createCreature('emberkit', 5, { ivs: fixedIvs(), rng });
    const high = createCreature('emberkit', 40, { ivs: fixedIvs(), rng });
    const target = createCreature('drizzlet', 30, { ivs: fixedIvs(), rng });
    const move = getMove('ember')!;
    const lowDmg = calculateDamage(low, target, move, { context: CONTEXT, rng }).damage;
    const highDmg = calculateDamage(high, target, move, { context: CONTEXT, rng }).damage;
    expect(highDmg).toBeGreaterThan(lowDmg);
  });

  it('applies 2x super effectiveness', () => {
    const rng = createRNG(3);
    // Water beats Fire.
    const water = createCreature('drizzlet', 30, { ivs: fixedIvs(), rng });
    const fire = createCreature('emberkit', 30, { ivs: fixedIvs(), rng });
    const result = calculateDamage(water, fire, getMove('splash-jet')!, { context: CONTEXT, rng });
    expect(result.effectiveness).toBe(2);
  });

  it('applies 0.5x when hitting a resistance', () => {
    const rng = createRNG(4);
    const fire = createCreature('emberkit', 30, { ivs: fixedIvs(), rng });
    const water = createCreature('drizzlet', 30, { ivs: fixedIvs(), rng });
    const result = calculateDamage(fire, water, getMove('ember')!, { context: CONTEXT, rng });
    expect(result.effectiveness).toBe(0.5);
  });

  it('returns zero for status moves', () => {
    const rng = createRNG(5);
    const a = createCreature('sproutle', 10, { ivs: fixedIvs(), rng });
    const d = createCreature('emberkit', 10, { ivs: fixedIvs(), rng });
    const result = calculateDamage(a, d, getMove('growl')!, { context: CONTEXT, rng });
    expect(result.damage).toBe(0);
  });

  it('crits deal more than non-crits with the same roll', () => {
    const rng = createRNG(6);
    const a = createCreature('infernyx', 50, { ivs: fixedIvs(), rng });
    const d = createCreature('grovetitan', 50, { ivs: fixedIvs(), rng });
    const move = getMove('flame-dash')!;
    const normal = calculateDamage(a, d, move, { context: CONTEXT, rng: createRNG(7), forceCrit: false });
    const crit = calculateDamage(a, d, move, { context: CONTEXT, rng: createRNG(7), forceCrit: true });
    expect(crit.damage).toBeGreaterThan(normal.damage);
    expect(crit.crit).toBe(true);
  });

  it('never deals less than 1 damage', () => {
    const rng = createRNG(8);
    const weak = createCreature('sproutle', 2, { ivs: { hp: 0, attack: 0, defense: 0, spPower: 0, spGuard: 0, speed: 0 }, rng });
    const wall = createCreature('grovetitan', 60, { ivs: fixedIvs(), rng });
    const result = calculateDamage(weak, wall, getMove('tackle')!, { context: CONTEXT, rng });
    expect(result.damage).toBeGreaterThanOrEqual(1);
  });
});

describe('crit rates', () => {
  it('matches the documented rates', () => {
    expect(critChance(0)).toBeCloseTo(1 / 16);
    expect(critChance(1)).toBeCloseTo(1 / 8);
    expect(critChance(2)).toBeCloseTo(0.5);
  });

  it('respects a defender with Lighthouse Shell (crit immunity)', () => {
    const rng = createRNG(9);
    const a = createCreature('nightfang', 40, { ivs: fixedIvs(), rng });
    const krabrine = createCreature('krabrine', 40, { ivs: fixedIvs(), rng });
    // Force crit; ability should suppress it.
    const result = calculateDamage(a, krabrine, getMove('shade-claw')!, {
      context: CONTEXT,
      rng,
      forceCrit: true,
    });
    expect(result.crit).toBe(false);
  });
});

describe('weather', () => {
  it('boosts Fire in sunlight and weakens Water', () => {
    expect(weatherDamageMultiplier('sunny', 'fire')).toBe(1.5);
    expect(weatherDamageMultiplier('sunny', 'water')).toBe(0.5);
  });

  it('boosts Water in rain and weakens Fire', () => {
    expect(weatherDamageMultiplier('rain', 'water')).toBe(1.5);
    expect(weatherDamageMultiplier('rain', 'fire')).toBe(0.5);
  });

  it('leaves other types alone', () => {
    expect(weatherDamageMultiplier('rain', 'grass')).toBe(1);
    expect(weatherDamageMultiplier('sunny', 'shadow')).toBe(1);
  });
});

describe('accuracy', () => {
  it('always hits with a bypass move', () => {
    const rng = createRNG(10);
    const a = createCreature('emberkit', 20, { ivs: fixedIvs(), rng });
    const d = createCreature('drizzlet', 20, { ivs: fixedIvs(), rng });
    expect(hitChance(getMove('sunny-aura')!, a, d, CONTEXT)).toBe(1);
  });

  it('is reduced when the target has evasion stages', () => {
    const rng = createRNG(11);
    const a = createCreature('emberkit', 20, { ivs: fixedIvs(), rng });
    const d = createCreature('drizzlet', 20, { ivs: fixedIvs(), rng });
    const before = hitChance(getMove('ember')!, a, d, CONTEXT);
    d.stages.evasion = 2;
    const after = hitChance(getMove('ember')!, a, d, CONTEXT);
    expect(after).toBeLessThan(before);
  });

  it('always hits with Electric in the rain', () => {
    const rng = createRNG(12);
    const a = createCreature('sparkit', 20, { ivs: fixedIvs(), rng });
    const d = createCreature('drizzlet', 20, { ivs: fixedIvs(), rng });
    const ctx: FieldContext = { ...CONTEXT, weather: 'rain' };
    expect(hitChance(getMove('thunderfall')!, a, d, ctx)).toBe(1);
  });
});

describe('move tags', () => {
  it('Spectrum Burst picks the best element against the target', () => {
    const rng = createRNG(13);
    const water = createCreature('drizzlet', 20, { ivs: fixedIvs(), rng });
    const move = getMove('spectrum-burst')!;
    // Against Water the best element is Grass or Electric (2x).
    const type = resolvedMoveType(move, water);
    expect(['grass', 'electric']).toContain(type);
  });

  it('doubles power against a statused target (Hex Bite)', () => {
    const rng = createRNG(14);
    const a = createCreature('nightfang', 30, { ivs: fixedIvs(), rng });
    const d = createCreature('drizzlet', 30, { ivs: fixedIvs(), rng });
    const move = getMove('hex-bite')!;
    const before = effectivePower(move, a, d).power;
    d.status = 'burn';
    const after = effectivePower(move, a, d).power;
    expect(after).toBe(before * 2);
  });

  it('boosts Chain Lightning against a Soaked target', () => {
    const rng = createRNG(15);
    const a = createCreature('fulminx', 30, { ivs: fixedIvs(), rng });
    const d = createCreature('drizzlet', 30, { ivs: fixedIvs(), rng });
    const move = getMove('chain-lightning')!;
    const before = effectivePower(move, a, d).power;
    d.volatiles.soaked = true;
    const after = effectivePower(move, a, d).power;
    expect(after).toBeGreaterThan(before);
  });
});
