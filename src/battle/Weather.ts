/**
 * Weather effects.
 *
 *  - Sunny:  Fire moves 1.5x, Water moves 0.5x.
 *  - Rain:   Water moves 1.5x, Fire 0.5x, Electric never misses.
 *  - Spore Haze: Grass creatures heal 1/16 max HP each turn.
 *  - Night Fog:  Shadow creatures gain evasion; Night Sight is needed outside.
 *
 * Damage multipliers live in `DamageCalc.weatherDamageMultiplier`; this module
 * owns the per-turn effects and the duration bookkeeping.
 */

import type { WeatherKind } from '../data/battleTypes';
import { WEATHERS } from '../data/battleTypes';
import { hasHook } from '../data/abilities';
import { abilityOf, heal, hpFraction, speciesOf, type CreatureInstance } from './Creature';
import { maxHp } from './Creature';

export interface WeatherState {
  kind: WeatherKind;
  /** Turns remaining; 0 means indefinite (or the weather is `clear`). */
  turnsLeft: number;
}

export function clearWeather(): WeatherState {
  return { kind: 'clear', turnsLeft: 0 };
}

export function setWeather(kind: WeatherKind): WeatherState {
  return { kind, turnsLeft: WEATHERS[kind].duration };
}

/** Advance the weather clock by one turn. Returns true when it just expired. */
export function tickWeather(state: WeatherState): boolean {
  if (state.kind === 'clear' || state.turnsLeft <= 0) return false;
  state.turnsLeft -= 1;
  if (state.turnsLeft <= 0) {
    state.kind = 'clear';
    return true;
  }
  return false;
}

/**
 * End-of-turn healing granted by the weather or by a matching ability.
 * Returns the HP restored.
 */
export function weatherEndOfTurnHeal(
  creature: CreatureInstance,
  weather: WeatherKind,
): { healed: number; source: 'weather' | 'ability' | null } {
  if (creature.currentHp <= 0) return { healed: 0, source: null };

  const ability = abilityOf(creature);
  if (hasHook(creature.ability, 'weather-heal') && ability.weather === weather) {
    const healed = heal(creature, Math.max(1, Math.floor(maxHp(creature) * (ability.fraction ?? 1 / 16))));
    return { healed, source: 'ability' };
  }

  if (weather === 'spore-haze' && speciesOf(creature).element === 'grass') {
    const healed = heal(creature, Math.max(1, Math.floor(maxHp(creature) / 16)));
    return { healed, source: 'weather' };
  }
  return { healed: 0, source: null };
}

/** True when a creature should take sandstorm-like chip damage (none yet). */
export function weatherChipDamage(): number {
  return 0;
}

/** Shadow creatures get +1 evasion in Night Fog. */
export function weatherEvasionBonus(creature: CreatureInstance, weather: WeatherKind): number {
  if (weather !== 'night-fog') return 0;
  return speciesOf(creature).element === 'shadow' ? 1 : 0;
}

/** Friendlier display name. */
export function weatherName(weather: WeatherKind): string {
  return WEATHERS[weather].name;
}

/** True when the field is dark enough for the Dusk Orb bonus. */
export function isDark(weather: WeatherKind, timeOfDay: 'day' | 'night'): boolean {
  return timeOfDay === 'night' || weather === 'night-fog';
}

export { hpFraction };
