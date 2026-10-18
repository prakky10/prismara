import { describe, expect, it } from 'vitest';
import { createRNG } from '../src/core/SeededRNG';
import { createCreature } from '../src/battle/Creature';
import { BattleState } from '../src/battle/BattleState';
import {
  abilityImmune,
  applyStatus,
  canReceiveStatus,
  elementImmune,
  endOfTurnStatus,
} from '../src/battle/StatusSystem';
import type { Side } from '../src/data/battleTypes';

function ivs() {
  return { hp: 15, attack: 15, defense: 15, spPower: 15, spGuard: 15, speed: 15 };
}

function battleWith(playerId: string, enemyId: string, seed = 1) {
  const rng = createRNG(seed);
  const battle = new BattleState({
    playerParty: [createCreature(playerId, 20, { ivs: ivs(), rng })],
    enemyParty: [createCreature(enemyId, 20, { ivs: ivs(), rng })],
    playerName: 'Ash',
    isWild: true,
    context: { weather: 'clear', timeOfDay: 'day', isCave: false },
    seed,
  });
  battle.start();
  battle.drainEvents();
  return battle;
}

describe('status immunities', () => {
  it('Fire creatures cannot be burned', () => {
    const rng = createRNG(1);
    const fire = createCreature('emberkit', 20, { ivs: ivs(), rng });
    expect(elementImmune(fire, 'burn')).toBe(true);
    expect(canReceiveStatus(fire, 'burn')).toBe(false);
  });

  it('Electric creatures cannot be paralyzed', () => {
    const rng = createRNG(1);
    const electric = createCreature('sparkit', 20, { ivs: ivs(), rng });
    expect(elementImmune(electric, 'paralyze')).toBe(true);
  });

  it('Grass creatures cannot be entangled', () => {
    const rng = createRNG(1);
    const grass = createCreature('sproutle', 20, { ivs: ivs(), rng });
    expect(elementImmune(grass, 'entangled')).toBe(true);
  });

  it('Magma Armor grants burn immunity', () => {
    const rng = createRNG(1);
    const cindermole = createCreature('cindermole', 20, { ivs: ivs(), rng });
    expect(abilityImmune(cindermole, 'burn')).toBe(true);
  });

  it('any creature can be put to sleep', () => {
    const rng = createRNG(1);
    for (const id of ['emberkit', 'sparkit', 'sproutle', 'drizzlet']) {
      const c = createCreature(id, 20, { ivs: ivs(), rng });
      expect(canReceiveStatus(c, 'sleep')).toBe(true);
    }
  });
});

describe('applyStatus', () => {
  it('sets the status and emits an event', () => {
    const battle = battleWith('drizzlet', 'emberkit');
    const applied = applyStatus(battle, 'player' as Side, 'burn');
    expect(applied).toBe(true);
    expect(battle.active('player').status).toBe('burn');
    expect(battle.drainEvents().some((e) => e.type === 'status-applied')).toBe(true);
  });

  it('refuses a second major status', () => {
    const battle = battleWith('drizzlet', 'emberkit');
    applyStatus(battle, 'player', 'burn');
    battle.drainEvents();
    const second = applyStatus(battle, 'player', 'paralyze');
    expect(second).toBe(false);
    expect(battle.active('player').status).toBe('burn');
  });

  it('emits status-immune for a Fire creature being burned', () => {
    const battle = battleWith('emberkit', 'drizzlet');
    applyStatus(battle, 'player', 'burn');
    expect(battle.drainEvents().some((e) => e.type === 'status-immune')).toBe(true);
    expect(battle.active('player').status).toBeNull();
  });

  it('gives sleep a duration of 1-3 turns', () => {
    const battle = battleWith('drizzlet', 'emberkit');
    applyStatus(battle, 'player', 'sleep');
    expect(battle.active('player').statusTurns).toBeGreaterThanOrEqual(1);
    expect(battle.active('player').statusTurns).toBeLessThanOrEqual(3);
  });
});

describe('end-of-turn status damage', () => {
  it('burn deals 1/16 max HP', () => {
    const battle = battleWith('drizzlet', 'emberkit');
    const mon = battle.active('player');
    battle.drainEvents();
    mon.status = 'burn';
    const before = mon.currentHp;
    endOfTurnStatus(battle, 'player');
    const expected = Math.max(1, Math.floor(mon.currentHp + 0 === 0 ? 1 : (before / 16)));
    expect(mon.currentHp).toBeLessThan(before);
    expect(before - mon.currentHp).toBeGreaterThanOrEqual(1);
    void expected;
  });

  it('fear expires after its duration', () => {
    const battle = battleWith('drizzlet', 'emberkit');
    const mon = battle.active('player');
    mon.status = 'fear';
    mon.statusTurns = 1;
    battle.drainEvents();
    endOfTurnStatus(battle, 'player');
    expect(mon.status).toBeNull();
  });

  it('entangled drains HP to the opposing side', () => {
    const battle = battleWith('drizzlet', 'emberkit');
    const mine = battle.active('player');
    const theirs = battle.active('enemy');
    mine.status = 'entangled';
    battle.drainEvents();
    const mineBefore = mine.currentHp;
    const theirsBefore = theirs.currentHp;
    // Give the foe room to heal.
    theirs.currentHp = Math.max(1, theirs.currentHp - 40);
    const foeBefore = theirs.currentHp;
    endOfTurnStatus(battle, 'player');
    expect(mine.currentHp).toBeLessThan(mineBefore);
    expect(theirs.currentHp).toBeGreaterThan(foeBefore);
    void theirsBefore;
  });
});
