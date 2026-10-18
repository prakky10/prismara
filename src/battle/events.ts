/**
 * The battle engine's only output.
 *
 * The engine never touches Phaser. Instead, every meaningful thing that happens
 * is pushed onto a queue as a `BattleEvent`. The Battle scene drains that queue
 * and plays each one as an animation. This is what lets the rules stay pure and
 * testable while still looking cinematic.
 *
 * For tests, `formatEvent` renders an event as the message a player would read.
 */

import type { Side, StageId, StatusId, VolatileId, WeatherKind } from '../data/battleTypes';
import type { ItemId } from '../data/items';

export type BattleEvent =
  | { type: 'battle-start'; playerName: string; enemyName: string; isWild: boolean }
  | { type: 'turn-start'; turn: number }
  | { type: 'message'; text: string }
  | { type: 'switch-in'; side: Side; uid: string; name: string; level: number }
  | { type: 'switch-out'; side: Side; uid: string; name: string }
  | { type: 'move-used'; side: Side; moveId: string; moveName: string }
  | { type: 'move-missed'; side: Side; moveName: string }
  | { type: 'move-failed'; side: Side; moveName: string; reason: string }
  | { type: 'move-protected'; side: Side }
  | {
      type: 'damage';
      side: Side;
      amount: number;
      hpRemaining: number;
      maxHp: number;
      effectiveness: number;
      crit: boolean;
      /** True for damage from status (burn, leech) rather than a move. */
      indirect?: boolean;
    }
  | { type: 'heal'; side: Side; amount: number; hpRemaining: number; maxHp: number }
  | { type: 'drain'; side: Side; targetSide: Side; amount: number }
  | { type: 'recoil'; side: Side; amount: number }
  | { type: 'stat-change'; side: Side; stat: StageId; delta: number; stage: number }
  | { type: 'stat-change-failed'; side: Side; stat: StageId; delta: number; stage: number }
  | { type: 'status-applied'; side: Side; status: StatusId }
  | { type: 'status-immune'; side: Side; status: StatusId }
  | { type: 'status-cured'; side: Side; status: StatusId }
  | { type: 'status-damage'; side: Side; status: StatusId; amount: number; hpRemaining: number }
  | { type: 'volatile-applied'; side: Side; volatile: VolatileId }
  | { type: 'volatile-ended'; side: Side; volatile: VolatileId }
  | { type: 'weather-set'; weather: WeatherKind }
  | { type: 'weather-ended'; weather: WeatherKind }
  | { type: 'ability-triggered'; side: Side; ability: string; abilityName: string }
  | { type: 'faint'; side: Side; uid: string; name: string }
  | { type: 'revive'; side: Side; uid: string; name: string; hp: number }
  | { type: 'exp-gained'; side: Side; uid: string; amount: number; total: number }
  | { type: 'level-up'; side: Side; uid: string; level: number }
  | { type: 'move-learned'; side: Side; uid: string; moveId: string; replaced?: string }
  | { type: 'move-learn-prompt'; side: Side; uid: string; moveId: string; options: string[] }
  | { type: 'evolution-ready'; uid: string; from: string; into: string; level: number }
  | { type: 'catch-shake'; shakes: number }
  | { type: 'catch-success'; speciesId: string; shakes: number; shiny: boolean }
  | { type: 'catch-failed'; speciesId: string; shakes: number }
  | { type: 'flee-attempt'; side: Side; success: boolean }
  | { type: 'item-used'; side: Side; itemId: ItemId; targetName: string }
  | { type: 'request-switch'; side: Side }
  | { type: 'battle-end'; winner: Side | 'draw'; reason: 'faint' | 'catch' | 'flee' | 'forfeit' }
  | { type: 'money-earned'; amount: number };

export type BattleEventType = BattleEvent['type'];

