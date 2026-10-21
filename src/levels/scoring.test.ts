import { describe, expect, it } from 'vitest';
import { levelStars, puzzleXp, scoreLevel, type PuzzleOutcome } from './scoring';

function outcomes(firstTry: number, total = 10, opts: { hints?: number; revealed?: number } = {}): PuzzleOutcome[] {
  return Array.from({ length: total }, (_, i) => ({
    puzzleId: `p${i}`,
    firstTry: i < firstTry,
    hintUsed: i < (opts.hints ?? 0),
    revealed: i >= total - (opts.revealed ?? 0),
  }));
}

describe('puzzleXp', () => {
  const base = { puzzleId: 'x', firstTry: true, hintUsed: false, revealed: false };
  it('gives 10 for first try, 5 with a hint, 0 otherwise', () => {
    expect(puzzleXp(base)).toBe(10);
    expect(puzzleXp({ ...base, hintUsed: true })).toBe(5);
    expect(puzzleXp({ ...base, firstTry: false })).toBe(0);
    expect(puzzleXp({ ...base, revealed: true })).toBe(0);
  });
});

describe('levelStars', () => {
  it('gives ★ for completing with any accuracy', () => {
    expect(levelStars(outcomes(0))).toBe(1);
    expect(levelStars(outcomes(6))).toBe(1);
  });

  it('gives ★★ at 7/10 first try', () => {
    expect(levelStars(outcomes(7))).toBe(2);
    expect(levelStars(outcomes(8))).toBe(2);
  });

  it('gives ★★★ at 9/10 first try with no hints', () => {
    expect(levelStars(outcomes(9))).toBe(3);
    expect(levelStars(outcomes(10))).toBe(3);
  });

  it('caps at ★★ if any hint was used, even with a perfect score', () => {
    expect(levelStars(outcomes(10, 10, { hints: 1 }))).toBe(2);
  });

  it('does not count revealed puzzles as first-try', () => {
    // 9 marked first try, but one of them was revealed: 8/10.
    const o = outcomes(10, 10, { revealed: 2 });
    expect(levelStars(o)).toBe(2);
  });

  it('handles an empty set', () => {
    expect(levelStars([])).toBe(1);
  });
});

describe('scoreLevel', () => {
  it('adds puzzle XP and the star bonus', () => {
    const s = scoreLevel(outcomes(10));
    expect(s).toMatchObject({ stars: 3, firstTry: 10, total: 10, puzzleXp: 100, bonusXp: 60, totalXp: 160 });
  });

  it('scores a middling run', () => {
    const s = scoreLevel(outcomes(7, 10, { hints: 2 }));
    // 5 first try clean (50) + 2 first try with hints (10) = 60, ★★ bonus 40.
    expect(s).toMatchObject({ stars: 2, firstTry: 7, puzzleXp: 60, bonusXp: 40, totalXp: 100 });
  });
});
