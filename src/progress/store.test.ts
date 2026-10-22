import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { _resetConnection, getLevelProgress, getProfile, getRiddleState, saveLevelResult, saveRiddleResult, todaysRiddle } from './store';

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

  it('keeps one riddle per day, even if the pick would change', async () => {
    const a = await todaysRiddle('2026-10-22', () => ({ levelId: 'L08', puzzleId: 'p1' }));
    const b = await todaysRiddle('2026-10-22', () => ({ levelId: 'L09', puzzleId: 'p2' }));
    expect(b).toEqual(a);
    const c = await todaysRiddle('2026-10-23', (recent) => ({ levelId: 'L09', puzzleId: recent.includes('p1') ? 'p2' : 'p1' }));
    expect(c).toEqual({ day: '2026-10-23', levelId: 'L09', puzzleId: 'p2' });
    expect((await getRiddleState()).recent).toEqual(['p2', 'p1']);
  });

  it('pays a riddle once and counts it for the streak', async () => {
    const day = new Date(2026, 9, 22, 9);
    await todaysRiddle('2026-10-22', () => ({ levelId: 'L08', puzzleId: 'p1' }));
    const outcome = { puzzleId: 'p1', firstTry: true, hintUsed: false, revealed: false };
    const saved = await saveRiddleResult('2026-10-22', outcome, 20, day);
    expect(saved!.profile).toMatchObject({ xp: 20, streak: { count: 1, lastDay: '2026-10-22' } });
    expect(saved!.riddle.result).toMatchObject({ firstTry: true, xp: 20 });
    expect(await saveRiddleResult('2026-10-22', outcome, 20, day)).toBeNull();
    expect((await getProfile()).xp).toBe(20);
    expect((await getRiddleState()).solved).toBe(1);
  });
});
