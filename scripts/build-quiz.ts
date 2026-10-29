// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Binamra Bhusal

// Builds content/puzzles/L03.json: positions for "check, checkmate, stalemate, or none?".
// Check, mate and "none" come from real games in the Lichess puzzle database (CC0); stalemates
// are rare in puzzles, so they come from simple endings with a seeded random generator.
//   npx tsx scripts/build-quiz.ts
import { closeSync, createReadStream, fstatSync, openSync, readSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { createZstdDecompress } from 'node:zlib';
import { Chess, type PieceSymbol, type Square } from 'chess.js';
import { quizAnswer } from '../src/bapu/quiz';
import type { PuzzleDef, QuizAnswer } from '../src/levels/types';

const RAW = join(import.meta.dirname, '..', 'data', 'raw', 'lichess_db_puzzle.csv.zst');
const OUT = join(import.meta.dirname, '..', 'content', 'puzzles', 'L03.json');
const PER_ANSWER = 10;

async function* frames(path: string): AsyncGenerator<Buffer> {
  const fd = openSync(path, 'r');
  const size = fstatSync(fd).size;
  const head = Buffer.alloc(12);
  for (let pos = 0; pos < size; ) {
    readSync(fd, head, 0, 12, pos);
    let end = size;
    if ((head.readUInt32LE(0) & 0xfffffff0) === 0x184d2a50) {
      const len = head.readUInt32LE(4);
      const frameSize = len === 4 ? head.readUInt32LE(8) : 0;
      pos += 8 + len;
      if (!frameSize) continue;
      end = pos + frameSize;
    }
    yield* createReadStream(path, { start: pos, end: end - 1 }).pipe(createZstdDecompress());
    pos = end;
  }
  closeSync(fd);
}

const uciMove = (u: string) => ({ from: u.slice(0, 2) as Square, to: u.slice(2, 4) as Square, promotion: u[4] as PieceSymbol | undefined });

/** A small seeded random generator, so the stalemate set is the same every run. */
function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function stalemates(n: number): string[] {
  const rand = rng(8);
  const sq = () => String.fromCharCode(97 + Math.floor(rand() * 8)) + (1 + Math.floor(rand() * 8));
  const out = new Set<string>();
  const setups: string[][] = [['Q'], ['R', 'K'], ['P'], ['Q'], ['R', 'B'], ['N', 'B']];
  for (let tries = 0; out.size < n && tries < 2_000_000; tries++) {
    const extra = setups[tries % setups.length];
    const chess = new Chess();
    chess.clear();
    // The lone black king sits on an edge, where stalemates happen.
    const edge = rand() < 0.5 ? `${'abcdefgh'[Math.floor(rand() * 8)]}${rand() < 0.5 ? 8 : 1}` : `${rand() < 0.5 ? 'a' : 'h'}${1 + Math.floor(rand() * 8)}`;
    chess.put({ type: 'k', color: 'b' }, edge as Square);
    if (!chess.put({ type: 'k', color: 'w' }, sq() as Square)) continue;
    let ok = true;
    for (const p of extra) {
      const at = sq();
      if (chess.get(at as Square) || (p === 'P' && /[18]/.test(at[1]))) ok = false;
      else chess.put({ type: p.toLowerCase() as PieceSymbol, color: 'w' }, at as Square);
    }
    if (!ok) continue;
    const fen = chess.fen().replace(' w ', ' b ');
    try {
      const pos = new Chess(fen);
      if (pos.isStalemate()) out.add(pos.fen());
    } catch {
      // Illegal placement (e.g. kings touching); try again.
    }
  }
  return [...out];
}

async function main() {
  const found: Record<QuizAnswer, string[]> = { check: [], mate: [], stalemate: [], none: [] };
  for await (const line of createInterface({ input: Readable.from(frames(RAW)) })) {
    const c = line.split(',');
    if (c.length < 8 || c[0] === 'PuzzleId') continue;
    if (Number(c[3]) > 1300 || Number(c[5]) < 90 || Number(c[6]) < 2000) continue;
    if (Object.values(found).every((l) => l.length >= PER_ANSWER * 3)) break;
    const moves = c[2].split(' ');
    const chess = new Chess(c[1]);
    chess.move(uciMove(moves[0]));
    if (!chess.inCheck() && found.none.length < PER_ANSWER * 3) found.none.push(chess.fen());
    const m = chess.move(uciMove(moves[1]));
    const answer = quizAnswer(chess.fen());
    if (answer === 'mate' && found.mate.length < PER_ANSWER * 3) found.mate.push(chess.fen());
    if (answer === 'check' && m.piece !== 'k' && found.check.length < PER_ANSWER * 3) found.check.push(chess.fen());
  }
  found.stalemate = stalemates(PER_ANSWER);

  const puzzles: PuzzleDef[] = [];
  for (const answer of ['check', 'mate', 'stalemate', 'none'] as QuizAnswer[]) {
    // Spread the picks through what we found, for variety.
    const list = found[answer];
    for (let i = 0; i < PER_ANSWER && i < list.length; i++) {
      const fen = list[Math.floor((i * list.length) / PER_ANSWER)];
      puzzles.push({ id: `L03-${answer}-${i + 1}`, kind: 'quiz', source: answer === 'stalemate' ? 'custom' : 'lichess', fen, moves: [], answer });
    }
  }
  const pack = { level: 'L03', source: 'Lichess puzzle database (CC0), https://database.lichess.org/#puzzles, plus generated stalemates', puzzles };
  writeFileSync(OUT, JSON.stringify(pack, null, 1) + '\n');
  console.log(Object.entries(found).map(([k, v]) => `${k}: ${Math.min(v.length, PER_ANSWER)}`).join(', '));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
