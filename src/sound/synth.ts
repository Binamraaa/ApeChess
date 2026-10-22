import theme from '../../content/music/theme.json';
import type { Cue } from './manifest';
import { FORMANTS, type Syllable } from './murmur';
import { octaveShift, openingPhrase, type Theme } from './theme';

/**
 * Built-in sounds, made with Web Audio so the app needs no audio files: wooden clacks for
 * the board, a soft marimba for good moves. Recorded files listed in sounds.json replace them.
 */

export const midiFreq = (n: number) => 440 * 2 ** ((n - 69) / 12);
// Cues are in B major, the key of Bapu's theme: semitones above B4.
const note = (semis: number) => midiFreq(71 + semis);

let noiseBuf: AudioBuffer | null = null;
function noiseBuffer(c: BaseAudioContext): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === c.sampleRate) return noiseBuf;
  noiseBuf = c.createBuffer(1, c.sampleRate * 0.2, c.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

/** A gain envelope: quick attack, exponential decay to silence. */
function envelope(c: BaseAudioContext, out: AudioNode, t0: number, peak: number, dur: number, attack = 0.004) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  g.connect(out);
  return g;
}

function tone(
  c: BaseAudioContext,
  out: AudioNode,
  { freq, to, t0, dur, gain, type = 'sine' }: { freq: number; to?: number; t0: number; dur: number; gain: number; type?: OscillatorType },
) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  o.connect(envelope(c, out, t0, gain, dur));
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function knock(c: BaseAudioContext, out: AudioNode, { t0, freq, dur, gain }: { t0: number; freq: number; dur: number; gain: number }) {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = 1.8;
  src.connect(f).connect(envelope(c, out, t0, gain, dur, 0.002));
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

/** A wooden mallet note: a sine plus a fast-fading overtone. */
export function marimba(c: BaseAudioContext, out: AudioNode, t0: number, freq: number, gain = 0.3, dur = 0.55) {
  tone(c, out, { freq, t0, dur, gain });
  tone(c, out, { freq: freq * 4, t0, dur: 0.09, gain: gain * 0.22 });
}

/** A soft reed (clarinet-ish): a filtered triangle with a little vibrato. */
export function reed(c: BaseAudioContext, out: AudioNode, t0: number, freq: number, dur: number, gain: number) {
  const o = c.createOscillator();
  o.type = 'triangle';
  o.frequency.value = freq;
  const vib = c.createOscillator();
  vib.frequency.value = 5;
  const depth = c.createGain();
  depth.gain.value = freq * 0.006;
  vib.connect(depth).connect(o.frequency);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1600;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.05);
  g.gain.setValueAtTime(gain, t0 + Math.max(dur - 0.08, 0.06));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.12);
  o.connect(lp).connect(g).connect(out);
  for (const x of [o, vib]) {
    x.start(t0);
    x.stop(t0 + dur + 0.15);
  }
}

/** A warm sustained chord tone: slow in, slow out. */
export function pad(c: BaseAudioContext, out: AudioNode, t0: number, freq: number, dur: number, gain: number) {
  const o = c.createOscillator();
  o.type = 'triangle';
  o.frequency.value = freq;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.25);
  g.gain.setValueAtTime(gain, t0 + Math.max(dur - 0.1, 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.6);
  o.connect(lp).connect(g).connect(out);
  o.start(t0);
  o.stop(t0 + dur + 0.7);
}

/** A plucked upright-bass note. */
export function pluck(c: BaseAudioContext, out: AudioNode, t0: number, freq: number, gain: number) {
  tone(c, out, { freq, t0, dur: 0.7, gain });
  tone(c, out, { freq: freq * 2, t0, dur: 0.15, gain: gain * 0.3, type: 'triangle' });
}

/** A brush on a snare, very soft. */
export function brush(c: BaseAudioContext, out: AudioNode, t0: number, gain: number) {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 5000;
  f.Q.value = 0.7;
  src.connect(f).connect(envelope(c, out, t0, gain, 0.14, 0.02));
  src.start(t0);
  src.stop(t0 + 0.16);
}

