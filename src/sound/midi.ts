// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Binamra Bhusal

/**
 * A small Standard MIDI File reader, enough for Surilo's hum-to-notes exports:
 * named tracks of note on/off events, one tempo and one time signature.
 */

export interface MidiNote {
  /** Start, in beats (quarter notes). */
  beat: number;
  /** MIDI note number (60 = middle C). */
  note: number;
  /** Length in beats. */
  len: number;
  velocity: number;
}

export interface MidiTrack {
  name: string;
  notes: MidiNote[];
}

export interface MidiSong {
  bpm: number;
  beatsPerBar: number;
  tracks: MidiTrack[];
}

export function parseMidi(data: Uint8Array): MidiSong {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const text = (from: number, n: number) => String.fromCharCode(...data.subarray(from, from + n));
  if (text(0, 4) !== 'MThd') throw new Error('Not a MIDI file');
  const division = view.getUint16(12);
  if (division & 0x8000) throw new Error('SMPTE timing is not supported');

  let bpm = 120;
  let beatsPerBar = 4;
  const tracks: MidiTrack[] = [];
  let i = 8 + view.getUint32(4);

  while (i + 8 <= data.length) {
    const length = view.getUint32(i + 4);
    if (text(i, 4) !== 'MTrk') {
      i += 8 + length;
      continue;
    }
    let p = i + 8;
    const end = p + length;
    i = end;

    const vlq = () => {
      let v = 0;
      let b: number;
      do {
        b = data[p++];
        v = (v << 7) | (b & 0x7f);
      } while (b & 0x80);
      return v;
    };

    let tick = 0;
    let status = 0;
    let name = '';
    const open = new Map<number, { tick: number; velocity: number }>();
    const notes: MidiNote[] = [];

    while (p < end) {
      tick += vlq();
      if (data[p] === 0xff) {
        const type = data[p + 1];
        p += 2;
        const n = vlq();
        if (type === 0x03) name = text(p, n);
        if (type === 0x51) bpm = Math.round((60_000_000 / ((data[p] << 16) | (data[p + 1] << 8) | data[p + 2])) * 10) / 10;
        if (type === 0x58) beatsPerBar = data[p];
        p += n;
        continue;
      }
      if (data[p] === 0xf0 || data[p] === 0xf7) {
        p++;
        p += vlq();
        continue;
      }
      if (data[p] & 0x80) status = data[p++];
      const kind = status & 0xf0;
      if (kind === 0xc0 || kind === 0xd0) {
        p += 1;
        continue;
      }
      const [a, b] = [data[p], data[p + 1]];
      p += 2;
      // Note on with velocity 0 is a note off.
      if (kind === 0x90 && b > 0) open.set(a, { tick, velocity: b });
      else if (kind === 0x80 || kind === 0x90) {
        const on = open.get(a);
        if (!on) continue;
        open.delete(a);
        notes.push({ beat: on.tick / division, note: a, len: (tick - on.tick) / division, velocity: on.velocity });
      }
    }
    if (notes.length) tracks.push({ name, notes: notes.sort((x, y) => x.beat - y.beat || x.note - y.note) });
  }
  return { bpm, beatsPerBar, tracks };
}
