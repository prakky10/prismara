/**
 * Turn resolution: the rules of engagement.
 *
 * A turn is:
 *   1. Non-move actions (switches, items, orbs, fleeing) resolve first.
 *   2. Moves resolve in order of priority, then Speed, then a coin flip.
 *   3. End-of-turn effects (burn, roots, weather, durations) run.
 *
 * Everything mutates the `BattleState` and announces itself through events.
 */

import {
  abilityOf,
  addMove,
  applyStage,
  damage,
  displayName,
  effectiveStat,
  gainExp,
  hasAbility,
  hasRoomForMove,
  heal,
  isFainted,
  maxHp,
  replaceMove,
  speciesOf,
  type CreatureInstance,
} from './Creature';
import { calculateDamage, hitChance, recoilDamage } from './DamageCalc';
import { expAward, MAX_LEVEL } from './stats';
import { getMove, type MoveData } from '../data/moves';
import { ITEMS, type ItemId } from '../data/items';
import { STATUS_IDS, type Side, type StageId, type StatusId, type VolatileId } from '../data/battleTypes';
import { attemptCapture } from './CaptureCalc';
import type { BattleState } from './BattleState';
import { chooseAIAction } from './AI';
import { applyStatus, endOfTurnStatus, forceStatus, tickSleep } from './StatusSystem';
import { setWeather } from './Weather';

export type BattleAction =
  | { kind: 'move'; moveIndex: number }
  | { kind: 'switch'; index: number }
  | { kind: 'item'; itemId: ItemId; targetIndex: number }
  | { kind: 'orb'; itemId: ItemId }
  | { kind: 'flee' }
  | { kind: 'forfeit' };

type MoveAction = Extract<BattleAction, { kind: 'move' }>;

/* --------------------------------------------------------------- entry -- */

export function resolveTurn(state: BattleState, playerAction: BattleAction): void {
  if (state.isOver) return;

  state.emit({ type: 'turn-start', turn: state.turn + 1 });

  if (playerAction.kind === 'forfeit') {
    state.endBattle('enemy', 'forfeit');
    return;
  }

  const enemyAction = chooseAIAction(state, 'enemy');

  // --- Step 1: non-move actions, player first. ---
  if (playerAction.kind !== 'move') {
    runNonMove(state, 'player', playerAction);
    if (state.isOver) return;
  }
  if (enemyAction.kind !== 'move') {
    runNonMove(state, 'enemy', enemyAction);
    if (state.isOver) return;
  }

  // --- Step 2: moves. ---
  const acts: Array<{ side: Side; action: MoveAction }> = [];
  if (playerAction.kind === 'move') acts.push({ side: 'player', action: playerAction });
  if (enemyAction.kind === 'move') acts.push({ side: 'enemy', action: enemyAction });

  acts.sort((a, b) => compareActions(state, a, b));

  for (const act of acts) {
    if (state.isOver) return;
    executeMove(state, act.side, act.action.moveIndex);
  }

  if (state.phase === 'ended') return;

  // --- Step 3: end of turn. ---
  for (const side of ['player', 'enemy'] as Side[]) {
    if (state.isOver) return;
    const fainted = endOfTurnStatus(state, side);
    if (fainted) checkFaint(state, side);
    tickDurations(state, side);
  }

  state.finishTurn();
}

/* --------------------------------------------------------------- order -- */

function compareActions(
  state: BattleState,
  a: { side: Side; action: MoveAction },
  b: { side: Side; action: MoveAction },
): number {
  const aMon = state.active(a.side);
  const bMon = state.active(b.side);
  const aMove = getMove(aMon.moves[a.action.moveIndex]?.id ?? 'struggle');
  const bMove = getMove(bMon.moves[b.action.moveIndex]?.id ?? 'struggle');
  const aPriority = aMove?.priority ?? 0;
  const bPriority = bMove?.priority ?? 0;
  if (aPriority !== bPriority) return bPriority - aPriority;

  const aSpeed = effectiveStat(aMon, 'speed', state.context);
  const bSpeed = effectiveStat(bMon, 'speed', state.context);
  if (aSpeed !== bSpeed) return bSpeed - aSpeed;

  return state.rng.chance(0.5) ? -1 : 1;
}

