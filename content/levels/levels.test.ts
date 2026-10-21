// Validates every level file and puzzle pack. Engine soundness of hand-made puzzles is checked
// separately by `npm run verify-puzzles` (slow, needs Stockfish); Lichess puzzles are engine-checked upstream.
import { Chess, type Square } from 'chess.js';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isFork, moveFacts } from '../../src/bapu/explain';
import { THEMES } from '../../src/bapu/themes';
import { quizAnswer } from '../../src/bapu/quiz';
import { drillMove, drillMoves, parseDrill, solveDrill } from '../../src/levels/drill';
import { PRACTICE_SIZE, practicePool } from '../../src/levels/practice';
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
  const all: PuzzleDef[] = [...featured, ...level.practice, ...(level.pack ?? [])];
  const kindOf = (p: PuzzleDef) => p.kind ?? 'puzzle';
  const puzzles = all.filter((p) => kindOf(p) === 'puzzle');

  it('has the standard anatomy', () => {
    expect(level.id).toBe(file.replace('.json', ''));
    expect(level.guided.length).toBeLessThanOrEqual(3);
    if (level.mix) {
      for (const m of level.mix) {
        const pool = m.levels.flatMap((id) => (existsSync(join(packDir, `${id}.json`)) ? readPack(`${id}.json`) : []));
        expect(pool.length, `mix from ${m.levels}`).toBeGreaterThanOrEqual(m.count * 2);
      }
    } else {
      expect(practicePool(level).length, 'practice pool').toBeGreaterThanOrEqual(level.practiceSize ?? PRACTICE_SIZE);
    }
    expect(new Set([...featured, ...level.practice].map((p) => p.id)).size).toBe(featured.length + level.practice.length);
    expect(THEMES[level.theme], `unknown theme ${level.theme}`).toBeDefined();
    expect(existsSync(join(__dirname, '..', '..', 'public', 'pieces', `${level.icon}.svg`)), level.icon).toBe(true);
  });

  if (puzzles.length) {
    it.each(puzzles.map((p) => [p.id, p] as const))('%s: every move is legal', (_, p) => {
      const chess = new Chess(p.fen);
      for (const m of p.moves) expect(() => play(chess, m), `${p.id} ${m}`).not.toThrow();
    });
  }

  for (const p of all.filter((x) => kindOf(x) === 'drill')) {
    it(`${p.id}: drill moves are legal and par is the shortest route`, () => {
      let b = parseDrill(p.fen);
      for (const m of p.moves) {
        expect(drillMoves(b), `${p.id} ${m}`).toContain(m.slice(2, 4));
        b = drillMove(b, m.slice(2, 4));
      }
      if (p.par !== undefined) expect(p.par).toBe(solveDrill(parseDrill(p.fen), p.targets ?? []).moves);
    });
  }

  for (const p of all.filter((x) => kindOf(x) === 'quiz')) {
    it(`${p.id}: quiz answer matches the position`, () => {
      expect(p.answer).toBe(quizAnswer(p.fen));
    });
  }

  for (const p of all.filter((x) => kindOf(x) === 'choice')) {
    it(`${p.id}: choices are legal, with exactly one best`, () => {
      expect(p.options?.filter((o) => o.best)).toHaveLength(1);
      for (const o of p.options ?? []) expect(() => play(new Chess(p.fen), o.uci), `${p.id} ${o.uci}`).not.toThrow();
    });
  }

  for (const p of all.filter((x) => kindOf(x) === 'endgame')) {
    it(`${p.id}: endgame starts legal, White to move, with a move limit`, () => {
      const chess = new Chess(p.fen);
      expect(chess.turn()).toBe('w');
      expect(chess.isGameOver()).toBe(false);
      expect(new Chess(p.fen.replace(' w ', ' b ')).inCheck(), 'Black in check with White to move').toBe(false);
      expect(p.limit).toBeGreaterThan(0);
    });
  }

  it.each(puzzles.map((p) => [p.id, p] as const))('%s: wrong-move notes are legal and not the solution', (_, p) => {
    const chess = new Chess(p.fen);
    play(chess, p.moves[0]);
    for (const uci of Object.keys(p.wrong ?? {})) {
      expect(uci).not.toBe(p.moves[1]);
      expect(() => play(new Chess(chess.fen()), uci), `${p.id} ${uci}`).not.toThrow();
    }
  });

  it('demo has one narration line per move (plus an optional intro)', () => {
    const n = level.demo.narration?.length;
    expect([level.demo.moves.length, level.demo.moves.length + 1]).toContain(n);
  });

  it('guided steps have hints, and guided puzzles have explanations', () => {
    for (const p of level.guided) {
      expect(p.hint, p.id).toBeTruthy();
      if (kindOf(p) === 'puzzle') expect(p.explanation, p.id).toBeTruthy();
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
    for (const p of puzzles.filter((x) => (x.kind ?? 'puzzle') === 'puzzle')) {
      const chess = new Chess(p.fen);
      p.moves.forEach((m, i) => {
        expect(() => play(chess, m), `${p.id} ${m}`).not.toThrow();
        if (i % 2 === 1 && m.length === 5) expect(m[4], `${p.id} underpromotes`).toBe('q');
      });
    }
  });
});
