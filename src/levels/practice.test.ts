import { describe, expect, it } from 'vitest';
import { levelRun, pickPractice, practicePool, updateRecent } from './practice';
import type { LevelDef, PuzzleDef } from './types';

const pz = (id: string, rating = 1000, source?: string): PuzzleDef => ({ id, fen: '', moves: [], rating, source });
const pool = Array.from({ length: 10 }, (_, i) => pz(`p${i}`, 1000 - i * 10));
const noShuffle = () => 0.999;

describe('pickPractice', () => {
  it('prefers puzzles not played recently and sorts easiest first', () => {
    const picked = pickPractice(pool, ['p0', 'p1', 'p2'], 7, noShuffle);
    expect(picked.map((p) => p.id).sort()).toEqual(['p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9']);
    expect(picked.map((p) => p.rating)).toEqual([...picked.map((p) => p.rating!)].sort((a, b) => a - b));
  });

  it('tops up with the least recently played', () => {
    const recent = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5'];
    const picked = pickPractice(pool, recent, 7, noShuffle).map((p) => p.id);
    expect(picked).toHaveLength(7);
    expect(picked).toEqual(expect.arrayContaining(['p6', 'p7', 'p8', 'p9', 'p5', 'p4', 'p3']));
  });

  it('copes with a pool smaller than the set', () => {
    expect(pickPractice(pool.slice(0, 3), [], 7)).toHaveLength(3);
  });
});

describe('practicePool', () => {
  it('merges hand-made and imported puzzles, without the featured ones or duplicates', () => {
    const level = {
      demo: pz('demo', 900, 'lichess:AAA'),
      guided: [pz('g1', 900, 'lichess:BBB')],
      practice: [pz('h1')],
      pack: [pz('AAA', 900, 'lichess:AAA'), pz('BBB', 900, 'lichess:BBB'), pz('CCC'), pz('h1')],
    } as unknown as LevelDef;
    expect(practicePool(level).map((p) => p.id)).toEqual(['h1', 'CCC']);
    expect(levelRun(level, []).practice).toHaveLength(2);
  });
});

describe('updateRecent', () => {
  it('puts the latest run first without duplicates', () => {
    expect(updateRecent(['a', 'b', 'c'], ['c', 'd'])).toEqual(['c', 'd', 'a', 'b']);
  });
});
