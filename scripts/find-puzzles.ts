// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Binamra Bhusal

// Finds candidate featured puzzles: scans the Lichess dump for puzzles whose solver plays a given
// kind of move, then keeps those that pass the Stockfish checks. For hand-picking demos and guided
// puzzles; the regular packs come from build-puzzles.ts.
//   npx tsx scripts/find-puzzles.ts castle [maxRating] [count]
//   kinds: castle | enPassant | promotion
import { createReadStream, closeSync, fstatSync, openSync, readSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { createZstdDecompress } from 'node:zlib';
import { Chess, type PieceSymbol, type Square } from 'chess.js';
import { moveFacts } from '../src/bapu/facts';
import type { PuzzleDef } from '../src/levels/types';
import { checkPuzzle } from './puzzle-check';
import { UciEngine } from './uci-engine';

const RAW = join(import.meta.dirname, '..', 'data', 'raw', 'lichess_db_puzzle.csv.zst');
const [kind = 'castle', maxRating = '1300', count = '8'] = process.argv.slice(2);

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

async function main() {
  const found: { p: PuzzleDef; pop: number }[] = [];
  for await (const line of createInterface({ input: Readable.from(frames(RAW)) })) {
    const c = line.split(',');
    if (c.length < 8 || c[0] === 'PuzzleId') continue;
    const rating = Number(c[3]);
    if (rating > Number(maxRating) || Number(c[5]) < 85 || Number(c[6]) < 300 || Number(c[4]) > 90) continue;
    const moves = c[2].split(' ');
    if (moves.length > 4) continue;
    // Cheap pre-checks before the full analysis.
    const m = moves[1];
    if (kind === 'castle' && !/^e1[gc]1|^e8[gc]8/.test(m)) continue;
    if (kind === 'promotion' && m.length !== 5) continue;
    if (kind === 'enPassant' && m[0] === m[2]) continue;
    const chess = new Chess(c[1]);
    chess.move(uciMove(moves[0]));
    const f = moveFacts(chess.fen(), uciMove(moves[1]));
    if (f.special !== kind) continue;
    found.push({ p: { id: c[0], fen: c[1], moves, rating, themes: c[7].split(' ') }, pop: Number(c[5]) * 1e6 + Number(c[6]) });
  }
  found.sort((a, b) => b.pop - a.pop);
  console.log(`${found.length} candidates; checking the most popular with Stockfish…`);

  const engine = new UciEngine();
  await engine.init();
  let shown = 0;
  for (const { p } of found) {
    if (shown >= Number(count)) break;
    const problems = await checkPuzzle(engine, p, { uniqueMate: true });
    if (problems.length) continue;
    shown++;
    const chess = new Chess(p.fen);
    const sans = p.moves.map((m) => chess.move(uciMove(m)).san);
    const start = new Chess(p.fen);
    start.move(uciMove(p.moves[0]));
    console.log(`\n${p.id} r${p.rating} ${p.themes!.join(' ')}\n${p.fen}  ${p.moves.join(' ')}\n  ${sans.join(' ')}`);
    console.log(start.ascii());
  }
  engine.quit();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
