/**
 * The Prismara soundtrack — authored as note data for the chiptune sequencer.
 *
 * Each track is a short loop: a lead melody, a bass line, a chord pad and
 * percussion. Because the tracks are data, they can be retimed, transposed and
 * crossfaded for free, and they add no download weight.
 */

import { hat, kick, n, snare, type Track, type TrackChannel, type TrackNote } from './Sequencer';

function channel(
  kind: TrackChannel['kind'],
  wave: TrackChannel['wave'],
  gain: number,
  notes: TrackNote[],
  filter?: number,
  detune?: number,
): TrackChannel {
  const c: TrackChannel = { kind, wave, gain, notes };
  if (filter !== undefined) c.filter = filter;
  if (detune !== undefined) c.detune = detune;
  return c;
}

/** Build a pad from a list of chords: [beat, [notes], length]. */
function pad(
  chords: Array<[number, string[], number]>,
  gain = 0.1,
): TrackChannel {
  const notes: TrackNote[] = [];
  for (const [beat, chord, length] of chords) {
    for (const name of chord) notes.push(n(beat, name, length, 0.7));
  }
  return channel('pad', 'triangle', gain, notes, 2200);
}

/** A straight eighth-note bass groove following a root per bar. */
function bassGroove(roots: string[], beatsPerBar = 4, pattern = [0, 1.5, 2, 3.5]): TrackNote[] {
  const notes: TrackNote[] = [];
  roots.forEach((root, bar) => {
    for (const offset of pattern) {
      notes.push(n(bar * beatsPerBar + offset, root, 0.45, 0.9));
    }
  });
  return notes;
}

/** Four-on-the-floor plus a backbeat. */
function drums(beats: number, style: 'steady' | 'drive' | 'soft' | 'epic' = 'steady'): TrackNote[] {
  const notes: TrackNote[] = [];
  for (let b = 0; b < beats; b++) {
    const onBeat = b % 4 === 0;
    const backbeat = b % 4 === 2;
    if (style === 'soft') {
      if (b % 2 === 0) notes.push(kick(b, 0.5));
      if (backbeat) notes.push(hat(b));
      continue;
    }
    if (onBeat) notes.push(kick(b, 0.9));
    if (backbeat || style === 'epic') notes.push(snare(b, style === 'epic' ? 0.8 : 0.6));
    if (style === 'drive') notes.push(hat(b + 0.5, 0.5));
    notes.push(hat(b, 0.35));
  }
  return notes;
}

/* --------------------------------------------------------------- tracks -- */

const town: Track = {
  id: 'town',
  name: 'Emberleaf Town',
  bpm: 96,
  beats: 16,
  channels: [
    channel(
      'lead',
      'square',
      0.16,
      [
        n(0, 'E5', 0.9),
        n(1.5, 'G5', 0.45),
        n(2, 'A5', 0.9),
        n(3.5, 'G5', 0.45),
        n(4, 'E5', 1.4),
        n(6, 'D5', 0.9),
        n(7.5, 'E5', 0.45),
        n(8, 'G5', 0.9),
        n(9.5, 'A5', 0.45),
        n(10, 'C6', 1.4),
        n(12, 'A5', 0.9),
        n(13.5, 'G5', 0.45),
        n(14, 'E5', 1.6),
      ],
      undefined,
      6,
    ),
    channel('bass', 'triangle', 0.2, bassGroove(['C3', 'A2', 'F2', 'G2'])),
    pad([
      [0, ['C4', 'E4', 'G4'], 4],
      [4, ['A3', 'C4', 'E4'], 4],
      [8, ['F3', 'A3', 'C4'], 4],
      [12, ['G3', 'B3', 'D4'], 4],
    ]),
    channel('perc', 'noise', 0.5, drums(16, 'soft')),
  ],
};

const route: Track = {
  id: 'route',
  name: 'Meadow Path',
  bpm: 126,
  beats: 16,
  channels: [
    channel(
      'lead',
      'square',
      0.15,
      [
        n(0, 'G4', 0.45),
        n(0.5, 'A4', 0.45),
        n(1, 'B4', 0.9),
        n(2, 'D5', 0.9),
        n(3, 'B4', 0.45),
        n(3.5, 'A4', 0.45),
        n(4, 'G4', 0.9),
        n(5, 'B4', 0.9),
        n(6, 'D5', 0.45),
        n(6.5, 'E5', 0.45),
        n(7, 'D5', 0.9),
        n(8, 'C5', 0.45),
        n(8.5, 'B4', 0.45),
        n(9, 'A4', 0.9),
        n(10, 'G4', 0.9),
        n(11, 'A4', 0.45),
        n(11.5, 'B4', 0.45),
        n(12, 'C5', 1.8),
        n(14, 'B4', 0.9),
        n(15, 'G4', 0.9),
      ],
      undefined,
      8,
    ),
    channel('bass', 'sawtooth', 0.18, bassGroove(['G2', 'E2', 'C3', 'D3']), 900),
    pad([
      [0, ['G3', 'B3', 'D4'], 4],
      [4, ['E3', 'G3', 'B3'], 4],
      [8, ['C4', 'E4', 'G4'], 4],
      [12, ['D4', 'F#4', 'A4'], 4],
    ]),
    channel('perc', 'noise', 0.55, drums(16, 'drive')),
  ],
};