/** The message a player would read for this event, or null if it is silent. */
export function formatEvent(event: BattleEvent, ctx?: EventNaming): string | null {
  const name = (side: Side): string => {
    const hero = side === 'player' ? 'Your' : 'The foe\u2019s';
    return hero;
  };
  switch (event.type) {
    case 'battle-start':
      return event.isWild
        ? `A wild ${event.enemyName} appeared!`
        : `${event.enemyName} wants to battle!`;
    case 'message':
      return event.text;
    case 'switch-in':
      return event.side === 'player'
        ? `Go, ${event.name}!`
        : `${ctx?.foeTrainerName ?? 'The foe'} sent out ${event.name}!`;
    case 'switch-out':
      return `${name(event.side)} ${event.name} withdrew.`;
    case 'move-used':
      return `${name(event.side)} ${event.moveName}!`;
    case 'move-missed':
      return `${name(event.side)} ${event.moveName} missed!`;
    case 'move-failed':
      return `${name(event.side)} ${event.moveName} failed!`;
    case 'move-protected':
      return `${name(event.side)} protected itself!`;
    case 'stat-change': {
      const verb = event.delta > 0 ? 'rose' : 'fell';
      const amount = Math.abs(event.delta) >= 2 ? ' sharply' : '';
      return `${name(event.side)} ${statName(event.stat)}${amount} ${verb}!`;
    }
    case 'stat-change-failed':
      return `${name(event.side)} ${statName(event.stat)} won\u2019t go ${event.delta > 0 ? 'higher' : 'lower'}!`;
    case 'status-applied':
      return `${name(event.side)} was ${statusVerb(event.status)}!`;
    case 'status-immune':
      return `${name(event.side)} is immune!`;
    case 'status-cured':
      return `${name(event.side)} recovered from ${event.status}!`;
    case 'faint':
      return `${name(event.side)} ${event.name} fainted!`;
    case 'revive':
      return `${name(event.side)} ${event.name} was reborn!`;
    case 'weather-set':
      return weatherText(event.weather);
    case 'weather-ended':
      return 'The weather returned to normal.';
    case 'ability-triggered':
      return `${event.abilityName} activated!`;
    case 'catch-shake':
      return null;
    case 'catch-success':
      return `Gotcha! ${ctx?.foeTrainerName ?? 'The wild creature'} was caught!`;
    case 'catch-failed':
      return 'Oh no! It broke free!';
    case 'flee-attempt':
      return event.success ? 'Got away safely!' : 'Couldn\u2019t get away!';
    case 'battle-end':
      return event.winner === 'player'
        ? 'You won the battle!'
        : event.winner === 'enemy'
          ? 'You lost the battle...'
          : 'The battle ended in a draw.';
    case 'money-earned':
      return `You earned \u00a3${event.amount}!`;
    case 'level-up':
      return `${name('player')} creature grew to level ${event.level}!`;
    default:
      return null;
  }
}

export interface EventNaming {
  foeTrainerName?: string;
}

function statName(stat: StageId): string {
  const names: Record<StageId, string> = {
    attack: 'Attack',
    defense: 'Defense',
    spPower: 'Sp. Power',
    spGuard: 'Sp. Guard',
    speed: 'Speed',
    accuracy: 'accuracy',
    evasion: 'evasiveness',
  };
  return names[stat];
}

function statusVerb(status: StatusId): string {
  const verbs: Record<StatusId, string> = {
    burn: 'burned',
    paralyze: 'paralyzed',
    sleep: 'fast asleep',
    entangled: 'entangled',
    fear: 'frightened',
  };
  return verbs[status];
}

function weatherText(weather: WeatherKind): string {
  switch (weather) {
    case 'sunny':
      return 'The sunlight turned harsh!';
    case 'rain':
      return 'It started to rain!';
    case 'spore-haze':
      return 'A haze of spores drifted across the field!';
    case 'night-fog':
      return 'A thick night fog rolled in!';
    default:
      return 'The weather cleared.';
  }
}
