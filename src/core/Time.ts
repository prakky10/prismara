/**
 * The world clock.
 *
 * A full day lasts 24 real minutes, so one real second advances one in-game
 * minute. Time of day drives encounters, lighting, NPC dialogue and music.
 */

export type TimeOfDay = 'day' | 'night';
export type Phase = 'dawn' | 'day' | 'dusk' | 'night';

export const MINUTES_PER_REAL_SECOND = 1;
export const MINUTES_PER_DAY = 24 * 60;

export interface ClockState {
  /** Minutes elapsed since midnight, 0..1439. */
  minutes: number;
  /** Total in-game minutes elapsed, for playtime-independent weather rolls. */
  total: number;
}

export function newClock(startHour = 8): ClockState {
  return { minutes: startHour * 60, total: startHour * 60 };
}

/** Advance the clock by `deltaMs` of real time. */
export function tickClock(clock: ClockState, deltaMs: number): void {
  const advanced = (deltaMs / 1000) * MINUTES_PER_REAL_SECOND;
  clock.minutes = (clock.minutes + advanced) % MINUTES_PER_DAY;
  clock.total += advanced;
}

export function hourOf(clock: ClockState): number {
  return Math.floor(clock.minutes / 60);
}

export function minuteOf(clock: ClockState): number {
  return Math.floor(clock.minutes % 60);
}

/** "07:35" style label for the pause menu. */
export function clockLabel(clock: ClockState): string {
  const h = hourOf(clock).toString().padStart(2, '0');
  const m = minuteOf(clock).toString().padStart(2, '0');
  return `${h}:${m}`;
}

export function phaseOf(clock: ClockState): Phase {
  const h = hourOf(clock);
  if (h >= 5 && h < 7) return 'dawn';
  if (h >= 7 && h < 17) return 'day';
  if (h >= 17 && h < 19) return 'dusk';
  return 'night';
}

export function timeOfDay(clock: ClockState): TimeOfDay {
  const phase = phaseOf(clock);
  return phase === 'night' || phase === 'dusk' ? 'night' : 'day';
}

export function isNight(clock: ClockState): boolean {
  return timeOfDay(clock) === 'night';
}

/** True around noon, when Solarion can be challenged. */
export function isNoon(clock: ClockState): boolean {
  const h = hourOf(clock);
  return h >= 11 && h < 13;
}

/** True around midnight, when Eclipsor rises. */
export function isMidnight(clock: ClockState): boolean {
  const h = hourOf(clock);
  return h >= 23 || h < 1;
}

/**
 * Colour grade + darkness for the overworld at this time of day.
 * Returns a tint and how strongly to apply it.
 */
export function lightingFor(clock: ClockState): { tint: number; alpha: number; ambient: number } {
  const phase = phaseOf(clock);
  switch (phase) {
    case 'dawn':
      return { tint: 0xffb37a, alpha: 0.18, ambient: 0.85 };
    case 'day':
      return { tint: 0xffffff, alpha: 0, ambient: 1 };
    case 'dusk':
      return { tint: 0xff8a5c, alpha: 0.28, ambient: 0.7 };
    case 'night':
    default:
      return { tint: 0x2a3a6a, alpha: 0.5, ambient: 0.45 };
  }
}

/** How many real seconds remain until the next phase change. */
export function secondsUntilNextPhase(clock: ClockState): number {
  const phase = phaseOf(clock);
  const h = hourOf(clock);
  const m = minuteOf(clock);
  let target: number;
  switch (phase) {
    case 'dawn':
      target = 7;
      break;
    case 'day':
      target = 17;
      break;
    case 'dusk':
      target = 19;
      break;
    default:
      target = 5;
      break;
  }
  let minutesRemaining = (target - h) * 60 - m;
  if (minutesRemaining <= 0) minutesRemaining += MINUTES_PER_DAY;
  return minutesRemaining / MINUTES_PER_REAL_SECOND;
}

export function formatPlaytime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const mins = Math.floor(totalMinutes % 60);
  return `${hours}h ${mins.toString().padStart(2, '0')}m`;
}
