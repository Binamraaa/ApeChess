import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { _resetConnection, getLevelProgress, getProfile, saveLevelResult } from './store';

beforeEach(async () => {
  await _resetConnection();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('apechess');
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
});

describe('progress store', () => {
  it('starts empty', async () => {
    expect(await getProfile()).toEqual({ xp: 0, streak: { count: 0, lastDay: null }, started: false });
    expect(await getLevelProgress('L08')).toBeUndefined();
  });

  it('keeps best stars, adds XP and updates the streak', async () => {
    const day1 = new Date(2026, 9, 21, 10);
    const day2 = new Date(2026, 9, 22, 10);

    const a = await saveLevelResult('L08', 2, 100, day1);
    expect(a.improved).toBe(true);

    const b = await saveLevelResult('L08', 1, 30, day2);
    expect(b.improved).toBe(false);
    expect(b.level).toMatchObject({ bestStars: 2, timesCompleted: 2, lastPlayed: '2026-10-22' });
    expect(b.profile).toEqual({ xp: 130, streak: { count: 2, lastDay: '2026-10-22' }, started: true });

    expect(await getProfile()).toEqual(b.profile);
  });

  it('remembers recently played practice puzzles, newest first', async () => {
    await saveLevelResult('L05', 1, 10, new Date(), ['a', 'b']);
    const { level } = await saveLevelResult('L05', 1, 10, new Date(), ['c', 'a']);
    expect(level.recent).toEqual(['c', 'a', 'b']);
  });
});
