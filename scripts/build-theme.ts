// Turns a hummed MIDI file (e.g. a Surilo hum-to-notes export) into Bapu's theme:
// content/music/theme.json, which the app plays as home music and borrows for level cues.
// Run with: npm run theme [-- path/to/hum.mid]   (default: the newest .mid in content/music/)
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parseMidi } from '../src/sound/midi';
import { themeFromMidi } from '../src/sound/theme';

const DIR = 'content/music';
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const name = (n: number) => `${NAMES[n % 12]}${Math.floor(n / 12) - 1}`;

function newestMidi(): string {
  const mids = readdirSync(DIR)
    .filter((f) => /\.midi?$/i.test(f))
    .map((f) => join(DIR, f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  if (!mids.length) throw new Error(`No .mid files in ${DIR}`);
  return mids[0];
}

const file = process.argv[2] ?? newestMidi();
const theme = themeFromMidi(parseMidi(readFileSync(file)), basename(file));
// One note per line, so a new hum reads well in a diff.
const { melody, chords, ...head } = theme;
const rows = (xs: unknown[]) => xs.map((x) => `    ${JSON.stringify(x)}`).join(',\n');
const top = JSON.stringify(head, null, 2).slice(0, -2);
writeFileSync(join(DIR, 'theme.json'), `${top},\n  "melody": [\n${rows(melody)}\n  ],\n  "chords": [\n${rows(chords)}\n  ]\n}\n`);

console.log(`${theme.source}: ${theme.bpm} BPM, ${theme.beatsPerBar}/4, loops every ${theme.length} beats`);
console.log('Melody:', theme.melody.map(([, n]) => name(n)).join(' '));
console.log('Chords:', theme.chords.map(([, ns]) => ns.map(name).join('-')).join(' | '));
console.log(`Wrote ${DIR}/theme.json`);
