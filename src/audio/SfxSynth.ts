/**
 * Sound effects, synthesised at runtime.
 *
 * Each recipe is a small description (oscillator shape, frequency sweep,
 * envelope, optional noise) that the synth turns into a WebAudio graph. No
 * audio files are shipped, so there is nothing to license.
 */

export type WaveShape = 'square' | 'sawtooth' | 'triangle' | 'sine' | 'noise';

export interface SfxRecipe {
  /** Starting frequency in Hz. */
  startFreq: number;
  /** Ending frequency (a sweep); omit to hold. */
  endFreq?: number;
  /** Seconds. */
  duration: number;
  shape: WaveShape;
  /** Linear attack in seconds. */
  attack?: number;
  /** Starting gain, 0..1. */
  gain?: number;
  /** Add a detuned second voice for thickness. */
  detune?: number;
  /** Low-pass cutoff sweep, in Hz. */
  filterFrom?: number;
  filterTo?: number;
  /** Add a short noise transient on top. */
  noise?: number;
  /** Play a second blip this many seconds later. */
  repeatAt?: number;
  repeatPitch?: number;
}

export const SFX: Record<string, SfxRecipe> = {
  blip: { startFreq: 880, endFreq: 1320, duration: 0.07, shape: 'square', gain: 0.28, attack: 0.004 },
  select: { startFreq: 660, endFreq: 990, duration: 0.1, shape: 'square', gain: 0.3, attack: 0.004 },
  back: { startFreq: 520, endFreq: 320, duration: 0.1, shape: 'square', gain: 0.26, attack: 0.004 },
  denied: { startFreq: 220, endFreq: 180, duration: 0.16, shape: 'square', gain: 0.3 },
  cursor: { startFreq: 1200, duration: 0.03, shape: 'square', gain: 0.14 },
  step: { startFreq: 180, endFreq: 120, duration: 0.05, shape: 'noise', gain: 0.1, filterFrom: 1200, filterTo: 500 },
  door: { startFreq: 300, endFreq: 140, duration: 0.24, shape: 'triangle', gain: 0.24, filterFrom: 900, filterTo: 300 },
  encounter: {
    startFreq: 400,
    endFreq: 1600,
    duration: 0.5,
    shape: 'sawtooth',
    gain: 0.22,
    filterFrom: 600,
    filterTo: 2600,
  },
  hit: { startFreq: 260, endFreq: 90, duration: 0.16, shape: 'square', gain: 0.4, noise: 0.3, filterFrom: 1800, filterTo: 400 },
  hitSuper: {
    startFreq: 340,
    endFreq: 70,
    duration: 0.24,
    shape: 'sawtooth',
    gain: 0.48,
    noise: 0.5,
    filterFrom: 2600,
    filterTo: 300,
  },
  hitWeak: { startFreq: 200, endFreq: 140, duration: 0.12, shape: 'square', gain: 0.24, filterFrom: 900, filterTo: 400 },
  crit: {
    startFreq: 900,
    endFreq: 200,
    duration: 0.3,
    shape: 'sawtooth',
    gain: 0.45,
    noise: 0.6,
    filterFrom: 4000,
    filterTo: 600,
  },
  faint: { startFreq: 500, endFreq: 90, duration: 0.7, shape: 'triangle', gain: 0.34, filterFrom: 1200, filterTo: 240 },
  orbThrow: { startFreq: 500, endFreq: 900, duration: 0.16, shape: 'triangle', gain: 0.26 },
  orbShake: { startFreq: 300, duration: 0.08, shape: 'square', gain: 0.24, repeatAt: 0.14, repeatPitch: 1.1 },
  orbClick: { startFreq: 1400, endFreq: 1800, duration: 0.16, shape: 'square', gain: 0.3, repeatAt: 0.1, repeatPitch: 1.25 },
  orbBreak: { startFreq: 700, endFreq: 200, duration: 0.3, shape: 'noise', gain: 0.35, filterFrom: 2400, filterTo: 400 },
  levelUp: {
    startFreq: 660,
    endFreq: 1320,
    duration: 0.4,
    shape: 'square',
    gain: 0.3,
    repeatAt: 0.16,
    repeatPitch: 1.5,
  },
  heal: { startFreq: 520, endFreq: 1040, duration: 0.34, shape: 'sine', gain: 0.26, detune: 8 },
  statUp: { startFreq: 700, endFreq: 1400, duration: 0.26, shape: 'triangle', gain: 0.26 },
  statDown: { startFreq: 700, endFreq: 350, duration: 0.26, shape: 'triangle', gain: 0.26 },
  status: { startFreq: 420, endFreq: 260, duration: 0.32, shape: 'sawtooth', gain: 0.24, filterFrom: 1400, filterTo: 500 },
  evolve: {
    startFreq: 300,
    endFreq: 1500,
    duration: 1.1,
    shape: 'triangle',
    gain: 0.3,
    detune: 12,
    filterFrom: 600,
    filterTo: 3200,
  },
  shiny: {
    startFreq: 1200,
    endFreq: 2400,
    duration: 0.5,
    shape: 'sine',
    gain: 0.3,
    repeatAt: 0.12,
    repeatPitch: 1.5,
  },
  victory: {
    startFreq: 523,
    duration: 0.18,
    shape: 'square',
    gain: 0.3,
    repeatAt: 0.18,
    repeatPitch: 1.26,
  },
  money: { startFreq: 1100, endFreq: 1600, duration: 0.14, shape: 'square', gain: 0.22, repeatAt: 0.09, repeatPitch: 1.3 },
  save: { startFreq: 700, endFreq: 1100, duration: 0.3, shape: 'sine', gain: 0.24, repeatAt: 0.14, repeatPitch: 1.2 },
  warp: { startFreq: 200, endFreq: 1800, duration: 0.6, shape: 'sawtooth', gain: 0.22, filterFrom: 400, filterTo: 4000 },
  lowHp: { startFreq: 880, duration: 0.1, shape: 'square', gain: 0.2, repeatAt: 0.18, repeatPitch: 1 },
  sigil: {
    startFreq: 660,
    endFreq: 990,
    duration: 0.6,
    shape: 'triangle',
    gain: 0.3,
    detune: 10,
    repeatAt: 0.2,
    repeatPitch: 1.5,
  },
};

/** Per-wave gain trim so nothing clips. */
export const WAVE_GAIN: Record<WaveShape, number> = {
  sine: 1,
  triangle: 0.8,
  square: 0.55,
  sawtooth: 0.5,
  noise: 0.4,
};

export function sfxNames(): string[] {
  return Object.keys(SFX);
}