/* ---------------------------------------------------------- non-move -- */

function runNonMove(state: BattleState, side: Side, action: BattleAction): void {
  switch (action.kind) {
    case 'switch':
      resolveSwitch(state, side, action.index, false);
      break;
    case 'item':
      useItem(state, side, action.itemId, action.targetIndex);
      break;
    case 'orb':
      throwOrb(state, side, action.itemId);
      break;
    case 'flee':
      attemptFlee(state, side);
      break;
    default:
      break;
  }
}

export function resolveSwitch(
  state: BattleState,
  side: Side,
  index: number,
  forced: boolean,
): void {
  const party = state.party(side);
  const target = party[index];
  if (!target || isFainted(target)) return;

  const current = state.active(side);
  const other = state.other(side);

  // Entangled creatures cannot leave the field voluntarily.
  if (!forced && current.status === 'entangled') {
    state.log(`${displayName(current)} is entangled and cannot switch out!`);
    return;
  }
  if (!forced && current.volatiles.trapped > 0) {
    state.log(`${displayName(current)} is trapped and cannot switch out!`);
    return;
  }

  if (!forced) {
    state.emit({ type: 'switch-out', side, uid: current.uid, name: displayName(current) });
  }
  state.sendOut(side, index);

  // A creature coming in loses its own stat boosts but keeps the field weather.
  void other;
}

/** Apply an item from the bag. */
export function useItem(state: BattleState, side: Side, itemId: ItemId, targetIndex: number): void {
  const item = ITEMS[itemId];
  if (!item) return;
  const party = state.party(side);
  const target = party[targetIndex] ?? state.active(side);

  state.emit({ type: 'item-used', side, itemId, targetName: displayName(target) });

  switch (item.effect.kind) {
    case 'heal-hp': {
      const amount =
        item.effect.amount === 'full' ? maxHp(target) : Number(item.effect.amount);
      const restored = heal(target, amount);
      state.emit({
        type: 'heal',
        side,
        amount: restored,
        hpRemaining: target.currentHp,
        maxHp: maxHp(target),
      });
      break;
    }
    case 'heal-fraction': {
      const restored = heal(target, Math.floor(maxHp(target) * item.effect.fraction));
      state.emit({
        type: 'heal',
        side,
        amount: restored,
        hpRemaining: target.currentHp,
        maxHp: maxHp(target),
      });
      break;
    }
    case 'revive': {
      if (target.currentHp > 0) return;
      target.currentHp = Math.max(1, Math.floor(maxHp(target) * item.effect.fraction));
      state.emit({
        type: 'revive',
        side,
        uid: target.uid,
        name: displayName(target),
        hp: target.currentHp,
      });
      break;
    }
    case 'cure-status': {
      const statuses = item.effect.statuses;
      if (statuses === 'all') {
        if (target.status) {
          const status = target.status;
          target.status = null;
          target.statusTurns = 0;
          state.emit({ type: 'status-cured', side, status });
        }
      } else if (target.status && statuses.includes(target.status)) {
        const status = target.status;
        target.status = null;
        target.statusTurns = 0;
        state.emit({ type: 'status-cured', side, status });
      }
      break;
    }
    case 'restore-pp': {
      for (const slot of target.moves) {
        slot.pp =
          item.effect.amount === 'full'
            ? slot.maxPp
            : Math.min(slot.maxPp, slot.pp + item.effect.amount);
      }
      break;
    }
    case 'battle-stat': {
      const delta = applyStage(target, item.effect.stat as StageId, item.effect.stages);
      state.emit({
        type: 'stat-change',
        side,
        stat: item.effect.stat as StageId,
        delta,
        stage: target.stages[item.effect.stat as StageId],
      });
      break;
    }
    default:
      break;
  }
}

