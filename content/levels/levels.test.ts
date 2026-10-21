// Validates every level file and puzzle pack. Engine soundness of hand-made puzzles is checked
// separately by `npm run verify-puzzles` (slow, needs Stockfish); Lichess puzzles are engine-checked upstream.
import { Chess, type Square } from 'chess.js';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isFork, moveFacts } from '../../src/bapu/explain';
import { THEMES } from '../../src/bapu/themes';
import { practicePool } from '../../src/levels/practice';
import type { LevelDef, PuzzleDef } from '../../src/levels/types';

const dir = join(__dirname);
const packDir = join(__dirname, '..', 'puzzles');
const files = readdirSync(dir).filter((f) => /^L\d+\.json$/.test(f));
const packs = readdirSync(packDir).filter((f) => /^L\d+\.json$/.test(f));

function play(chess: Chess, uci: string) {
  return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
}

const readPack = (file: string): PuzzleDef[] => JSON.parse(readFileSync(join(packDir, file), 'utf8')).puzzles;

describe.each(files)('%s', (file) => {
  const level = JSON.parse(readFileSync(join(dir, file), 'utf8')) as LevelDef;
  const packFile = join(packDir, file);
  level.pack = existsSync(packFile) ? readPack(file) : [];
  const featured: PuzzleDef[] = [level.demo, ...level.guided];
  const all: PuzzleDef[] = [...featured, ...level.practice];

  it('has the standard anatomy', () => {
    expect(level.id).toBe(file.replace('.json', ''));
    expect(level.guided).toHaveLength(3);
    expect(practicePool(level).length, 'practice pool (hand-made + pack)').toBeGreaterThanOrEqual(7);
    expect(new Set(all.map((p) => p.id)).size).toBe(all.length);
    expect(THEMES[level.theme], `unknown theme ${level.theme}`).toBeDefined();
    expect(existsSync(join(__dirname, '..', '..', 'public', 'pieces', `${level.icon}.svg`)), level.icon).toBe(true);
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

describe.each(packs)('pack %s', (file) => {
  const puzzles = readPack(file);

  it('has a level and enough unique puzzles', () => {
    expect(files).toContain(file);
    expect(puzzles.length).toBeGreaterThanOrEqual(7);
    expect(new Set(puzzles.map((p) => p.id)).size).toBe(puzzles.length);
  });

  it('every puzzle is legal and only needs queen promotions', () => {
    for (const p of puzzles) {
      const chess = new Chess(p.fen);
      p.moves.forEach((m, i) => {
        expect(() => play(chess, m), `${p.id} ${m}`).not.toThrow();
        if (i % 2 === 1 && m.length === 5) expect(m[4], `${p.id} underpromotes`).toBe('q');
      });
    }
  });
});
