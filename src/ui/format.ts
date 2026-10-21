/** Seconds as m:ss, e.g. 125 → "2:05". */
export const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