/** Throw a capture orb. Only legal in a wild battle. */
export function throwOrb(state: BattleState, side: Side, itemId: ItemId): void {
  if (!state.isWild) {
    state.log("You can't catch another trainer's creature!");
    return;
  }
  const target = state.active(state.other(side));
  const result = attemptCapture(target, itemId, {
    isNight: state.context.timeOfDay === 'night',
    isCave: state.context.isCave,
    rng: state.rng,
    turn: state.turn,
  });

  for (let i = 0; i < result.shakes; i++) {
    state.emit({ type: 'catch-shake', shakes: i + 1 });
  }

  if (result.caught) {
    state.caughtCreature = target;
    state.emit({
      type: 'catch-success',
      speciesId: target.speciesId,
      shakes: result.shakes,
      shiny: target.shiny,
    });
    state.endBattle('player', 'catch');
    return;
  }

  state.emit({ type: 'catch-failed', speciesId: target.speciesId, shakes: result.shakes });
}

/** Wild-only escape attempt. */
export function attemptFlee(state: BattleState, side: Side): void {
  if (!state.canFlee) {
    state.log("There's no running from a trainer battle!");
    return;
  }
  const me = state.active(side);
  const foe = state.active(state.other(side));

  // Prefer the classic speed-based escape formula.
  const a = effectiveStat(me, 'speed', state.context);
  const b = Math.max(1, effectiveStat(foe, 'speed', state.context));
  const odds = Math.min(1, (Math.floor((a * 128) / b) + 30 * 1) / 256);
  const success = state.rng.chance(odds);

  state.emit({ type: 'flee-attempt', side, success });
  if (success) {
    state.fled = true;
    state.endBattle('draw', 'flee');
  }
}

/* ------------------------------------------------------------ moves -- */

export function executeMove(state: BattleState, side: Side, moveIndex: number): void {
  const attacker = state.active(side);
  if (attacker.currentHp <= 0) return;

  const foeSide = state.other(side);
  const defender = state.active(foeSide);

  // --- Pre-move status gates. ---
  if (attacker.status === 'sleep') {
    if (!tickSleep(state, side)) {
      state.log(`${displayName(attacker)} is fast asleep.`);
      return;
    }
    state.log(`${displayName(attacker)} woke up!`);
  }
  if (attacker.status === 'paralyze' && state.rng.chance(0.25)) {
    state.log(`${displayName(attacker)} is paralyzed! It can't move!`);
    return;
  }
  if (attacker.volatiles.flinch) {
    state.log(`${displayName(attacker)} flinched and couldn't move!`);
    return;
  }
  if (attacker.status === 'fear' && state.rng.chance(0.3)) {
    state.log(`${displayName(attacker)} was too frightened to move!`);
    return;
  }
  if (attacker.volatiles.daze > 0) {
    attacker.volatiles.daze -= 1;
    if (state.rng.chance(1 / 3)) {
      const dmg = Math.max(1, Math.floor(maxHp(attacker) * 0.08));
      damage(attacker, dmg);
      state.log(`${displayName(attacker)} is dazed and hurts itself!`);
      state.emit({
        type: 'damage',
        side,
        amount: dmg,
        hpRemaining: attacker.currentHp,
        maxHp: maxHp(attacker),
        effectiveness: 1,
        crit: false,
        indirect: true,
      });
      checkFaint(state, side);
      return;
    }
  }

  // --- Pick the move (Struggle when out of PP). ---
  const slot = attacker.moves[moveIndex];
  let move: MoveData;
  if (!slot || slot.pp <= 0) {
    move = getMove('struggle')!;
  } else {
    move = getMove(slot.id) ?? getMove('struggle')!;
    slot.pp = Math.max(0, slot.pp - 1);
  }

  state.emit({ type: 'move-used', side, moveId: move.id, moveName: move.name });

  // --- Protect. ---
  if (
    defender.volatiles.protected &&
    (move.target === 'foe' || move.target === 'all-foes') &&
    !move.tags?.includes('unblockable')
  ) {
    state.emit({ type: 'move-protected', side: foeSide });
    return;
  }

  // --- Accuracy. ---
  const chance = hitChance(move, attacker, defender, state.context);
  if (chance < 1 && !state.rng.chance(chance)) {
    state.emit({ type: 'move-missed', side, moveName: move.name });
    return;
  }
  if (attacker.volatiles.sureHit) attacker.volatiles.sureHit = false;

  // --- Damage. ---
  let dealt = 0;
  if (move.category !== 'status' && move.power > 0) {
    const hitCount = rollHits(move, state);
    let lastResult = { effectiveness: 1, crit: false };
    for (let i = 0; i < hitCount; i++) {
      if (defender.currentHp <= 0) break;
      const result = calculateDamage(attacker, defender, move, {
        context: state.context,
        rng: state.rng,
      });
      damage(defender, result.damage);
      dealt += result.damage;
      lastResult = result;
      state.emit({
        type: 'damage',
        side: foeSide,
        amount: result.damage,
        hpRemaining: defender.currentHp,
        maxHp: maxHp(defender),
        effectiveness: result.effectiveness,
        crit: result.crit,
      });
    }
    announceEffectiveness(state, lastResult.effectiveness);

    // Contact abilities.
    if (move.contact && dealt > 0) {
      maybeContactStatus(state, foeSide, side);
    }
    // Refractive Hide bounces special damage back.
    if (move.category === 'special' && dealt > 0) {
      const defAbility = abilityOf(defender);
      if (defAbility.hooks.includes('special-reflect')) {
        const reflected = Math.max(1, Math.floor(dealt * (defAbility.fraction ?? 0.25)));
        damage(attacker, reflected);
        state.emit({
          type: 'damage',
          side,
          amount: reflected,
          hpRemaining: attacker.currentHp,
          maxHp: maxHp(attacker),
          effectiveness: 1,
          crit: false,
          indirect: true,
        });
      }
    }
  }

  // --- Non-damage effects. ---
  applyMoveEffects(state, side, move, dealt);

  // Recoil and drain are computed after the effects so heals land correctly.
  const recoil = recoilDamage(dealt, move);
  if (recoil > 0) {
    damage(attacker, recoil);
    state.emit({ type: 'recoil', side, amount: recoil });
  }

  checkFaint(state, foeSide);
  checkFaint(state, side);
}

