import { describe, expect, it } from 'vitest';
import { currentLevel, nextLevel, unlockedLevels } from './unlock';

const order = [{ id: 'L01' }, { id: 'L02' }, { id: 'L03', checkpoint: true }, { id: 'L04' }, { id: 'L05' }];
const playable = (id: string) => id !== 'L04';
const stars = (s: Record<string, number>) => (id: string) => s[id] ?? 0;

describe('unlockedLevels', () => {
  it('opens only the first level for a new learner', () => {
    expect([...unlockedLevels(order, playable, stars({}))]).toEqual(['L01']);
  });

  it('opens the next level at one star, and skips levels that are not built yet', () => {
    expect([...unlockedLevels(order, playable, stars({ L01: 1, L02: 1 }))]).toEqual(['L01', 'L02', 'L03']);
  });

  it('needs two stars to pass a checkpoint', () => {
    expect(unlockedLevels(order, playable, stars({ L01: 1, L02: 1, L03: 1 })).has('L05')).toBe(false);
    expect(unlockedLevels(order, playable, stars({ L01: 1, L02: 1, L03: 2 })).has('L05')).toBe(true);
  });

  it('keeps a level open once it has been played', () => {
    expect(unlockedLevels(order, playable, stars({ L05: 2 })).has('L05')).toBe(true);
  });

  it('can open everything (for testing)', () => {
    expect(unlockedLevels(order, playable, stars({}), true).size).toBe(4);
  });
});

describe('currentLevel / nextLevel', () => {
  it('suggests the first open level not yet passed', () => {
    const s = stars({ L01: 3 });
    expect(currentLevel(order, unlockedLevels(order, playable, s), s)).toBe('L02');
  });

  it('suggests the last open level when everything is passed', () => {
    const s = stars({ L01: 3, L02: 2, L03: 2, L05: 1 });
    expect(currentLevel(order, unlockedLevels(order, playable, s), s)).toBe('L05');
  });

  it('finds the next playable level', () => {
    expect(nextLevel(order, 'L03', playable)).toBe('L05');
    expect(nextLevel(order, 'L05', playable)).toBeUndefined();
  });
});
