/**
 * A tiny chiptune sequencer.
 *
 * Tracks are note lists per channel (lead, bass, pad, percussion). A look-ahead
 * scheduler fires every 25 ms and schedules anything falling inside the next
 * 120 ms, which keeps timing tight without a worker or a sample-accurate clock.
 * Everything is generated from oscillators and filtered noise.
 */

import type { WaveShape } from './SfxSynth';

export interface TrackNote {
  /** Beat within the loop (0-based, floats allowed). */
  beat: number;
  /** MIDI note number, or 36/38/42 for kick/snare/hat on percussion. */
  note: number;
  /** Length in beats. */
  length: number;
  /** Per-note gain multiplier. */
  velocity?: number;
}

export type ChannelKind = 'lead' | 'bass' | 'pad' | 'perc';

export interface TrackChannel {
  kind: ChannelKind;
  wave: WaveShape;
  gain: number;
  notes: TrackNote[];
  /** Low-pass cutoff in Hz. */
  filter?: number;
  detune?: number;
}

export interface Track {
  id: string;
  name: string;
  bpm: number;
  /** Loop length in beats. */
  beats: number;
  channels: TrackChannel[];
}

/** Note-name parser: "C4", "F#3", "Bb5" -> MIDI number. */
const SEMITONES: Record<string, number> = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
};

export function note(name: string): number {
  const match = /^([A-G][#b]?)(-?\d)$/.exec(name.trim());
  if (!match) return 60;
  const semitone = SEMITONES[match[1]] ?? 0;
  const octave = Number(match[2]);
  return (octave + 1) * 12 + semitone;
}

/** Compact note builder: `n(0, 'C4', 1)`. */
export function n(beat: number, name: string, length: number, velocity = 1): TrackNote {
  return { beat, note: note(name), length, velocity };
}

/** Percussion helpers. */
export const kick = (beat: number, velocity = 1): TrackNote => ({ beat, note: 36, length: 0.25, velocity });
export const snare = (beat: number, velocity = 1): TrackNote => ({ beat, note: 38, length: 0.25, velocity });
export const hat = (beat: number, velocity = 0.6): TrackNote => ({ beat, note: 42, length: 0.12, velocity });

export class Sequencer {
  private ctx: AudioContext;
  private master: GainNode;
  private schedulerId?: number;
  private track: Track | null = null;
  private nextBeatTime = 0;
  private currentBeat = 0;
  private playing = false;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(destination);
  }

  setVolume(volume: number): void {
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(Math.max(0, Math.min(1, volume)), now, 0.05);
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  get currentTrackId(): string | null {
    return this.track?.id ?? null;
  }

  play(track: Track, crossfadeSeconds = 0.6): void {
    if (this.playing && this.track?.id === track.id) return;

    if (this.playing) {
      // Fade the old one out and hard-cut to the new track.
      const old = this.track;
      void old;
      this.stop(crossfadeSeconds);
    }

    this.track = track;
    this.playing = true;
    this.currentBeat = 0;
    this.nextBeatTime = this.ctx.currentTime + 0.08;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.setValueAtTime(0, this.ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(0.6, this.ctx.currentTime + crossfadeSeconds);

    this.schedulerId = window.setInterval(() => this.schedule(), 25);
  }

  stop(fadeSeconds = 0.4): void {
    if (!this.playing) return;
    this.playing = false;
    if (this.schedulerId !== undefined) {
      window.clearInterval(this.schedulerId);
      this.schedulerId = undefined;
    }
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(0, now, Math.max(0.01, fadeSeconds / 3));
    this.track = null;
  }

  private schedule(): void {
    if (!this.track || !this.playing) return;
    const lookahead = 0.12;
    const secondsPerBeat = 60 / this.track.bpm;

    while (this.nextBeatTime < this.ctx.currentTime + lookahead) {
      const beat = this.currentBeat;
      for (const channel of this.track.channels) {
        for (const noteData of channel.notes) {
          if (Math.abs(noteData.beat - beat) < 0.001) {
            this.playNote(channel, noteData, this.nextBeatTime, secondsPerBeat);
          }
        }
      }
      this.currentBeat = (this.currentBeat + 1) % this.track.beats;
      this.nextBeatTime += secondsPerBeat;
    }
  }

  private playNote(
    channel: TrackChannel,
    noteData: TrackNote,
    time: number,
    secondsPerBeat: number,
  ): void {
    const velocity = noteData.velocity ?? 1;
    if (channel.kind === 'perc') {
      this.playPercussion(noteData.note, time, channel.gain * velocity);
      return;
    }

    const duration = Math.max(0.05, noteData.length * secondsPerBeat * 0.92);
    const freq = 440 * Math.pow(2, (noteData.note - 69) / 12);

    const osc = this.ctx.createOscillator();
    osc.type = channel.wave === 'noise' ? 'square' : channel.wave;
    osc.frequency.value = freq;

    if (channel.detune) {
      osc.detune.value = channel.detune;
    }

    const env = this.ctx.createGain();
    const peak = channel.gain * velocity;
    const attack = channel.kind === 'pad' ? 0.09 : 0.008;
    const release = channel.kind === 'pad' ? 0.35 : 0.11;

    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(peak, time + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, time + duration + release);

    let node: AudioNode = osc;
    if (channel.filter) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = channel.filter;
      filter.Q.value = 1.2;
      osc.connect(filter);
      node = filter;
    }
    node.connect(env);
    env.connect(this.master);

    osc.start(time);
    osc.stop(time + duration + release + 0.02);
  }

  private playPercussion(kind: number, time: number, gain: number): void {
    if (kind === 42) {
      // Hat: short filtered noise burst.
      const buffer = this.noiseBuffer(0.06);
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 6000;
      const env = this.ctx.createGain();
      env.gain.setValueAtTime(gain * 0.6, time);
      env.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
      source.connect(hp);
      hp.connect(env);
      env.connect(this.master);
      source.start(time);
      return;
    }

    if (kind === 38) {
      // Snare: noise plus a short tone.
      const source = this.ctx.createBufferSource();
      source.buffer = this.noiseBuffer(0.14);
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1800;
      bp.Q.value = 0.8;
      const env = this.ctx.createGain();
      env.gain.setValueAtTime(gain * 0.8, time);
      env.gain.exponentialRampToValueAtTime(0.0001, time + 0.13);
      source.connect(bp);
      bp.connect(env);
      env.connect(this.master);
      source.start(time);
      return;
    }

    // Kick: a fast downward pitch sweep.
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.12);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(gain, time);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
    osc.connect(env);
    env.connect(this.master);
    osc.start(time);
    osc.stop(time + 0.2);
  }

  private noiseCache = new Map<number, AudioBuffer>();

  private noiseBuffer(seconds: number): AudioBuffer {
    const rounded = Math.round(seconds * 1000) / 1000;
    const cached = this.noiseCache.get(rounded);
    if (cached) return cached;
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * seconds));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseCache.set(rounded, buffer);
    return buffer;
  }

  destroy(): void {
    this.stop(0);
    this.master.disconnect();
  }
}
