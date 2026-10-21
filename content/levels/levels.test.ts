// Validates every hand-authored level file. Engine soundness is checked separately
// by `npm run verify-puzzles` (slow, needs Stockfish).
import { Chess, type Square } from 'chess.js';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isFork, moveFacts } from '../../src/bapu/explain';
import type { LevelDef, PuzzleDef } from '../../src/levels/types';

const dir = join(__dirname);
const files = readdirSync(dir).filter((f) => /^L\d+\.json$/.test(f));

function play(chess: Chess, uci: string) {
  return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
}

describe.each(files)('%s', (file) => {
  const level = JSON.parse(readFileSync(join(dir, file), 'utf8')) as LevelDef;
  const all: PuzzleDef[] = [level.demo, ...level.guided, ...level.practice];

  it('has the standard anatomy', () => {
    expect(level.guided).toHaveLength(3);
    expect(level.practice).toHaveLength(7);
    expect(level.id).toBe(file.replace('.json', ''));
    expect(new Set(all.map((p) => p.id)).size).toBe(all.length);
  });

  it.each(all.map((p) => [p.id, p] as const))('%s: every move is legal', (_, p) => {
    const chess = new Chess(p.fen);
    for (const m of p.moves) expect(() => play(chess, m), `${p.id} ${m}`).not.toThrow();
  });

  it.each(all.map((p) => [p.id, p] as const))('%s: wrong-move notes are legal and not the solution', (_, p) => {
    const chess = new Chess(p.fen);
    play(chess, p.moves[0]);
    for (const uci of Object.keys(p.wrong ?? {})) {
      expect(uci).not.toBe(p.moves[1]);
      expect(() => play(new Chess(chess.fen()), uci), `${p.id} ${uci}`).not.toThrow();
    }
  });

  it('demo has one narration line per move', () => {
    expect(level.demo.narration).toHaveLength(level.demo.moves.length);
  });

  it('featured puzzles have hints and explanations', () => {
    for (const p of level.guided) {
      expect(p.hint, p.id).toBeTruthy();
      expect(p.explanation, p.id).toBeTruthy();
    }
  });

  if (level.id === 'L08') {
    it.each(all.map((p) => [p.id, p] as const))('%s: first solver move is a safe knight fork', (_, p) => {
      const chess = new Chess(p.fen);
      play(chess, p.moves[0]);
      const [from, to] = [p.moves[1].slice(0, 2), p.moves[1].slice(2, 4)] as [Square, Square];
      const f = moveFacts(chess.fen(), { from, to });
      expect(f.piece).toBe('n');
      expect(isFork(f), `${p.id} targets: ${f.targets.map((t) => t.type + t.square)}`).toBe(true);
      expect(f.hanging, `${p.id}: the forking knight can be captured`).toBe(false);
    });
  }
});
