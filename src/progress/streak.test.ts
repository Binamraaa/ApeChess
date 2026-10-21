import { describe, expect, it } from 'vitest';
import { NO_STREAK, currentStreak, localDay, recordSession } from './streak';

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

  it('formats local days', () => {
    expect(localDay(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
