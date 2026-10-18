import { describe, expect, it } from 'vitest';
import type { ItemId } from '../src/data/items';
import { createRNG } from '../src/core/SeededRNG';
import { createCreature } from '../src/battle/Creature';
import {
  attemptCapture,
  catchOddsPercent,
  orbBonus,
  shakeProbability,
  statusCatchBonus,
} from '../src/battle/CaptureCalc';

function ivs() {
  return { hp: 15, attack: 15, defense: 15, spPower: 15, spGuard: 15, speed: 15 };
}

function target(id = 'drizzlet', level = 10) {
  return createCreature(id, level, { ivs: ivs(), rng: createRNG(1) });
}

describe('status catch bonus', () => {
  it('rewards sleep the most', () => {
    expect(statusCatchBonus('sleep')).toBe(2.5);
    expect(statusCatchBonus('entangled')).toBe(2);
    expect(statusCatchBonus('burn')).toBe(1.5);
    expect(statusCatchBonus(null)).toBe(1);
  });
});

describe('orb bonuses', () => {
  it('gives the Dusk Orb its bonus only in the dark', () => {
    expect(orbBonus('dusk-orb', false, false)).toBe(1);
    expect(orbBonus('dusk-orb', true, false)).toBe(3);
    expect(orbBonus('dusk-orb', false, true)).toBe(3);
  });

  it('applies the Great and Luxe Prism bonuses', () => {
    expect(orbBonus('great-prism', false, false)).toBe(1.5);
    expect(orbBonus('luxe-orb', false, false)).toBe(2);
  });

  it('adds the expanded situational orb set', () => {
    expect(orbBonus('ultra-prism', false, false)).toBe(2);
    expect(orbBonus('tide-orb', false, false, { targetElement: 'water' })).toBe(3);
    expect(orbBonus('tide-orb', false, false, { targetElement: 'grass' })).toBe(1);
    expect(orbBonus('bloom-orb', false, false, { targetElement: 'grass' })).toBe(3);
    expect(orbBonus('bloom-orb', false, false, { targetElement: 'water' })).toBe(1);
    expect(orbBonus('quick-orb', false, false, { turn: 0 })).toBe(4);
    expect(orbBonus('quick-orb', false, false, { turn: 1 })).toBe(1);
    expect(orbBonus('nest-orb', false, false, { targetLevel: 15 })).toBe(3);
    expect(orbBonus('nest-orb', false, false, { targetLevel: 16 })).toBe(1);
  });

  it('scales the Timer Orb and caps it at 4x', () => {
    expect(orbBonus('timer-orb', false, false, { turn: 0 })).toBe(1);
    expect(orbBonus('timer-orb', false, false, { turn: 1 })).toBeCloseTo(1.3, 5);
    expect(orbBonus('timer-orb', false, false, { turn: 10 })).toBe(4);
    expect(orbBonus('timer-orb', false, false, { turn: 50 })).toBe(4);
  });
});

describe('shake probability', () => {
  it('is clamped to 0..1 and increases with the catch value', () => {
    expect(shakeProbability(0)).toBe(0);
    expect(shakeProbability(-5)).toBe(0);
    expect(shakeProbability(255)).toBe(1);
    expect(shakeProbability(1000)).toBe(1);
    expect(shakeProbability(50)).toBeLessThan(shakeProbability(150));
  });
});

describe('attemptCapture', () => {
  it('always succeeds with a Master Prism', () => {
    const rng = createRNG(5);
    const result = attemptCapture(target('solarion', 50), 'master-prism', {
      isNight: false,
      isCave: false,
      rng,
    });
    expect(result.caught).toBe(true);
    expect(result.shakes).toBe(3);
  });

  it('is easier for a weakened creature', () => {
    const species = 'thundrake';
    const healthy = target(species, 30);
    const weakened = target(species, 30);
    weakened.currentHp = 1;
    const healthyOdds = catchOddsPercent(healthy, 'prism-orb', false, false);
    const weakenedOdds = catchOddsPercent(weakened, 'prism-orb', false, false);
    expect(weakenedOdds).toBeGreaterThan(healthyOdds);
  });

  it('is harder for a legendary than a common creature', () => {
    const legendary = catchOddsPercent(target('eclipsor', 50), 'prism-orb', false, false);
    const common = catchOddsPercent(target('sparkit', 10), 'prism-orb', false, false);
    expect(legendary).toBeLessThan(common);
  });

  it('reports between 0 and 3 shakes', () => {
    const rng = createRNG(9);
    for (let i = 0; i < 50; i++) {
      const result = attemptCapture(target('bubbloon', 20), 'prism-orb', {
        isNight: false,
        isCave: false,
        rng,
      });
      expect(result.shakes).toBeGreaterThanOrEqual(0);
      expect(result.shakes).toBeLessThanOrEqual(3);
    }
  });

  it('sleeping targets are caught more often than healthy ones', () => {
    const asleep = target('glimmoth', 20);
    asleep.status = 'sleep';
    const awake = target('glimmoth', 20);
    expect(catchOddsPercent(asleep, 'prism-orb', false, false)).toBeGreaterThan(
      catchOddsPercent(awake, 'prism-orb', false, false),
    );
  });

  it('gives the Quick Orb its bonus on the first throw only', () => {
    const mon = target('bubbloon', 20);
    const first = attemptCapture(mon, 'quick-orb', {
      isNight: false,
      isCave: false,
      rng: createRNG(3),
    });
    const later = attemptCapture(mon, 'quick-orb', {
      isNight: false,
      isCave: false,
      rng: createRNG(3),
      turn: 1,
    });
    expect(first.catchValue).toBeGreaterThan(later.catchValue);
  });

  it('never captures a fainted target, even with a Master Prism', () => {
    const fainted = target('solarion', 50);
    fainted.currentHp = 0;
    const result = attemptCapture(fainted, 'master-prism', {
      isNight: false,
      isCave: false,
      rng: createRNG(1),
    });
    expect(result.caught).toBe(false);
    expect(result.shakes).toBe(0);
    expect(catchOddsPercent(fainted, 'master-prism', false, false)).toBe(0);
  });

  it('reports 100% odds for the Master Prism', () => {
    expect(catchOddsPercent(target('solarion', 50), 'master-prism', false, false)).toBe(100);
  });

  it('rejects items that are not capture orbs', () => {
    const mon = target();
    expect(() =>
      attemptCapture(mon, 'potion' as ItemId, {
        isNight: false,
        isCave: false,
        rng: createRNG(1),
      }),
    ).toThrow();
    expect(() =>
      attemptCapture(mon, 'not-a-real-item' as ItemId, {
        isNight: false,
        isCave: false,
        rng: createRNG(1),
      }),
    ).toThrow();
  });
});