const forest: Track = {
  id: 'forest',
  name: 'Whisperwood',
  bpm: 92,
  beats: 16,
  channels: [
    channel(
      'lead',
      'triangle',
      0.17,
      [
        n(0, 'A4', 1.4),
        n(2, 'C5', 0.9),
        n(3, 'B4', 0.9),
        n(4, 'E4', 1.4),
        n(6, 'G4', 0.9),
        n(7, 'A4', 0.9),
        n(8, 'C5', 1.4),
        n(10, 'D5', 0.9),
        n(11, 'C5', 0.9),
        n(12, 'A4', 2.2),
        n(15, 'E4', 0.9),
      ],
      undefined,
      4,
    ),
    channel('bass', 'sine', 0.22, bassGroove(['A2', 'F2', 'C3', 'E2'], 4, [0, 2])),
    pad([
      [0, ['A3', 'C4', 'E4'], 4],
      [4, ['F3', 'A3', 'C4'], 4],
      [8, ['C4', 'E4', 'G4'], 4],
      [12, ['E3', 'G3', 'B3'], 4],
    ], 0.09),
    channel('perc', 'noise', 0.4, drums(16, 'soft')),
  ],
};

const city: Track = {
  id: 'city',
  name: 'Voltspire City',
  bpm: 122,
  beats: 16,
  channels: [
    channel(
      'lead',
      'square',
      0.14,
      Array.from({ length: 16 }, (_, i) =>
        n(i * 0.5, ['E5', 'G5', 'B5', 'G5', 'A5', 'G5', 'E5', 'D5'][i % 8], 0.4, 0.85),
      ),
      undefined,
      10,
    ),
    channel('bass', 'sawtooth', 0.2, bassGroove(['E2', 'E2', 'C3', 'D3'], 4, [0, 1, 2, 3]), 700),
    pad([
      [0, ['E3', 'G3', 'B3'], 4],
      [4, ['E3', 'G3', 'B3'], 4],
      [8, ['C4', 'E4', 'G4'], 4],
      [12, ['D4', 'F#4', 'A4'], 4],
    ], 0.08),
    channel('perc', 'noise', 0.6, drums(16, 'drive')),
  ],
};

const cave: Track = {
  id: 'cave',
  name: 'Deep Hollow',
  bpm: 74,
  beats: 16,
  channels: [
    channel(
      'lead',
      'sine',
      0.14,
      [
        n(0, 'D4', 2.6),
        n(4, 'F4', 1.6),
        n(6, 'E4', 2),
        n(8, 'A3', 2.6),
        n(12, 'C4', 3.4),
      ],
      undefined,
      3,
    ),
    channel('bass', 'sine', 0.24, bassGroove(['D2', 'D2', 'A1', 'A1'], 4, [0, 2.5])),
    pad([
      [0, ['D3', 'F3', 'A3'], 8],
      [8, ['A2', 'C3', 'E3'], 8],
    ], 0.11),
    channel('perc', 'noise', 0.28, drums(16, 'soft')),
  ],
};

const beach: Track = {
  id: 'beach',
  name: 'Coral Coast',
  bpm: 108,
  beats: 16,
  channels: [
    channel(
      'lead',
      'triangle',
      0.16,
      [
        n(0, 'C5', 0.9),
        n(1, 'E5', 0.45),
        n(1.5, 'G5', 0.45),
        n(2, 'A5', 1.4),
        n(4, 'G5', 0.9),
        n(5, 'E5', 0.9),
        n(6, 'C5', 1.8),
        n(8, 'D5', 0.9),
        n(9, 'F5', 0.45),
        n(9.5, 'A5', 0.45),
        n(10, 'C6', 1.4),
        n(12, 'A5', 0.9),
        n(13, 'G5', 0.9),
        n(14, 'E5', 1.8),
      ],
      undefined,
      6,
    ),
    channel('bass', 'triangle', 0.19, bassGroove(['C3', 'A2', 'F2', 'G2'], 4, [0, 2, 3])),
    pad([
      [0, ['C4', 'E4', 'G4'], 4],
      [4, ['A3', 'C4', 'E4'], 4],
      [8, ['F3', 'A3', 'C4'], 4],
      [12, ['G3', 'B3', 'D4'], 4],
    ]),
    channel('perc', 'noise', 0.5, drums(16, 'steady')),
  ],
};

