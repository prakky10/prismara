/**
 * Creature cries, generated from the species id.
 *
 * Every creature gets a unique-sounding cry derived deterministically from its
 * pokedex number: pitch, waveform, envelope, wobble and a small noise tail.
 * Nothing is recorded, so 40 species cost 40 lines of parameters.
 */

import { hashString } from '../core/SeededRNG';
import type { WaveShape } from './SfxSynth';

export interface CryRecipe {
  shape: WaveShape;
  /** Base frequency. */
  freq: number;
  /** Pitch glide target. */
  endFreq: number;
  /** Total length in seconds. */
  duration: number;
  /** Vibrato depth in Hz. */
  wobble: number;
  /** Vibrato rate in Hz. */
  wobbleRate: number;
  /** Noise blend, 0..1. */
  noise: number;
  /** Number of amplitude pulses, giving a growl or a chirp. */
  pulses: number;
  gain: number;
}

/**
 * Derive a stable recipe from an id + dex number. Bigger dex numbers trend
 * toward lower, heavier cries; legendary-tier creatures get long, dramatic
 * ones. The hash keeps each species distinct inside its band.
 */
export function cryFor(speciesId: string, dexNumber: number, tier = 'basic'): CryRecipe {
  const h = hashString(`${speciesId}#${dexNumber}`);

  const shapes: WaveShape[] = ['square', 'triangle', 'sawtooth', 'sine'];
  const shape = shapes[h % shapes.length];

  // Base pitch falls as the dex grows, with a per-species spread.
  const spread = ((h >>> 3) % 100) / 100;
  const tierBias = tier === 'legendary' || tier === 'mythical' ? 0.55 : tier === 'stage3' ? 0.75 : 1;
  const freq = Math.round((520 - dexNumber * 5 + spread * 220) * tierBias + 90);

  const glideUp = (h >>> 7) % 2 === 0;
  const endFreq = Math.round(freq * (glideUp ? 1.5 + spread * 0.5 : 0.62 - spread * 0.15));

  const long = tier === 'legendary' || tier === 'mythical';
  const duration = long ? 0.9 + spread * 0.5 : 0.34 + spread * 0.26;

  return {
    shape,
    freq: Math.max(60, freq),
    endFreq: Math.max(50, endFreq),
    duration,
    wobble: 8 + ((h >>> 11) % 40),
    wobbleRate: 6 + ((h >>> 13) % 18),
    noise: ((h >>> 17) % 40) / 100,
    pulses: 1 + ((h >>> 19) % 3),
    gain: long ? 0.34 : 0.28,
  };
}
