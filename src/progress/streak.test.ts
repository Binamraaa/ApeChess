// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Binamra Bhusal

import { describe, expect, it } from 'vitest';
import { NO_STREAK, currentStreak, freezesNeeded, localDay, recordSession } from './streak';

describe('streak', () => {
  it('starts at 1 on the first session', () => {
    expect(recordSession(NO_STREAK, '2026-10-21')).toEqual({ count: 1, lastDay: '2026-10-21' });
  });

  it('does not double count the same day', () => {
    const s = { count: 3, lastDay: '2026-10-21' };
    expect(recordSession(s, '2026-10-21')).toEqual(s);
  });

  it('extends on consecutive days, across month ends', () => {
    expect(recordSession({ count: 3, lastDay: '2026-10-31' }, '2026-11-01')).toEqual({ count: 4, lastDay: '2026-11-01' });
  });

  it('resets after a missed day', () => {
    expect(recordSession({ count: 9, lastDay: '2026-10-18' }, '2026-10-21')).toEqual({ count: 1, lastDay: '2026-10-21' });
  });

  it('displays 0 once the streak is broken, but keeps it alive through today', () => {
    const s = { count: 5, lastDay: '2026-10-20' };
    expect(currentStreak(s, '2026-10-21')).toBe(5);
    expect(currentStreak(s, '2026-10-22')).toBe(0);
  });

  it('earns a freeze every 7 days, up to 2', () => {
    expect(recordSession({ count: 6, lastDay: '2026-10-20' }, '2026-10-21')).toEqual({ count: 7, lastDay: '2026-10-21', freezes: 1 });
    expect(recordSession({ count: 13, lastDay: '2026-10-20', freezes: 1 }, '2026-10-21').freezes).toBe(2);
    expect(recordSession({ count: 20, lastDay: '2026-10-20', freezes: 2 }, '2026-10-21').freezes).toBe(2);
  });

  it('spends freezes to cover missed days', () => {
    // Missed the 21st and 22nd: two freezes keep the streak going.
    expect(recordSession({ count: 9, lastDay: '2026-10-20', freezes: 2 }, '2026-10-23')).toEqual({ count: 10, lastDay: '2026-10-23' });
    expect(recordSession({ count: 9, lastDay: '2026-10-20', freezes: 1 }, '2026-10-22')).toEqual({ count: 10, lastDay: '2026-10-22' });
  });

  it('resets when there are not enough freezes, keeping them for later', () => {
    expect(recordSession({ count: 9, lastDay: '2026-10-18', freezes: 1 }, '2026-10-21')).toEqual({ count: 1, lastDay: '2026-10-21', freezes: 1 });
  });

  it('shows a frozen streak as still alive', () => {
    const s = { count: 9, lastDay: '2026-10-20', freezes: 1 };
    expect(currentStreak(s, '2026-10-22')).toBe(9);
    expect(currentStreak(s, '2026-10-23')).toBe(0);
    expect(freezesNeeded(s, '2026-10-22')).toBe(1);
    expect(freezesNeeded(s, '2026-10-21')).toBe(0);
  });

  it('formats local days', () => {
    expect(localDay(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
