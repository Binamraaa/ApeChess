// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Binamra Bhusal

import { chordRoot, octaveShift, type Theme } from './theme';
import { marimba, midiFreq, pad, pluck, reed, brush } from './synth';

/**
 * Plays Bapu's theme as looping home music, built from the hummed notes.
 * Each pass changes the arrangement so the short loop doesn't wear thin:
 *   1 mallets alone · 2 reed with brushes · 3 mallets an octave up · 4 chords and bass only
 */

const AHEAD = 0.6; // seconds scheduled in advance
const TICK = 150; // ms between scheduling passes

interface Event {
  beat: number;
  play: (c: BaseAudioContext, out: AudioNode, t: number, spb: number, pass: number) => void;
}

/** One loop of the theme as timed events. */
export function arrange(theme: Theme): Event[] {
  const lead = octaveShift(theme.melody.map(([, n]) => n), 60);
  const comp = octaveShift(theme.chords.flatMap(([, ns]) => ns), 48);
  const events: Event[] = [];

  for (const [beat, note, len] of theme.melody) {
    events.push({
      beat,
      play: (c, out, t, spb, pass) => {
        const f = midiFreq(note + lead);
        if (pass === 0) marimba(c, out, t, f, 0.16, Math.max(len * spb + 0.3, 0.5));
        if (pass === 1) reed(c, out, t, f, len * spb * 0.92, 0.07);
        if (pass === 2) marimba(c, out, t, f * 2, 0.08, 0.5);
      },
    });
  }

  for (const [beat, notes, len] of theme.chords) {
    events.push({
      beat,
      play: (c, out, t, spb) => notes.forEach((n, i) => pad(c, out, t + i * 0.025, midiFreq(n + comp), len * spb, 0.03)),
    });
    // Bass: the root on the bar's first beat, the fifth halfway through.
    const root = chordRoot(notes) % 12;
    const low = 40 + ((root - 4 + 12) % 12); // E2 up to D#3: low, but still heard on a phone
    events.push({ beat, play: (c, out, t) => pluck(c, out, t, midiFreq(low), 0.2) });
    if (len > theme.beatsPerBar / 2)
      events.push({ beat: beat + theme.beatsPerBar / 2, play: (c, out, t) => pluck(c, out, t, midiFreq(low + 7), 0.16) });
  }

  // Brushes on the off-beats (2 and 4), from the second pass on.
  for (let beat = 1; beat < theme.length; beat += 2) {
    events.push({ beat, play: (c, out, t, _spb, pass) => pass > 0 && brush(c, out, t, 0.03) });
  }
  return events.sort((a, b) => a.beat - b.beat);
}

export interface MusicHandle {
  stop: (fade?: number) => void;
}

export function playTheme(c: AudioContext, out: AudioNode, theme: Theme, volume: number): MusicHandle {
  const spb = 60 / theme.bpm;
  const loop = theme.length * spb;
  const events = arrange(theme);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, c.currentTime);
  gain.gain.setTargetAtTime(volume, c.currentTime, 0.5);
  gain.connect(out);

  const start = c.currentTime + 0.1;
  let pass = 0;
  let next = 0; // index of the next event to schedule in this pass

  const schedule = () => {
    const until = c.currentTime + AHEAD;
    for (;;) {
      if (next >= events.length) {
        pass++;
        next = 0;
      }
      const t = start + pass * loop + events[next].beat * spb;
      if (t > until) return;
      // Skip anything already late (e.g. the tab was asleep) rather than play a pile-up.
      if (t >= c.currentTime) events[next].play(c, gain, t, spb, pass % 4);
      next++;
    }
  };
  schedule();
  const timer = window.setInterval(schedule, TICK);

  return {
    stop(fade = 0.8) {
      clearInterval(timer);
      gain.gain.setTargetAtTime(0, c.currentTime, fade / 3);
      window.setTimeout(() => gain.disconnect(), fade * 1000 + 500);
    },
  };
}
