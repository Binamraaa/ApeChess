/** Seconds as m:ss, e.g. 125 → "2:05". */
export const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** A countdown in hours and minutes, e.g. "7h 12m", or "12m" under an hour. */
export function formatCountdown(ms: number): string {
  const mins = Math.max(1, Math.ceil(ms / 60_000));
  const h = Math.floor(mins / 60);
  return h ? `${h}h ${mins % 60}m` : `${mins}m`;
}