const volcano: Track = {
  id: 'volcano',
  name: 'Cinder Peak',
  bpm: 116,
  beats: 16,
  channels: [
    channel(
      'lead',
      'sawtooth',
      0.15,
      [
        n(0, 'D4', 0.9),
        n(1, 'F4', 0.9),
        n(2, 'A4', 1.6),
        n(4, 'G4', 0.9),
        n(5, 'F4', 0.9),
        n(6, 'D4', 1.6),
        n(8, 'A4', 0.9),
        n(9, 'C5', 0.9),
        n(10, 'D5', 1.6),
        n(12, 'C5', 0.9),
        n(13, 'A4', 0.9),
        n(14, 'F4', 1.8),
      ],
      2200,
      7,
    ),
    channel('bass', 'sawtooth', 0.22, bassGroove(['D2', 'D2', 'Bb1', 'C2']), 600),
    pad([
      [0, ['D3', 'F3', 'A3'], 8],
      [8, ['Bb2', 'D3', 'F3'], 4],
      [12, ['C3', 'E3', 'G3'], 4],
    ], 0.1),
    channel('perc', 'noise', 0.6, drums(16, 'drive')),
  ],
};

const ruins: Track = {
  id: 'ruins',
  name: 'Duskmoor Ruins',
  bpm: 86,
  beats: 16,
  channels: [
    channel(
      'lead',
      'triangle',
      0.16,
      [
        n(0, 'A4', 1.6),
        n(2, 'Bb4', 0.9),
        n(3, 'A4', 0.9),
        n(4, 'F4', 2),
        n(6.5, 'E4', 1.4),
        n(8, 'C5', 1.6),
        n(10, 'Db5', 0.9),
        n(11, 'C5', 0.9),
        n(12, 'A4', 2),
        n(14.5, 'G4', 1.4),
      ],
      undefined,
      5,
    ),
    channel('bass', 'sine', 0.24, bassGroove(['A2', 'F2', 'C3', 'E2'], 4, [0, 1.5, 3])),
    pad([
      [0, ['A3', 'C4', 'E4'], 4],
      [4, ['F3', 'A3', 'C4'], 4],
      [8, ['C4', 'Eb4', 'G4'], 4],
      [12, ['E3', 'G3', 'B3'], 4],
    ], 0.11),
    channel('perc', 'noise', 0.36, drums(16, 'soft')),
  ],
};

const summit: Track = {
  id: 'summit',
  name: 'Prism Summit',
  bpm: 82,
  beats: 16,
  channels: [
    channel(
      'lead',
      'sine',
      0.17,
      [
        n(0, 'C5', 2),
        n(2, 'E5', 1.4),
        n(4, 'G5', 2.6),
        n(8, 'A5', 2),
        n(10, 'G5', 1.4),
        n(12, 'E5', 3.4),
      ],
      undefined,
      4,
    ),
    channel('bass', 'triangle', 0.2, bassGroove(['C3', 'G2', 'A2', 'F2'], 4, [0, 2])),
    pad([
      [0, ['C4', 'E4', 'G4'], 8],
      [8, ['A3', 'C4', 'E4'], 4],
      [12, ['F3', 'A3', 'C4'], 4],
    ], 0.12),
    channel('perc', 'noise', 0.42, drums(16, 'epic')),
  ],
};

function battleTrack(id: string, name: string, bpm: number, lead: TrackNote[], bassRoots: string[]): Track {
  return {
    id,
    name,
    bpm,
    beats: 16,
    channels: [
      channel('lead', 'square', 0.16, lead, undefined, 9),
      channel('bass', 'sawtooth', 0.22, bassGroove(bassRoots, 4, [0, 1, 1.5, 2, 3, 3.5]), 800),
      pad([
        [0, ['E3', 'G3', 'B3'], 4],
        [4, ['E3', 'G3', 'B3'], 4],
        [8, ['C4', 'E4', 'G4'], 4],
        [12, ['D4', 'F#4', 'A4'], 4],
      ], 0.09),
      channel('perc', 'noise', 0.62, drums(16, 'drive')),
    ],
  };
}

