// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Binamra Bhusal

// Usage: npx tsx scripts/show-puzzles.ts L05 [theme] [ids...]   Prints each pack puzzle, its line and Bapu's template output.
import { Chess } from 'chess.js';
import { readFileSync } from 'node:fs';
import { explainCorrect, explainSolved, lineInsights, moveFacts } from '../src/bapu/explain';
const [id, theme = 'knightFork', ...ids] = process.argv.slice(2);
const pack = JSON.parse(readFileSync(`${import.meta.dirname}/../content/puzzles/${id}.json`, 'utf8')).puzzles;
for (const p of pack) {
  if (ids.length && !ids.includes(p.id)) continue;
  const c = new Chess(p.fen);
  const sans: string[] = []; const played: any[] = []; let start = '';
  p.moves.forEach((u: string, i: number) => {
    const before = c.fen();
    const m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    sans.push(m.san);
    if (i === 0) start = c.fen();
    if (i % 2 === 1) { const f = moveFacts(before, m); played.push(f);
      if (i < p.moves.length - 1) sans.push(`[${explainCorrect(f, theme as any)}]`); }
  });
  const solver = new Chess(p.fen).turn() === 'w' ? 'b' : 'w';
  console.log(`\n${p.id} r${p.rating} ${solver === 'w' ? 'White' : 'Black'} solves  ${p.themes.join(' ')}`);
  if (ids.length) console.log(new Chess(start).ascii());
  console.log('  ' + sans.join(' '));
  console.log('  => ' + explainSolved(played, theme as any, lineInsights(p.fen, p.moves)));
}