function rollHits(move: MoveData, state: BattleState): number {
  if (!move.multihit) return 1;
  const [min, max] = move.multihit;
  const roll = state.rng.next();
  // Classic 2-5 distribution: 35/35/15/15.
  if (max - min === 3) {
    if (roll < 0.35) return 2;
    if (roll < 0.7) return 3;
    if (roll < 0.85) return 4;
    return 5;
  }
  return state.rng.int(min, max);
}

function announceEffectiveness(state: BattleState, effectiveness: number): void {
  if (effectiveness >= 2) state.log("It's super effective!");
  else if (effectiveness <= 0.5) state.log("It's not very effective...");
}

function applyMoveEffects(
  state: BattleState,
  side: Side,
  move: MoveData,
  dealt: number,
): void {
  const foeSide = state.other(side);
  const attacker = state.active(side);
  const effects = move.effects ?? [];

  for (const effect of effects) {
    const chance = 'chance' in effect ? (effect.chance ?? 1) : 1;
    if (chance < 1 && !state.rng.chance(chance)) continue;

    switch (effect.kind) {
      case 'status':
        applyStatus(state, foeSide, effect.status);
        break;
      case 'stat': {
        const targetSide = effect.target === 'self' ? side : foeSide;
        const target = state.active(targetSide);
        for (const [stat, delta] of Object.entries(effect.changes)) {
          const changed = applyStage(target, stat as StageId, delta as number);
          state.emit({
            type: 'stat-change',
            side: targetSide,
            stat: stat as StageId,
            delta: changed,
            stage: target.stages[stat as StageId],
          });
        }
        break;
      }
      case 'volatile': {
        const targetSide = effect.target === 'self' ? side : foeSide;
        const target = state.active(targetSide);
        setVolatile(state, targetSide, effect.volatile);
        void target;
        break;
      }
      case 'weather':
        state.weather = setWeather(effect.weather);
        state.emit({ type: 'weather-set', weather: state.weather.kind });
        break;
      case 'heal': {
        const restored = heal(attacker, Math.max(1, Math.floor(maxHp(attacker) * effect.fraction)));
        state.emit({
          type: 'heal',
          side,
          amount: restored,
          hpRemaining: attacker.currentHp,
          maxHp: maxHp(attacker),
        });
        break;
      }
      case 'drain': {
        if (dealt <= 0) break;
        const target = state.active(foeSide);
        const restored = heal(attacker, Math.max(1, Math.floor(dealt * effect.fraction)));
        state.emit({
          type: 'heal',
          side,
          amount: restored,
          hpRemaining: attacker.currentHp,
          maxHp: maxHp(attacker),
        });
        state.emit({ type: 'drain', side, targetSide: foeSide, amount: restored });
        void target;
        break;
      }
      case 'protect':
        attacker.volatiles.protected = true;
        state.emit({ type: 'volatile-applied', side, volatile: 'protected' });
        break;
      case 'reflect':
        attacker.volatiles.reflectTurns = effect.turns;
        attacker.volatiles.reflectFraction = effect.fraction;
        state.emit({ type: 'volatile-applied', side, volatile: 'reflect' });
        break;
      case 'trap':
        setVolatile(state, foeSide, 'trapped');
        state.active(foeSide).volatiles.trapped = effect.turns;
        break;
      case 'crit-stage':
        attacker.volatiles.focusEnergy = true;
        state.emit({ type: 'volatile-applied', side, volatile: 'focus-energy' });
        break;
      case 'sure-hit':
        attacker.volatiles.sureHit = true;
        state.emit({ type: 'volatile-applied', side, volatile: 'sure-hit' });
        break;
      case 'prevent-flee':
        state.active(foeSide).volatiles.magnetPull = true;
        state.emit({ type: 'volatile-applied', side: foeSide, volatile: 'magnet-pull' });
        break;
      case 'sleep-self':
        forceStatus(state, side, 'sleep', effect.turns);
        break;
      case 'reset-target-stages': {
        const target = state.active(foeSide);
        target.stages = { attack: 0, defense: 0, spPower: 0, spGuard: 0, speed: 0, accuracy: 0, evasion: 0 };
        break;
      }
      case 'recoil':
        break;
      default:
        break;
    }
  }
}