const battleWild = battleTrack(
  'battle-wild',
  'Wild Battle',
  148,
  [
    n(0, 'E5', 0.45), n(0.5, 'E5', 0.45), n(1, 'G5', 0.9), n(2, 'B5', 0.9),
    n(3, 'A5', 0.45), n(3.5, 'G5', 0.45), n(4, 'E5', 0.9), n(5, 'D5', 0.9),
    n(6, 'E5', 1.8), n(8, 'G5', 0.45), n(8.5, 'A5', 0.45), n(9, 'B5', 0.9),
    n(10, 'C6', 0.9), n(11, 'B5', 0.45), n(11.5, 'A5', 0.45), n(12, 'G5', 0.9),
    n(13, 'E5', 0.9), n(14, 'D5', 1.8),
  ],
  ['E2', 'E2', 'C3', 'D3'],
);

const battleTrainer = battleTrack(
  'battle-trainer',
  'Trainer Battle',
  154,
  [
    n(0, 'A4', 0.45), n(0.5, 'C5', 0.45), n(1, 'E5', 0.9), n(2, 'D5', 0.45),
    n(2.5, 'C5', 0.45), n(3, 'A4', 0.9), n(4, 'C5', 0.45), n(4.5, 'E5', 0.45),
    n(5, 'A5', 0.9), n(6, 'G5', 1.8), n(8, 'F5', 0.45), n(8.5, 'E5', 0.45),
    n(9, 'D5', 0.9), n(10, 'E5', 0.9), n(11, 'F5', 0.9), n(12, 'E5', 0.45),
    n(12.5, 'D5', 0.45), n(13, 'C5', 0.9), n(14, 'A4', 1.8),
  ],
  ['A2', 'F2', 'C3', 'E2'],
);

const battleTrial = battleTrack(
  'battle-trial',
  'Trial Master',
  160,
  [
    n(0, 'D5', 0.45), n(0.5, 'F5', 0.45), n(1, 'A5', 0.9), n(2, 'G5', 0.45),
    n(2.5, 'F5', 0.45), n(3, 'D5', 0.9), n(4, 'F5', 0.45), n(4.5, 'A5', 0.45),
    n(5, 'C6', 1.4), n(6.5, 'A5', 1.4), n(8, 'Bb5', 0.45), n(8.5, 'A5', 0.45),
    n(9, 'G5', 0.9), n(10, 'F5', 0.9), n(11, 'E5', 0.9), n(12, 'D5', 0.45),
    n(12.5, 'E5', 0.45), n(13, 'F5', 0.9), n(14, 'D5', 1.8),
  ],
  ['D2', 'D2', 'Bb1', 'C2'],
);

const battleLegendary: Track = {
  id: 'battle-legendary',
  name: 'Legendary Battle',
  bpm: 138,
  beats: 16,
  channels: [
    channel(
      'lead',
      'sawtooth',
      0.17,
      [
        n(0, 'C5', 0.9), n(1, 'Eb5', 0.9), n(2, 'G5', 1.8), n(4, 'Bb5', 0.9),
        n(5, 'G5', 0.9), n(6, 'Eb5', 1.8), n(8, 'Ab5', 0.9), n(9, 'G5', 0.9),
        n(10, 'F5', 0.9), n(11, 'Eb5', 0.9), n(12, 'C5', 0.9), n(13, 'D5', 0.9),
        n(14, 'Eb5', 1.8),
      ],
      2600,
      11,
    ),
    channel('bass', 'sawtooth', 0.24, bassGroove(['C2', 'C2', 'Ab1', 'Bb1'], 4, [0, 1, 2, 3]), 500),
    pad([
      [0, ['C3', 'Eb3', 'G3'], 4],
      [4, ['C3', 'Eb3', 'G3'], 4],
      [8, ['Ab2', 'C3', 'Eb3'], 4],
      [12, ['Bb2', 'D3', 'F3'], 4],
    ], 0.12),
    channel('perc', 'noise', 0.66, drums(16, 'epic')),
  ],
};

const victory: Track = {
  id: 'victory',
  name: 'Victory',
  bpm: 132,
  beats: 8,
  channels: [
    channel(
      'lead',
      'square',
      0.2,
      [
        n(0, 'C5', 0.35), n(0.4, 'E5', 0.35), n(0.8, 'G5', 0.35), n(1.2, 'C6', 0.9),
        n(2.4, 'G5', 0.35), n(2.8, 'C6', 1.6),
        n(5, 'A5', 0.35), n(5.4, 'C6', 0.35), n(5.8, 'E6', 1.8),
      ],
      undefined,
      6,
    ),
    channel('bass', 'triangle', 0.22, bassGroove(['C3', 'C3'], 4, [0, 1, 2, 3])),
    pad([
      [0, ['C4', 'E4', 'G4'], 4],
      [4, ['F3', 'A3', 'C4'], 4],
    ], 0.12),
    channel('perc', 'noise', 0.6, drums(8, 'drive')),
  ],
};

