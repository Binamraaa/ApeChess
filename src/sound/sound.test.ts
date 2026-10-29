// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Binamra Bhusal

import { describe, expect, it } from 'vitest';
import { parseManifest } from './manifest';
import { BASE_PITCH, MAX_SYLLABLES, murmurPlan, planLength } from './murmur';
import { DEFAULT_PREFS, parsePrefs } from './prefs';

describe('murmurPlan', () => {
  it('sings one syllable per word, shaped by its vowel', () => {
    const plan = murmurPlan('Knight takes pawn');
    expect(plan.map((s) => s.vowel)).toEqual(['i', 'a', 'a']);
  });

  it('hums words without a vowel, like move names', () => {
    expect(murmurPlan('Nf3')[0].vowel).toBe('u');
  });

  it('caps long lines so Bapu never drones on', () => {
    const plan = murmurPlan('word '.repeat(40));
    expect(plan).toHaveLength(MAX_SYLLABLES);
    expect(planLength(plan)).toBeLessThan(1.5);
  });

  it('is the same every time for the same line', () => {
    expect(murmurPlan('Look for a fork!')).toEqual(murmurPlan('Look for a fork!'));
  });

  it('rises at the end of a question and falls at the end of a statement', () => {
    const ask = murmurPlan('Can you see it?').at(-1)!;
    const tell = murmurPlan('Can you see it.').at(-1)!;
    expect(ask.pitch).toBeGreaterThan(tell.pitch);
  });

  it('sounds brighter when pleased than when correcting', () => {
    const avg = (mood: 'good' | 'bad') => {
      const p = murmurPlan('That move wins the queen', mood);
      return p.reduce((n, s) => n + s.pitch, 0) / p.length;
    };
    expect(avg('good')).toBeGreaterThan(avg('bad'));
  });

  it('pauses after punctuation', () => {
    const [a, b] = murmurPlan('Good. Now');
    const [c, d] = murmurPlan('Good now');
    expect(b.at - a.at).toBeGreaterThan(d.at - c.at);
  });

  it('stays in a low voice', () => {
    for (const s of murmurPlan('Brilliant! That is the move, my friend.', 'good')) {
      expect(s.pitch).toBeGreaterThan(BASE_PITCH * 0.6);
      expect(s.pitch).toBeLessThan(BASE_PITCH * 2.2);
    }
  });

  it('says nothing for an empty line', () => {
    expect(murmurPlan('  ')).toEqual([]);
    expect(planLength([])).toBe(0);
  });
});

describe('parsePrefs', () => {
  it('falls back to defaults for missing or broken settings', () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('not json')).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('{"sfx":"yes","voice":"shout"}')).toEqual(DEFAULT_PREFS);
  });

  it('keeps valid settings', () => {
    expect(parsePrefs('{"sfx":false,"music":false,"voice":"read"}')).toEqual({ sfx: false, music: false, voice: 'read' });
  });
});

describe('parseManifest', () => {
  it('keeps known cues and tracks with plain audio file names', () => {
    const m = parseManifest({
      cues: { move: 'move.mp3', boom: 'boom.mp3', star: '../secret.mp3', tap: 'tap.exe' },
      music: { home: 'theme-v2.m4a', disco: 'x.mp3' },
    });
    expect(m).toEqual({ cues: { move: 'move.mp3' }, music: { home: 'theme-v2.m4a' } });
  });

  it('treats a missing or odd manifest as empty', () => {
    expect(parseManifest(null)).toEqual({ cues: {}, music: {} });
    expect(parseManifest({ cues: 3 })).toEqual({ cues: {}, music: {} });
  });
});