function setVolatile(state: BattleState, side: Side, volatile: VolatileId): void {
  const target = state.active(side);
  switch (volatile) {
    case 'soaked': {
      const ability = abilityOf(target);
      if (ability.hooks.includes('status-immune') && ability.status === 'soaked') {
        state.log(`${displayName(target)} floats clear of the water!`);
        state.emit({
          type: 'ability-triggered',
          side,
          ability: ability.id,
          abilityName: ability.name,
        });
        return;
      }
      target.volatiles.soaked = true;
      break;
    }
    case 'dazzled':
      target.volatiles.dazzled = true;
      break;
    case 'protected':
      target.volatiles.protected = true;
      break;
    case 'reflect':
      target.volatiles.reflectTurns = Math.max(target.volatiles.reflectTurns, 3);
      break;
    case 'flinch':
      target.volatiles.flinch = true;
      break;
    case 'daze':
      target.volatiles.daze = Math.max(target.volatiles.daze, 2);
      break;
    case 'focus-energy':
      target.volatiles.focusEnergy = true;
      break;
    case 'sure-hit':
      target.volatiles.sureHit = true;
      break;
    case 'magnet-pull':
      target.volatiles.magnetPull = true;
      break;
    case 'leech-seed':
      target.volatiles.leechSeed = true;
      break;
    case 'charging':
      break;
    default:
      break;
  }
  state.emit({ type: 'volatile-applied', side, volatile });
}

/** Defender abilities that punish contact. */
function maybeContactStatus(
  state: BattleState,
  defenderSide: Side,
  attackerSide: Side,
): void {
  const defender = state.active(defenderSide);
  const ability = abilityOf(defender);
  if (!ability.hooks.includes('contact-status')) return;
  // Contact abilities only ever inflict major statuses.
  const raw = ability.status ?? 'paralyze';
  if (!STATUS_IDS.includes(raw as StatusId)) return;
  const status = raw as StatusId;
  const chance = ability.chance ?? 0.3;
  if (!state.rng.chance(chance)) return;
  state.emit({
    type: 'ability-triggered',
    side: defenderSide,
    ability: ability.id,
    abilityName: ability.name,
  });
  applyStatus(state, attackerSide, status);
}