const evolution: Track = {
  id: 'evolution',
  name: 'Evolution',
  bpm: 100,
  beats: 16,
  channels: [
    channel(
      'lead',
      'sine',
      0.16,
      [
        n(0, 'C5', 1.9), n(2, 'E5', 1.9), n(4, 'G5', 1.9), n(6, 'B5', 1.9),
        n(8, 'C6', 3.9), n(12, 'E6', 3.9),
      ],
      undefined,
      7,
    ),
    channel('bass', 'sine', 0.18, bassGroove(['C3', 'A2', 'F2', 'G2'], 4, [0, 2])),
    pad([
      [0, ['C4', 'E4', 'G4'], 4],
      [4, ['A3', 'C4', 'E4'], 4],
      [8, ['F3', 'A3', 'C4'], 4],
      [12, ['G3', 'B3', 'D4'], 4],
    ], 0.13),
    channel('perc', 'noise', 0.3, drums(16, 'soft')),
  ],
};

const title: Track = {
  id: 'title',
  name: 'Prismara',
  bpm: 108,
  beats: 16,
  channels: [
    channel(
      'lead',
      'square',
      0.17,
      [
        n(0, 'G4', 0.9), n(1, 'B4', 0.9), n(2, 'D5', 1.8), n(4, 'E5', 0.9),
        n(5, 'D5', 0.9), n(6, 'B4', 1.8), n(8, 'C5', 0.9), n(9, 'E5', 0.9),
        n(10, 'G5', 1.8), n(12, 'F5', 0.9), n(13, 'E5', 0.9), n(14, 'D5', 1.8),
      ],
      undefined,
      8,
    ),
    channel('bass', 'triangle', 0.2, bassGroove(['G2', 'E2', 'C3', 'D3'], 4, [0, 1.5, 2, 3])),
    pad([
      [0, ['G3', 'B3', 'D4'], 4],
      [4, ['E3', 'G3', 'B3'], 4],
      [8, ['C4', 'E4', 'G4'], 4],
      [12, ['D4', 'F#4', 'A4'], 4],
    ], 0.11),
    channel('perc', 'noise', 0.5, drums(16, 'steady')),
  ],
};

const credits: Track = {
  id: 'credits',
  name: 'Credits',
  bpm: 104,
  beats: 16,
  channels: [
    channel(
      'lead',
      'triangle',
      0.16,
      [
        n(0, 'E5', 1.9), n(2, 'D5', 0.9), n(3, 'C5', 0.9), n(4, 'D5', 1.9),
        n(6, 'E5', 1.9), n(8, 'G5', 1.9), n(10, 'F5', 0.9), n(11, 'E5', 0.9),
        n(12, 'D5', 3.9),
      ],
      undefined,
      5,
    ),
    channel('bass', 'sine', 0.2, bassGroove(['C3', 'G2', 'A2', 'F2'], 4, [0, 2])),
    pad([
      [0, ['C4', 'E4', 'G4'], 4],
      [4, ['G3', 'B3', 'D4'], 4],
      [8, ['A3', 'C4', 'E4'], 4],
      [12, ['F3', 'A3', 'C4'], 4],
    ], 0.12),
    channel('perc', 'noise', 0.34, drums(16, 'soft')),
  ],
};

export const TRACKS: Record<string, Track> = {
  title,
  town,
  route,
  forest,
  city,
  cave,
  beach,
  volcano,
  ruins,
  summit,
  'battle-wild': battleWild,
  'battle-trainer': battleTrainer,
  'battle-trial': battleTrial,
  'battle-legendary': battleLegendary,
  victory,
  evolution,
  credits,
};

export type TrackId = keyof typeof TRACKS;

export function getTrack(id: string): Track | undefined {
  return TRACKS[id];
}

/** Music that suits a map, used by the Overworld scene. */
export function trackForBiome(biome: string, timeOfDay: 'day' | 'night'): TrackId {
  switch (biome) {
    case 'forest':
      return 'forest';
    case 'city':
      return 'city';
    case 'beach':
      return 'beach';
    case 'volcano':
      return 'volcano';
    case 'cave':
      return 'cave';
    case 'ruins':
      return 'ruins';
    case 'summit':
      return 'summit';
    default:
      return timeOfDay === 'night' ? 'forest' : 'route';
  }
}
