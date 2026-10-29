// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Binamra Bhusal

import { describe, expect, it } from 'vitest';
import { SNAPSHOT_VERSION, addXp, mergeSnapshots, mergeStreak, parseSnapshot, sameSnapshot, type Snapshot } from './merge';

const snap = (over: Partial<Snapshot> = {}): Snapshot => ({
  version: SNAPSHOT_VERSION,
  profile: { xp: 0, xpBy: {}, streak: { count: 0, lastDay: null }, started: false },
  levels: [],
  riddle: { recent: [], solved: 0 },
  review: [],
  ...over,
});

describe('XP per device', () => {
  it('adds to this device and keeps the total', () => {
    const p = addXp(addXp({ xp: 0, streak: { count: 0, lastDay: null }, started: true }, 'a', 30), 'a', 20);
    expect(p).toMatchObject({ xp: 50, xpBy: { a: 50 } });
  });

  it('files XP from before sync under this device', () => {
    expect(addXp({ xp: 100, streak: { count: 0, lastDay: null }, started: true }, 'a', 5).xpBy).toEqual({ a: 105 });
  });

  it('adds two devices together, and never counts the same XP twice', () => {
    const laptop = snap({ profile: { xp: 120, xpBy: { laptop: 120 }, streak: { count: 1, lastDay: '2026-10-20' }, started: true } });
    const phone = snap({ profile: { xp: 80, xpBy: { phone: 80 }, streak: { count: 1, lastDay: '2026-10-21' }, started: true } });
    const once = mergeSnapshots(laptop, phone, 'laptop');
    expect(once.profile.xp).toBe(200);
    // The phone merges the result back: still 200, not 280.
    const back = mergeSnapshots(phone, once, 'phone');
    expect(back.profile.xp).toBe(200);
    expect(mergeSnapshots(once, back, 'laptop').profile.xp).toBe(200);
  });

  it('counts a profile from before sync as this device', () => {
    const old = snap({ profile: { xp: 60, streak: { count: 0, lastDay: null }, started: true } });
    const cloud = snap({ profile: { xp: 40, xpBy: { phone: 40 }, streak: { count: 0, lastDay: null }, started: true } });
    expect(mergeSnapshots(old, cloud, 'laptop').profile.xpBy).toEqual({ laptop: 60, phone: 40 });
  });
});

describe('merging snapshots', () => {
  it('keeps each level’s best stars and most plays', () => {
    const a = snap({ levels: [{ id: 'L02', bestStars: 3, timesCompleted: 1, lastPlayed: '2026-10-20', recent: ['x'] }] });
    const b = snap({
      levels: [
        { id: 'L02', bestStars: 1, timesCompleted: 4, lastPlayed: '2026-10-21', recent: ['y'] },
        { id: 'L03', bestStars: 2, timesCompleted: 1, lastPlayed: '2026-10-21' },
      ],
    });
    expect(mergeSnapshots(a, b, 'a').levels).toEqual([
      { id: 'L02', bestStars: 3, timesCompleted: 4, lastPlayed: '2026-10-21', recent: ['y'] },
      { id: 'L03', bestStars: 2, timesCompleted: 1, lastPlayed: '2026-10-21' },
    ]);
  });

  it('keeps the streak that reached the later day, or the longer one', () => {
    expect(mergeStreak({ count: 9, lastDay: '2026-10-20' }, { count: 2, lastDay: '2026-10-22' })).toEqual({ count: 2, lastDay: '2026-10-22' });
    expect(mergeStreak({ count: 3, lastDay: '2026-10-22' }, { count: 5, lastDay: '2026-10-22', freezes: 1 })).toEqual({
      count: 5,
      lastDay: '2026-10-22',
      freezes: 1,
    });
    expect(mergeStreak({ count: 0, lastDay: null }, { count: 1, lastDay: '2026-10-22' }).count).toBe(1);
  });

  it('keeps the intro seen and the furthest starting level', () => {
    const a = snap({ profile: { xp: 0, streak: { count: 0, lastDay: null }, started: false, introSeen: true, startAt: 'L09' } });
    const b = snap({ profile: { xp: 0, streak: { count: 0, lastDay: null }, started: true, startAt: 'L12' } });
    expect(mergeSnapshots(a, b, 'a').profile).toMatchObject({ started: true, introSeen: true, startAt: 'L12' });
  });

  it('keeps today’s riddle as solved if either device solved it', () => {
    const result = { puzzleId: 'p2', firstTry: true, hintUsed: false, revealed: false, xp: 20 };
    const a = snap({ riddle: { current: { day: '2026-10-22', levelId: 'L02', puzzleId: 'p1' }, recent: ['p1', 'p0'], solved: 3 } });
    const b = snap({ riddle: { current: { day: '2026-10-22', levelId: 'L02', puzzleId: 'p2', result }, recent: ['p2', 'p0'], solved: 4 } });
    expect(mergeSnapshots(a, b, 'a').riddle).toEqual({ current: b.riddle.current, recent: ['p1', 'p0', 'p2'], solved: 4 });
    const yesterday = snap({ riddle: { current: { day: '2026-10-21', levelId: 'L02', puzzleId: 'p9', result }, recent: [], solved: 1 } });
    expect(mergeSnapshots(yesterday, a, 'a').riddle.current).toEqual(a.riddle.current);
  });

  it('keeps rematches from both, with the later miss', () => {
    const a = snap({ review: [{ puzzleId: 'p1', levelId: 'L02', missedOn: '2026-10-20' }] });
    const b = snap({
      review: [
        { puzzleId: 'p2', levelId: 'L03', missedOn: '2026-10-19' },
        { puzzleId: 'p1', levelId: 'L02', missedOn: '2026-10-21' },
      ],
    });
    expect(mergeSnapshots(a, b, 'a').review).toEqual([
      { puzzleId: 'p1', levelId: 'L02', missedOn: '2026-10-21' },
      { puzzleId: 'p2', levelId: 'L03', missedOn: '2026-10-19' },
    ]);
  });

  it('changes nothing when merging a copy of itself', () => {
    const a = snap({
      profile: { xp: 30, xpBy: { a: 30 }, streak: { count: 2, lastDay: '2026-10-22' }, started: true, introSeen: true },
      levels: [{ id: 'L02', bestStars: 2, timesCompleted: 1, lastPlayed: '2026-10-22' }],
      review: [{ puzzleId: 'p1', levelId: 'L02', missedOn: '2026-10-22' }],
    });
    expect(sameSnapshot(mergeSnapshots(a, a, 'a'), a)).toBe(true);
  });
});

describe('reading a snapshot', () => {
  it('accepts a snapshot and fills in missing parts', () => {
    const parsed = parseSnapshot({ version: 1, profile: { xp: 5, xpBy: { a: 5 }, streak: { count: 0, lastDay: null }, started: true } });
    expect(parsed).toEqual(snap({ profile: { xp: 5, xpBy: { a: 5 }, streak: { count: 0, lastDay: null }, started: true } }));
  });

  it('rejects junk and leaves newer versions alone', () => {
    expect(parseSnapshot(null)).toBeNull();
    expect(parseSnapshot({ version: 1, profile: 'x' })).toBeNull();
    expect(parseSnapshot({ version: SNAPSHOT_VERSION + 1 })).toBe('newer');
  });

  it('compares by content, not key order', () => {
    const a = snap();
    const b = { review: [], riddle: { solved: 0, recent: [] }, levels: [], profile: { ...a.profile }, version: a.version };
    expect(sameSnapshot(a, b)).toBe(true);
  });
});