/* ------------------------------------------------------------ faints -- */

export function checkFaint(state: BattleState, side: Side): boolean {
  const creature = state.active(side);
  if (creature.currentHp > 0) return false;

  // Rebirth: the first faint becomes a revival.
  if (hasAbility(creature, 'revive-once') && !creature.revivedThisBattle) {
    creature.revivedThisBattle = true;
    const ability = abilityOf(creature);
    creature.currentHp = Math.max(1, Math.floor(maxHp(creature) * (ability.fraction ?? 0.5)));
    state.emit({ type: 'revive', side, uid: creature.uid, name: displayName(creature), hp: creature.currentHp });
    state.emit({ type: 'ability-triggered', side, ability: ability.id, abilityName: ability.name });
    return false;
  }

  state.emit({ type: 'faint', side, uid: creature.uid, name: displayName(creature) });
  if (side === 'player') state.playerFaints += 1;

  // Defeating an enemy awards XP to the player's active creature.
  if (side === 'enemy' && state.hasAlive('player')) {
    awardExperience(state, creature);
  }
  return true;
}

function awardExperience(state: BattleState, defeated: CreatureInstance): void {
  const winner = state.active('player');
  if (isFainted(winner)) return;
  const amount = expAward(speciesOf(defeated).baseExp, defeated.level);
  const result = gainExp(winner, amount);
  state.emit({ type: 'exp-gained', side: 'player', uid: winner.uid, amount, total: winner.exp });

  for (let i = 0; i < result.levelsGained; i++) {
    state.emit({ type: 'level-up', side: 'player', uid: winner.uid, level: winner.level - (result.levelsGained - 1 - i) });
  }

  for (const moveId of result.newMoves) {
    if (hasRoomForMove(winner)) {
      addMove(winner, moveId);
      state.emit({ type: 'move-learned', side: 'player', uid: winner.uid, moveId });
    } else {
      state.emit({
        type: 'move-learn-prompt',
        side: 'player',
        uid: winner.uid,
        moveId,
        options: winner.moves.map((m) => m.id),
      });
    }
  }

  if (winner.level >= MAX_LEVEL) return;
}

/** The scene calls this when the player answers the "forget a move?" prompt. */
export function resolveLearnMove(
  state: BattleState,
  uid: string,
  moveId: string,
  replaceIndex: number,
): void {
  const creature = state.party('player').find((c) => c.uid === uid);
  if (!creature) return;
  if (replaceIndex < 0) {
    if (hasRoomForMove(creature)) {
      addMove(creature, moveId);
      state.emit({ type: 'move-learned', side: 'player', uid, moveId });
    }
    return;
  }
  const forgotten = replaceMove(creature, replaceIndex, moveId);
  state.emit({ type: 'move-learned', side: 'player', uid, moveId, replaced: forgotten });
}

/* --------------------------------------------------------- durations -- */

function tickDurations(state: BattleState, side: Side): void {
  const creature = state.active(side);
  if (creature.currentHp <= 0) return;

  if (creature.volatiles.trapped > 0) {
    creature.volatiles.trapped -= 1;
    if (creature.volatiles.trapped === 0) {
      state.emit({ type: 'volatile-ended', side, volatile: 'trapped' });
    }
  }
  if (creature.volatiles.reflectTurns > 0) {
    creature.volatiles.reflectTurns -= 1;
    if (creature.volatiles.reflectTurns === 0) {
      state.emit({ type: 'volatile-ended', side, volatile: 'reflect' });
    }
  }
  // Protect and flinch only last through the opponent's next action.
  creature.volatiles.protected = false;
  creature.volatiles.flinch = false;
}

/* -------------------------------------------------------------- misc -- */

/** Whether any move remains usable (otherwise the creature Struggles). */
export function hasPp(creature: { moves: Array<{ pp: number }> }): boolean {
  return creature.moves.some((m) => m.pp > 0);
}
