/**
 * Bapu's "voice": one short sung syllable per word, shaped like the word's vowel, so a line
 * sounds spoken without real speech. Works offline, for any line Bapu's templates produce,
 * and in any language. This file only plans the syllables; the engine sings them.
 */

export type Vowel = 'a' | 'e' | 'i' | 'o' | 'u';
export type Mood = 'neutral' | 'good' | 'bad' | 'hint';

export interface Syllable {
  /** Start time in seconds from the beginning of the line. */
  at: number;
  /** Length in seconds. */
  dur: number;
  /** Fundamental frequency in Hz. */
  pitch: number;
  vowel: Vowel;
}

/** First two formants of each vowel (Hz), for a low adult voice. */
export const FORMANTS: Record<Vowel, [number, number]> = {
  a: [730, 1090],
  e: [530, 1840],
  i: [390, 1990],
  o: [570, 840],
  u: [440, 1020],
};

/** Bapu is an older gentleman: a low voice. */
export const BASE_PITCH = 140;
export const MAX_SYLLABLES = 9;

const MOOD_SHIFT: Record<Mood, number> = { neutral: 0, good: 4, bad: -2, hint: 1 };
const GAP = 0.03;
const PAUSE = 0.1;

const semitones = (n: number) => BASE_PITCH * 2 ** (n / 12);

/** A small, stable number per word, so the same line always sounds the same. */
function wobble(word: string): number {
  let h = 0;
  for (const c of word) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (h % 5) - 2;
}

function vowelOf(word: string): Vowel {
  const m = word.toLowerCase().match(/[aeiou]/);
  // Words without a vowel (e.g. "Nf3", "Bxf7") get a closed hum.
  return (m?.[0] as Vowel | undefined) ?? 'u';
}

export function murmurPlan(text: string, mood: Mood = 'neutral'): Syllable[] {
  const words = text.split(/\s+/).filter((w) => /[\p{L}\d]/u.test(w));
  const said = words.slice(0, MAX_SYLLABLES);
  const question = /\?\s*$/.test(text);
  const exclaim = /!/.test(said[0] ?? '') || /^[^.?]*!/.test(text);

  const out: Syllable[] = [];
  let t = 0;
  said.forEach((word, i) => {
    const last = i === said.length - 1;
    let shift = MOOD_SHIFT[mood] + wobble(word);
    if (i === 0 && exclaim) shift += 3;
    if (last) shift += question ? 4 : -3;
    const letters = word.replace(/[^\p{L}\d]/gu, '').length;
    const dur = Math.min(0.11, 0.06 + letters * 0.006) * (last ? 1.6 : 1);
    out.push({ at: t, dur, pitch: semitones(shift), vowel: vowelOf(word) });
    t += dur + (/[.,;:!?…]$/.test(word) ? PAUSE : GAP);
  });
  return out;
}

/** How long a planned line lasts, in seconds. */
export function planLength(plan: Syllable[]): number {
  const end = plan.at(-1);
  return end ? end.at + end.dur : 0;
}
