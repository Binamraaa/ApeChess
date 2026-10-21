export interface Streak {
  count: number;
  /** Local calendar day of the last level session, as YYYY-MM-DD. */
  lastDay: string | null;
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

/** Records a level session on `today`: same day keeps the streak, next day extends it, a gap resets it. */
export function recordSession(s: Streak, today: string): Streak {
  if (s.lastDay === null) return { count: 1, lastDay: today };
  const gap = dayDiff(s.lastDay, today);
  if (gap <= 0) return { count: Math.max(s.count, 1), lastDay: s.lastDay };
  if (gap === 1) return { count: s.count + 1, lastDay: today };
  return { count: 1, lastDay: today };
}

/** The streak as it should be displayed today (0 if the last session was before yesterday). */
export function currentStreak(s: Streak, today: string): number {
  if (s.lastDay === null) return 0;
  return dayDiff(s.lastDay, today) <= 1 ? s.count : 0;
}
