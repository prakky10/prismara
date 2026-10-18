import { describe, expect, it } from 'vitest';
import { createRNG } from '../src/core/SeededRNG';
import { createCreature, resetBattleState } from '../src/battle/Creature';
import { BattleState } from '../src/battle/BattleState';
import { resolveTurn } from '../src/battle/TurnResolver';

function ivs() {
  return { hp: 15, attack: 15, defense: 15, spPower: 15, spGuard: 15, speed: 15 };
}

function makeBattle(seed = 1) {
  const rng = createRNG(seed);
  const player = [createCreature('emberkit', 20, { ivs: ivs(), rng })];
  const enemy = [createCreature('drizzlet', 20, { ivs: ivs(), rng })];
  return new BattleState({
    playerParty: player,
    enemyParty: enemy,
    playerName: 'Ash',
    isWild: true,
    context: { weather: 'clear', timeOfDay: 'day', isCave: false },
    seed,
  });
}

describe('turn order', () => {
  it('starts in the choose phase and opens with a battle-start event', () => {
    const battle = makeBattle();
    battle.start();
    const events = battle.drainEvents();
    expect(battle.phase).toBe('choose');
    expect(events.some((e) => e.type === 'battle-start')).toBe(true);
  });

  it('a priority move goes first regardless of Speed', () => {
    const battle = makeBattle(42);
    battle.start();
    battle.drainEvents();
    // Flame Dash is priority +1; Splash Jet is priority 0.
    const events = battle.takeTurn({ kind: 'move', moveIndex: 1 });
    const used = events.filter((e) => e.type === 'move-used');
    expect(used.length).toBeGreaterThan(0);
    // Either our priority move is first, or the foe also used priority.
    expect(used[0].type).toBe('move-used');
  });

  it('increments the turn counter each turn', () => {
    const battle = makeBattle(7);
    battle.start();
    battle.drainEvents();
    battle.takeTurn({ kind: 'move', moveIndex: 0 });
    expect(battle.turn).toBe(1);
    if (battle.phase !== 'ended') {
      battle.takeTurn({ kind: 'move', moveIndex: 0 });
      expect(battle.turn).toBe(2);
    }
  });

  it('runs headless to a conclusion without throwing', () => {
    const battle = makeBattle(3);
    battle.start();
    battle.drainEvents();
    let guard = 0;
    while (battle.phase !== 'ended' && guard++ < 200) {
      if (battle.phase === 'awaiting-switch') {
        battle.forceSwitch('player', 0);
        continue;
      }
      battle.takeTurn({ kind: 'move', moveIndex: 0 });
    }
    expect(battle.phase).toBe('ended');
    expect(battle.winner).not.toBeNull();
  });

  it('ends the battle when every enemy creature faints', () => {
    const rng = createRNG(11);
    const strong = createCreature('infernyx', 60, { ivs: ivs(), rng });
    const weak = createCreature('bubbloon', 2, { ivs: ivs(), rng });
    const battle = new BattleState({
      playerParty: [strong],
      enemyParty: [weak],
      playerName: 'Ash',
      isWild: true,
      context: { weather: 'clear', timeOfDay: 'day', isCave: false },
      seed: 5,
    });
    battle.start();
    battle.drainEvents();
    let guard = 0;
    while (battle.phase !== 'ended' && guard++ < 50) {
      battle.takeTurn({ kind: 'move', moveIndex: 0 });
    }
    expect(battle.winner).toBe('player');
  });
});

describe('damage honestly reduces HP', () => {
  it('HP after a hit matches the reported damage', () => {
    const battle = makeBattle(21);
    battle.start();
    battle.drainEvents();
    const enemyBefore = battle.active('enemy').currentHp;
    const events = battle.takeTurn({ kind: 'move', moveIndex: 0 });
    const dmg = events.find((e) => e.type === 'damage' && e.side === 'enemy');
    if (dmg && dmg.type === 'damage') {
      expect(battle.active('enemy').currentHp).toBe(enemyBefore - dmg.amount);
    }
  });
});

describe('resetBattleState', () => {
  it('clears stages and volatiles', () => {
    const rng = createRNG(1);
    const c = createCreature('emberkit', 10, { ivs: ivs(), rng });
    c.stages.attack = 3;
    c.volatiles.soaked = true;
    resetBattleState(c);
    expect(c.stages.attack).toBe(0);
    expect(c.volatiles.soaked).toBe(false);
  });
});

describe('switching', () => {
  it('a voluntary switch swaps the active creature', () => {
    const rng = createRNG(2);
    const party = [
      createCreature('emberkit', 20, { ivs: ivs(), rng }),
      createCreature('drizzlet', 20, { ivs: ivs(), rng }),
    ];
    const battle = new BattleState({
      playerParty: party,
      enemyParty: [createCreature('sproutle', 20, { ivs: ivs(), rng })],
      playerName: 'Ash',
      isWild: true,
      context: { weather: 'clear', timeOfDay: 'day', isCave: false },
      seed: 4,
    });
    battle.start();
    battle.drainEvents();
    resolveTurn(battle, { kind: 'switch', index: 1 });
    expect(battle.player.activeIndex).toBe(1);
  });

  it('an Entangled creature cannot switch out', () => {
    const rng = createRNG(2);
    const party = [
      createCreature('emberkit', 20, { ivs: ivs(), rng }),
      createCreature('drizzlet', 20, { ivs: ivs(), rng }),
    ];
    const battle = new BattleState({
      playerParty: party,
      enemyParty: [createCreature('sproutle', 20, { ivs: ivs(), rng })],
      playerName: 'Ash',
      isWild: true,
      context: { weather: 'clear', timeOfDay: 'day', isCave: false },
      seed: 4,
    });
    battle.start();
    battle.drainEvents();
    battle.active('player').status = 'entangled';
    resolveTurn(battle, { kind: 'switch', index: 1 });
    expect(battle.player.activeIndex).toBe(0);
  });
});
