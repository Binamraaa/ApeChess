// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Binamra Bhusal

import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { _resetConnection, getLevelProgress, getProfile, getReview, exportSnapshot, getRiddleState, mergeIntoLocal, onMerged, onSaved, recordReview, saveLevelResult, saveRiddleResult, todaysRiddle } from './store';

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
    expect(b.profile).toMatchObject({ xp: 130, streak: { count: 2, lastDay: '2026-10-22' }, started: true });
    expect(Object.values(b.profile.xpBy!)).toEqual([130]);

    expect(await getProfile()).toEqual(b.profile);
  });

  it('tells listeners after progress is saved', async () => {
    let calls = 0;
    const off = onSaved(() => calls++);
    await saveLevelResult('L08', 1, 10);
    await recordReview('L08', ['p1'], [], '2026-10-22');
    off();
    await saveLevelResult('L08', 1, 10);
    expect(calls).toBe(2);
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

  it('takes a rematch off the list once it is won first try', async () => {
    await recordReview('L08', ['p1', 'p2'], [], '2026-10-20');
    await todaysRiddle('2026-10-22', () => ({ levelId: 'L08', puzzleId: 'p1', rematch: '2026-10-20' }));
    await saveRiddleResult('2026-10-22', { puzzleId: 'p1', firstTry: true, hintUsed: false, revealed: false }, 20, new Date(2026, 9, 22));
    expect((await getReview()).map((i) => i.puzzleId)).toEqual(['p2']);
  });

  it('brings a lost rematch back later', async () => {
    await recordReview('L08', ['p1'], [], '2026-10-20');
    await todaysRiddle('2026-10-22', () => ({ levelId: 'L08', puzzleId: 'p1', rematch: '2026-10-20' }));
    await saveRiddleResult('2026-10-22', { puzzleId: 'p1', firstTry: false, hintUsed: false, revealed: false }, 5, new Date(2026, 9, 22));
    expect(await getReview()).toEqual([{ puzzleId: 'p1', levelId: 'L08', missedOn: '2026-10-22' }]);
  });

  it('reports the previous best and a freshly earned freeze', async () => {
    for (let d = 15; d <= 20; d++) await saveLevelResult('L05', 1, 10, new Date(2026, 9, d));
    const r = await saveLevelResult('L05', 2, 10, new Date(2026, 9, 21));
    expect(r).toMatchObject({ prevBest: 1, freezeEarned: true });
    expect(r.profile.streak).toEqual({ count: 7, lastDay: '2026-10-21', freezes: 1 });
  });

  it("merges another device's snapshot in, keeping the best of both", async () => {
    await saveLevelResult('L02', 3, 100, new Date(2026, 9, 21));
    await saveLevelResult('L03', 1, 20, new Date(2026, 9, 21));
    const local = await exportSnapshot();
    const other = {
      ...local,
      profile: { ...local.profile, xp: 50, xpBy: { phone: 50 }, streak: { count: 4, lastDay: '2026-10-22' } },
      levels: [
        { id: 'L03', bestStars: 3 as const, timesCompleted: 2, lastPlayed: '2026-10-22' },
        { id: 'L04', bestStars: 2 as const, timesCompleted: 1, lastPlayed: '2026-10-22' },
      ],
    };
    let merged = 0;
    const off = onMerged(() => merged++);
    const { snapshot, changed } = await mergeIntoLocal(other);
    expect(changed).toBe(true);
    expect(snapshot.profile.xp).toBe(170);
    expect((await getProfile()).streak).toEqual({ count: 4, lastDay: '2026-10-22' });
    expect((await getLevelProgress('L02'))!.bestStars).toBe(3);
    expect((await getLevelProgress('L03'))!.bestStars).toBe(3);
    expect((await getLevelProgress('L04'))!.bestStars).toBe(2);

    // Merging the same copy again changes nothing, and doesn't count XP twice.
    expect((await mergeIntoLocal(other)).changed).toBe(false);
    expect((await getProfile()).xp).toBe(170);
    off();
    expect(merged).toBe(1);
  });

  it('files XP saved before sync under this device', async () => {
    const { profile } = await saveLevelResult('L02', 1, 40);
    const device = Object.keys(profile.xpBy!)[0];
    const { profile: next } = await saveLevelResult('L02', 1, 10);
    expect(next.xpBy).toEqual({ [device]: 50 });
    expect((await exportSnapshot()).profile.xpBy).toEqual({ [device]: 50 });
  });
});
