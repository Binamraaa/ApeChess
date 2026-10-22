import { describe, expect, it } from 'vitest';
import { RIDDLE_XP, pickRiddle, riddleNumber, riddlePool, riddleXp, untilNextRiddle } from './riddle';
import type { LevelDef, PuzzleDef } from './types';

const puzzle = (id: string, kind?: PuzzleDef['kind']): PuzzleDef => ({ id, fen: '8/8/8/8/8/8/8/8 w - - 0 1', moves: [], kind });
const level = (id: string, theme: string, pack: PuzzleDef[]) => ({ id, theme, pack }) as unknown as LevelDef;

const levels = [
  level('L02', 'hanging', [puzzle('a'), puzzle('b')]),
  level('L03', 'quiz', [puzzle('q', 'quiz')]),
  level('L08', 'knightFork', [puzzle('f1'), puzzle('f2'), puzzle('f3')]),
];

describe('riddleNumber', () => {
  it('counts days from the first riddle', () => {
    expect(riddleNumber('2026-10-22')).toBe(1);
    expect(riddleNumber('2026-11-01')).toBe(11);
    expect(riddleNumber('2027-10-22')).toBe(366);
  });
});

describe('riddlePool', () => {
  it('draws puzzles from passed levels only, tagged with their theme', () => {
    const pool = riddlePool(levels, (id) => id === 'L08');
    expect(pool.map((p) => p.puzzle.id)).toEqual(['f1', 'f2', 'f3']);
    expect(pool[0]).toMatchObject({ levelId: 'L08', puzzle: { theme: 'knightFork' } });
  });

  it('skips activities that are not puzzles', () => {
    expect(riddlePool(levels, (id) => id === 'L03').map((p) => p.puzzle.id)).toEqual(['a', 'b']);
  });

  it('starts newcomers on Level 2', () => {
    expect(riddlePool(levels, () => false).map((p) => p.levelId)).toEqual(['L02', 'L02']);
  });
});

describe('pickRiddle', () => {
  const pool = riddlePool(levels, () => true);

  it('picks the same riddle all day', () => {
    expect(pickRiddle(pool, '2026-10-23', [])).toEqual(pickRiddle(pool, '2026-10-23', []));
  });

  it('varies from day to day', () => {
    const ids = new Set(Array.from({ length: 20 }, (_, i) => pickRiddle(pool, `2026-11-${String(i + 1).padStart(2, '0')}`, [])!.puzzle.id));
    expect(ids.size).toBeGreaterThan(2);
  });

  it('avoids recent riddles while fresh ones remain', () => {
    const pick = pickRiddle(pool, '2026-10-23', ['a', 'b', 'f1', 'f2']);
    expect(pick!.puzzle.id).toBe('f3');
    expect(pickRiddle(pool, '2026-10-23', ['a', 'b', 'f1', 'f2', 'f3'])).not.toBeNull();
  });

  it('has nothing to pick from an empty pool', () => {
    expect(pickRiddle([], '2026-10-23', [])).toBeNull();
  });
});

describe('riddleXp', () => {
  const o = { puzzleId: 'x', firstTry: true, hintUsed: false, revealed: false };
  it('rewards a clean solve most, and a shown solution not at all', () => {
    expect(riddleXp(o)).toBe(RIDDLE_XP.clean);
    expect(riddleXp({ ...o, hintUsed: true })).toBe(RIDDLE_XP.hinted);
    expect(riddleXp({ ...o, firstTry: false })).toBe(RIDDLE_XP.solved);
    expect(riddleXp({ ...o, firstTry: false, revealed: true })).toBe(0);
  });
});

describe('untilNextRiddle', () => {
  it('counts down to local midnight', () => {
    expect(untilNextRiddle(new Date(2026, 9, 22, 22, 30))).toBe(90 * 60_000);
  });
});
