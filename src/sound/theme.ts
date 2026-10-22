import type { MidiSong } from './midi';

/**
 * Bapu's theme as plain data: a melody and a chord track, from a hummed MIDI file
 * (scripts/build-theme.ts writes content/music/theme.json). The engine plays it as the
 * home music when no recorded track is listed, and level cues borrow its opening phrase.
 */

export interface Theme {
  source: string;
  bpm: number;
  beatsPerBar: number;
  /** Loop length in beats: the song rounded up to a whole bar. */
  length: number;
  /** [beat, MIDI note, length in beats] */
  melody: [number, number, number][];
  /** [beat, MIDI notes, length in beats] */
  chords: [number, number[], number][];
}

const round = (x: number) => Math.round(x * 1000) / 1000;

/** Turns a parsed hum into theme data. Tracks named "Melody" and "Chords" (Surilo's names) win; otherwise the first two. */
export function themeFromMidi(song: MidiSong, source: string): Theme {
  const named = (re: RegExp) => song.tracks.find((t) => re.test(t.name));
  const melodyTrack = named(/melody|lead|hum/i) ?? song.tracks[0];
  const chordTrack = named(/chord|harmony|pad/i) ?? song.tracks.find((t) => t !== melodyTrack);
  if (!melodyTrack) throw new Error('No notes in the MIDI file');

  const chords = new Map<number, { notes: number[]; len: number }>();
  for (const n of chordTrack?.notes ?? []) {
    const at = round(n.beat);
    const c = chords.get(at) ?? { notes: [], len: 0 };
    c.notes.push(n.note);
    c.len = Math.max(c.len, round(n.len));
    chords.set(at, c);
  }

  const melody = melodyTrack.notes.map((n) => [round(n.beat), n.note, round(n.len)] as [number, number, number]);
  const lastBeat = Math.max(...melody.map(([b, , l]) => b + l), ...[...chords].map(([b, c]) => b + c.len));
  const bar = song.beatsPerBar;

  return {
    source,
    bpm: song.bpm,
    beatsPerBar: bar,
    length: Math.ceil(lastBeat / bar - 1e-6) * bar,
    melody,
    chords: [...chords].sort(([a], [b]) => a - b).map(([b, c]) => [b, c.notes.sort((x, y) => x - y), c.len]),
  };
}

/** The root of a chord: the note with a fifth above it in the chord (else the lowest note). */
export function chordRoot(notes: number[]): number {
  const classes = new Set(notes.map((n) => n % 12));
  return notes.find((n) => classes.has((n + 7) % 12) && (classes.has((n + 3) % 12) || classes.has((n + 4) % 12))) ?? notes[0];
}

/** Shifts by whole octaves so the melody's lowest note sits at or above `floor`. */
export function octaveShift(notes: number[], floor: number): number {
  const low = Math.min(...notes);
  return Math.max(0, Math.ceil((floor - low) / 12)) * 12;
}

/** The theme's first bar, for short cues like the level-complete tune. */
export function openingPhrase(theme: Theme): [number, number, number][] {
  return theme.melody.filter(([b]) => b < theme.beatsPerBar);
}
