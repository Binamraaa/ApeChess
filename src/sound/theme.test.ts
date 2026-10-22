import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import stored from '../../content/music/theme.json';
import { arrange } from './music';
import { parseMidi } from './midi';
import { chordRoot, octaveShift, openingPhrase, themeFromMidi, type Theme } from './theme';

const hum = parseMidi(readFileSync('content/music/hum-B-major.mid'));

describe('parseMidi', () => {
  it('reads tempo, metre and named tracks from a Surilo export', () => {
    expect(hum.bpm).toBe(100);
    expect(hum.beatsPerBar).toBe(4);
    expect(hum.tracks.map((t) => t.name)).toEqual(['Melody', 'Chords']);
  });

  it('pairs note on and off into notes with lengths in beats', () => {
    expect(hum.tracks[0].notes.slice(0, 3)).toEqual([
      { beat: 0, note: 47, len: 0.5, velocity: 96 },
      { beat: 0.5, note: 51, len: 0.5, velocity: 96 },
      { beat: 1, note: 54, len: 0.5, velocity: 96 },
    ]);
  });

  it('rejects files that are not MIDI', () => {
    expect(() => parseMidi(new TextEncoder().encode('hello world, not midi'))).toThrow();
  });
});

describe('themeFromMidi', () => {
  const theme = themeFromMidi(hum, 'hum-B-major.mid');

  it('groups the chord track into chords and rounds the loop up to a whole bar', () => {
    expect(theme.chords.map(([b]) => b)).toEqual([0, 4, 8, 12, 16]);
    expect(theme.length).toBe(20);
  });

  it('matches the committed theme.json (run `npm run theme` after a new hum)', () => {
    expect(theme).toEqual(stored);
  });
});

describe('theme helpers', () => {
  it('finds chord roots, inversions included', () => {
    expect(chordRoot([27, 30, 35]) % 12).toBe(11); // D#-F#-B is B major
    expect(chordRoot([25, 28, 30, 34]) % 12).toBe(6); // C#-E-F#-A# is F#7
    expect(chordRoot([28, 32, 35]) % 12).toBe(4); // E major
  });

  it('shifts whole octaves up to a floor', () => {
    expect(octaveShift([47, 56], 60)).toBe(24);
    expect(octaveShift([72], 60)).toBe(0);
  });

  it('takes the first bar as the opening phrase', () => {
    expect(openingPhrase(stored as Theme).map(([, n]) => n)).toEqual([47, 51, 54, 54, 52, 56, 54]);
  });

  it('arranges every note of one loop, in time order', () => {
    const events = arrange(stored as Theme);
    expect(events.length).toBeGreaterThan(stored.melody.length + stored.chords.length);
    expect(events.every((e, i) => i === 0 || e.beat >= events[i - 1].beat)).toBe(true);
    expect(Math.max(...events.map((e) => e.beat))).toBeLessThan(stored.length);
  });
});
