export interface Streak {
  count: number;
  /** Local calendar day of the last level session, as YYYY-MM-DD. */
  lastDay: string | null;
  /** Streak freezes in hand: each one covers a missed day. */
  freezes?: number;
}

/** A freeze is earned every 7 days of streak, up to 2 in hand. */
export const FREEZE_EVERY = 7;
export const MAX_FREEZES = 2;

/** Leaves `freezes` out when there are none, so plain streaks stay plain. */
function streak(count: number, lastDay: string | null, freezes = 0): Streak {
  return freezes > 0 ? { count, lastDay, freezes } : { count, lastDay };
}

export const NO_STREAK: Streak = { count: 0, lastDay: null };

export function localDay(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function dayDiff(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/**
 * Records a session on `today`: same day keeps the streak, next day extends it. Missed days are
 * covered by freezes if there are enough; otherwise the streak starts again (freezes are kept).
 */
export function recordSession(s: Streak, today: string): Streak {
  const freezes = s.freezes ?? 0;
  if (s.lastDay === null) return streak(1, today, freezes);
  const gap = dayDiff(s.lastDay, today);
  if (gap <= 0) return streak(Math.max(s.count, 1), s.lastDay, freezes);
  const missed = gap - 1;
  if (missed > freezes) return streak(1, today, freezes);
  const count = s.count + 1;
  const earned = count % FREEZE_EVERY === 0 ? 1 : 0;
  return streak(count, today, Math.min(freezes - missed + earned, MAX_FREEZES));
}

/** The streak as it should be displayed today: 0 once more days were missed than freezes can cover. */
export function currentStreak(s: Streak, today: string): number {
  if (s.lastDay === null) return 0;
  return dayDiff(s.lastDay, today) - 1 <= (s.freezes ?? 0) ? s.count : 0;
}

/** Freezes that would be used up by playing today. */
export function freezesNeeded(s: Streak, today: string): number {
  return s.lastDay === null ? 0 : Math.max(dayDiff(s.lastDay, today) - 1, 0);
}
