/**
 * Deterministic, seedable pseudo-random number generator (sfc32).
 *
 * Every random decision in the battle engine goes through one of these so that
 * battles are reproducible: the same seed always produces the same fight. That
 * makes the engine testable and lets the balance simulator replay scenarios.
 *
 * For anything the player perceives as "luck" (wild encounters, shiny rolls)
 * the game uses the *unseeded* `random` export, which mixes in Math.random.
 */

export interface RNG {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Float in [min, max). */
  float(min: number, max: number): number;
  /** True with probability `chance` (0..1). */
  chance(chance: number): boolean;
  /** Uniform pick. Returns undefined for an empty list. */
  pick<T>(items: readonly T[]): T | undefined;
  /** Weighted pick by `weight(item)`; falls back to uniform when total is 0. */
  weighted<T>(items: readonly T[], weight: (item: T) => number): T | undefined;
  /** Non-destructive shuffle (Fisher-Yates on a copy). */
  shuffle<T>(items: readonly T[]): T[];
  /** Current 32-bit state, for snapshotting/serialising a battle. */
  state(): number;
  /** Restore a previously captured state. */
  setState(state: number): void;
}

/** sfc32 — small, fast, and good enough for a game. */
class Sfc32RNG implements RNG {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: number) {
    // Guard against a zero seed (which would degenerate) and expand it.
    const s = seed >>> 0 || 0x9e3779b9;
    this.a = s;
    this.b = (s ^ 0x6d2b79f5) >>> 0;
    this.c = (s + 0x1b873593) >>> 0;
    this.d = (s ^ 0x85ebca6b) >>> 0;
    // Warm up.
    for (let i = 0; i < 12; i++) this.next();
  }

  next(): number {
    const t = (this.a + this.b + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return (t >>> 0) / 4294967296;
  }

  int(min: number, max: number): number {
    if (max < min) [min, max] = [max, min];
    return min + Math.floor(this.next() * (max - min + 1));
  }

  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  chance(chance: number): boolean {
    return this.next() < chance;
  }

  pick<T>(items: readonly T[]): T | undefined {
    if (items.length === 0) return undefined;
    return items[this.int(0, items.length - 1)];
  }

  weighted<T>(items: readonly T[], weight: (item: T) => number): T | undefined {
    if (items.length === 0) return undefined;
    let total = 0;
    const weights: number[] = [];
    for (const item of items) {
      const w = Math.max(0, weight(item));
      weights.push(w);
      total += w;
    }
    if (total <= 0) return this.pick(items);
    let roll = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      roll -= weights[i];
      if (roll < 0) return items[i];
    }
    return items[items.length - 1];
  }

  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  state(): number {
    return (this.a ^ (this.b << 8) ^ (this.c << 16) ^ (this.d << 24)) >>> 0;
  }

  setState(state: number): void {
    const s = state >>> 0 || 0x9e3779b9;
    this.a = s;
    this.b = (s ^ 0x6d2b79f5) >>> 0;
    this.c = (s + 0x1b873593) >>> 0;
    this.d = (s ^ 0x85ebca6b) >>> 0;
  }
}

/** Create a deterministic generator from a numeric seed. */
export function createRNG(seed: number): RNG {
  return new Sfc32RNG(seed);
}

/** Turn a string (player name, save slot id) into a stable 32-bit seed. */
export function hashString(text: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Global, non-deterministic generator. Use for player-facing luck where
 * reproducibility does not matter (encounters, shinies, cosmetic jitter).
 */
export const random: RNG = createRNG((Math.random() * 0xffffffff) >>> 0);

/** Fresh unpredictable seed value. */
export function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}
