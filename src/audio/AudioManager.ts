/**
 * The single audio entry point.
 *
 * Everything is synthesised: sound effects from `SfxSynth` recipes, creature
 * cries from `CryGenerator`, and music from the chiptune `Sequencer`. The
 * manager owns one AudioContext, two buses (music and SFX) and the mute state.
 *
 * Browsers require a user gesture before audio can start, so `unlock()` is
 * called on the first confirm press anywhere in the game.
 */

import { Sequencer } from './Sequencer';
import { getTrack, type TrackId } from './tracks';
import { SFX, WAVE_GAIN, type SfxRecipe, type WaveShape } from './SfxSynth';
import { cryFor } from './CryGenerator';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type GameSettings } from '../core/SaveManager';

class AudioManagerImpl {
  private ctx: AudioContext | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private sequencer: Sequencer | null = null;
  private settings: GameSettings = { ...DEFAULT_SETTINGS };
  private unlocked = false;
  private currentTrack: TrackId | null = null;

  constructor() {
    this.settings = loadSettings();
  }

  /** Create the audio graph. Safe to call repeatedly. */
  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof window === 'undefined') return null;
    const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      this.ctx = new Ctor();
      this.musicBus = this.ctx.createGain();
      this.sfxBus = this.ctx.createGain();
      this.musicBus.connect(this.ctx.destination);
      this.sfxBus.connect(this.ctx.destination);
      this.applyVolumes();
      this.sequencer = new Sequencer(this.ctx, this.musicBus);
      return this.ctx;
    } catch {
      return null;
    }
  }

  /** Called on the first user interaction; resumes a suspended context. */
  unlock(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();
    this.unlocked = true;
  }

  get isUnlocked(): boolean {
    return this.unlocked;
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.musicBus || !this.sfxBus) return;
    const muted = this.settings.muted;
    const now = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(muted ? 0 : this.settings.musicVolume, now, 0.05);
    this.sfxBus.gain.setTargetAtTime(muted ? 0 : this.settings.sfxVolume, now, 0.02);
  }

  applySettings(settings: GameSettings): void {
    this.settings = { ...settings };
    this.applyVolumes();
    saveSettings(this.settings);
  }

  getSettings(): GameSettings {
    return { ...this.settings };
  }

  setMusicVolume(volume: number): void {
    this.settings.musicVolume = Math.max(0, Math.min(1, volume));
    this.applyVolumes();
    saveSettings(this.settings);
  }

  setSfxVolume(volume: number): void {
    this.settings.sfxVolume = Math.max(0, Math.min(1, volume));
    this.applyVolumes();
    saveSettings(this.settings);
  }

  setMuted(muted: boolean): void {
    this.settings.muted = muted;
    this.applyVolumes();
    saveSettings(this.settings);
  }

  toggleMute(): boolean {
    this.setMuted(!this.settings.muted);
    return this.settings.muted;
  }

  /* ----------------------------------------------------------------- sfx -- */

  /** Play a named sound effect. */
  playSfx(name: keyof typeof SFX | string, pitch = 1): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus || this.settings.muted || this.settings.sfxVolume <= 0) return;
    const recipe = SFX[name as string];
    if (!recipe) return;
    this.renderSfx(ctx, this.sfxBus, recipe, ctx.currentTime, pitch);

    if (recipe.repeatAt !== undefined) {
      this.renderSfx(
        ctx,
        this.sfxBus,
        recipe,
        ctx.currentTime + recipe.repeatAt,
        pitch * (recipe.repeatPitch ?? 1),
      );
    }
  }

  private renderSfx(
    ctx: AudioContext,
    destination: AudioNode,
    recipe: SfxRecipe,
    time: number,
    pitch: number,
  ): void {
    const start = recipe.startFreq * pitch;
    const end = (recipe.endFreq ?? recipe.startFreq) * pitch;
    const duration = Math.max(0.01, recipe.duration);
    const peak = (recipe.gain ?? 0.3) * WAVE_GAIN[recipe.shape];

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(peak, time + (recipe.attack ?? 0.006));
    env.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    let node: AudioNode;
    if (recipe.shape === 'noise') {
      const source = ctx.createBufferSource();
      source.buffer = this.noiseBuffer(ctx, duration);
      node = source;
    } else {
      const osc = ctx.createOscillator();
      osc.type = recipe.shape as OscillatorType;
      osc.frequency.setValueAtTime(start, time);
      if (recipe.endFreq !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), time + duration);
      }
      if (recipe.detune) osc.detune.value = recipe.detune;
      osc.start(time);
      osc.stop(time + duration + 0.05);
      node = osc;
    }

    if (recipe.filterFrom !== undefined) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(recipe.filterFrom, time);
      if (recipe.filterTo !== undefined) {
        filter.frequency.exponentialRampToValueAtTime(
          Math.max(60, recipe.filterTo),
          time + duration,
        );
      }
      node.connect(filter);
      node = filter;
    }

    node.connect(env);
    env.connect(destination);

    if (recipe.noise) {
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = this.noiseBuffer(ctx, Math.min(0.2, duration));
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(peak * recipe.noise, time);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
      noiseSource.connect(noiseGain);
      noiseGain.connect(destination);
      noiseSource.start(time);
    }
  }

  /** A one-shot creature cry. */
  playCry(speciesId: string, dexNumber: number, tier = 'basic'): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus || this.settings.muted || this.settings.sfxVolume <= 0) return;

    const cry = cryFor(speciesId, dexNumber, tier);
    const time = ctx.currentTime;
    const duration = cry.duration;

    const osc = ctx.createOscillator();
    osc.type = cry.shape as OscillatorType;
    osc.frequency.setValueAtTime(cry.freq, time);
    osc.frequency.linearRampToValueAtTime(cry.endFreq, time + duration);

    // Vibrato makes each cry feel alive.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = cry.wobbleRate;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = cry.wobble;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start(time);
    lfo.stop(time + duration + 0.1);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(cry.gain * WAVE_GAIN[cry.shape === 'noise' ? 'square' : (cry.shape as WaveShape)], time + 0.02);
    // A few amplitude pulses give the cry its character.
    const step = duration / (cry.pulses * 2);
    for (let i = 0; i < cry.pulses * 2; i++) {
      const t = time + i * step;
      env.gain.linearRampToValueAtTime(i % 2 === 0 ? cry.gain : cry.gain * 0.45, Math.min(t, time + duration));
    }
    env.gain.exponentialRampToValueAtTime(0.0001, time + duration + 0.05);

    osc.connect(env);
    env.connect(this.sfxBus);
    osc.start(time);
    osc.stop(time + duration + 0.08);

    if (cry.noise > 0) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer(ctx, duration);
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(cry.gain * cry.noise, time);
      nGain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = cry.freq * 2;
      noise.connect(bp);
      bp.connect(nGain);
      nGain.connect(this.sfxBus);
      noise.start(time);
    }
  }

  /* --------------------------------------------------------------- music -- */

  playMusic(trackId: TrackId, crossfade = 0.6): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sequencer) return;
    if (this.settings.muted || this.settings.musicVolume <= 0) {
      this.currentTrack = trackId;
      return;
    }
    const track = getTrack(trackId);
    if (!track) return;
    this.sequencer.play(track, crossfade);
    this.currentTrack = trackId;
  }

  stopMusic(fade = 0.4): void {
    this.sequencer?.stop(fade);
    this.currentTrack = null;
  }

  get nowPlaying(): TrackId | null {
    return this.currentTrack;
  }

  /** Duck the music briefly, e.g. under a cry or a fanfare. */
  duck(amount = 0.35, durationMs = 900): void {
    if (!this.ctx || !this.musicBus) return;
    const now = this.ctx.currentTime;
    const target = this.settings.muted ? 0 : this.settings.musicVolume;
    this.musicBus.gain.cancelScheduledValues(now);
    this.musicBus.gain.setTargetAtTime(target * amount, now, 0.05);
    window.setTimeout(() => {
      if (!this.ctx || !this.musicBus) return;
      const t = this.ctx.currentTime;
      const restore = this.settings.muted ? 0 : this.settings.musicVolume;
      this.musicBus.gain.setTargetAtTime(restore, t, 0.15);
    }, durationMs);
  }

  private noiseCache = new Map<number, AudioBuffer>();

  private noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
    const rounded = Math.max(0.01, Math.round(seconds * 1000) / 1000);
    const cached = this.noiseCache.get(rounded);
    if (cached) return cached;
    const length = Math.max(1, Math.floor(ctx.sampleRate * rounded));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseCache.set(rounded, buffer);
    return buffer;
  }

  destroy(): void {
    this.sequencer?.destroy();
    this.ctx?.close();
    this.ctx = null;
  }
}

/** Single shared instance. */
export const Audio = new AudioManagerImpl();