/** The opening of Bapu's theme, played quickly on mallets over its first chord: the level-complete tune. */
function themeFanfare(c: BaseAudioContext, out: AudioNode, t: number) {
  const th = theme as Theme;
  const phrase = openingPhrase(th);
  const lead = octaveShift(phrase.map(([, n]) => n), 66);
  const beat = 0.3;
  phrase.forEach(([b, n, len], i) => {
    const last = i === phrase.length - 1;
    marimba(c, out, t + b * beat, midiFreq(n + lead), 0.22, last ? 1.2 : Math.max(len * beat + 0.25, 0.4));
  });
  const [, chord] = th.chords[0];
  const comp = octaveShift(chord, 52);
  chord.forEach((n) => pad(c, out, t, midiFreq(n + comp), phrase.at(-1)![0] * beat + 0.6, 0.05));
}

/** A piece set down on a wooden board. */
function clack(c: BaseAudioContext, out: AudioNode, t0: number, heavy = false) {
  knock(c, out, { t0, freq: heavy ? 900 : 1150, dur: 0.06, gain: heavy ? 0.7 : 0.55 });
  tone(c, out, { freq: heavy ? 170 : 230, to: heavy ? 90 : 140, t0, dur: 0.08, gain: heavy ? 0.45 : 0.32 });
  if (heavy) knock(c, out, { t0: t0 + 0.035, freq: 700, dur: 0.07, gain: 0.45 });
}

/**
 * Plays a cue now. `step` raises success cues by that many scale steps, so a run of
 * first-try solves climbs (and the stars on the summary rise one by one).
 */
export function synthCue(c: BaseAudioContext, out: AudioNode, cue: Cue, step = 0) {
  const t = c.currentTime + 0.005;
  const up = [0, 2, 4, 5, 7, 9, 11, 12][Math.min(step, 7)];
  switch (cue) {
    case 'tap':
      knock(c, out, { t0: t, freq: 2400, dur: 0.03, gain: 0.18 });
      tone(c, out, { freq: 1300, to: 900, t0: t, dur: 0.04, gain: 0.05 });
      return;
    case 'move':
      return clack(c, out, t);
    case 'capture':
      return clack(c, out, t, true);
    case 'check':
      tone(c, out, { freq: note(7), t0: t + 0.06, dur: 0.12, gain: 0.2, type: 'triangle' });
      tone(c, out, { freq: note(11), t0: t + 0.15, dur: 0.2, gain: 0.2, type: 'triangle' });
      return;
    case 'correct':
      marimba(c, out, t, note(up), 0.22);
      marimba(c, out, t + 0.08, note(up + 4), 0.22);
      return;
    case 'solved':
      [0, 4, 7, 12].forEach((s, i) => marimba(c, out, t + i * 0.075, note(up + s), 0.24, i === 3 ? 0.9 : 0.5));
      return;
    case 'wrong':
      // A gentle "hmm, no": two low notes falling, never a buzzer.
      tone(c, out, { freq: 311, to: 294, t0: t, dur: 0.16, gain: 0.2, type: 'triangle' });
      tone(c, out, { freq: 247, to: 220, t0: t + 0.14, dur: 0.28, gain: 0.2, type: 'triangle' });
      return;
    case 'hint':
      // A small bell: the lightbulb going on.
      tone(c, out, { freq: note(12), t0: t, dur: 0.7, gain: 0.16 });
      tone(c, out, { freq: note(12) * 2.76, t0: t, dur: 0.35, gain: 0.05 });
      return;
    case 'star':
      marimba(c, out, t, note(12 + [0, 4, 7][Math.min(step, 2)]), 0.26, 0.8);
      tone(c, out, { freq: note(24 + [0, 4, 7][Math.min(step, 2)]), t0: t + 0.02, dur: 0.5, gain: 0.03 });
      return;
    case 'complete':
      return themeFanfare(c, out, t);
  }
}

/** Sings a planned murmur: a buzzy source shaped by the vowel's formants, one note per syllable. */
export function synthMurmur(c: BaseAudioContext, out: AudioNode, plan: Syllable[], t0: number) {
  for (const s of plan) {
    const t = t0 + s.at;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(s.pitch * 1.05, t);
    o.frequency.exponentialRampToValueAtTime(s.pitch, t + s.dur);

    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.015);
    g.gain.setValueAtTime(1, t + s.dur - 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + s.dur);
    g.connect(out);

    FORMANTS[s.vowel].forEach((f, i) => {
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f;
      bp.Q.value = i === 0 ? 5 : 8;
      const level = c.createGain();
      level.gain.value = i === 0 ? 0.5 : 0.25;
      o.connect(bp).connect(level).connect(g);
    });
    o.start(t);
    o.stop(t + s.dur + 0.02);
  }
}
