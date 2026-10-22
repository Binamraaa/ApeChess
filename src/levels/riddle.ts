import type { PuzzleOutcome } from './scoring';
import type { LevelDef, PuzzleDef } from './types';

/**
 * Bapu's daily riddle: one puzzle a day, drawn from the levels the learner has already passed,
 * so it doubles as review. It earns XP and keeps the streak alive.
 */

/** Riddle #1 was set on this day. */
export const RIDDLE_EPOCH = '2026-10-22';
/** Used until the learner has passed a level with puzzles. */
export const FIRST_RIDDLE_LEVEL = 'L02';
/** How many past riddles to avoid repeating. */
export const RIDDLE_MEMORY = 90;

export const RIDDLE_XP = { clean: 20, hinted: 10, solved: 5 };

export interface RiddlePick {
  day: string;
  number: number;
  levelId: string;
  puzzle: PuzzleDef;
}

const dayNumber = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
};

export const riddleNumber = (day: string) => dayNumber(day) - dayNumber(RIDDLE_EPOCH) + 1;

/** Puzzles a riddle can come from: the packs of passed puzzle levels, each tagged with its level's theme. */
export function riddlePool(levels: LevelDef[], passed: (id: string) => boolean): { levelId: string; puzzle: PuzzleDef }[] {
  const fromLevel = (l: LevelDef) =>
    (l.pack ?? [])
      .filter((p) => (p.kind ?? 'puzzle') === 'puzzle')
      .map((p) => ({ levelId: l.id, puzzle: { ...p, theme: p.theme ?? l.theme } }));
  const pool = levels.filter((l) => passed(l.id)).flatMap(fromLevel);
  if (pool.length) return pool;
  const first = levels.find((l) => l.id === FIRST_RIDDLE_LEVEL);
  return first ? fromLevel(first) : [];
}

/** A small seeded generator (mulberry32), so a day's pick is stable. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Picks the day's riddle, skipping recent ones while there are fresh puzzles left. */
export function pickRiddle(
  pool: { levelId: string; puzzle: PuzzleDef }[],
  day: string,
  recent: string[],
): RiddlePick | null {
  if (!pool.length) return null;
  const seen = new Set(recent);
  const fresh = pool.filter((p) => !seen.has(p.puzzle.id));
  const from = fresh.length ? fresh : pool;
  const { levelId, puzzle } = from[Math.floor(seeded(dayNumber(day))() * from.length)];
  return { day, number: riddleNumber(day), levelId, puzzle };
}

export function riddleXp(o: PuzzleOutcome): number {
  if (o.revealed) return 0;
  if (!o.firstTry) return RIDDLE_XP.solved;
  return o.hintUsed ? RIDDLE_XP.hinted : RIDDLE_XP.clean;
}

/** Milliseconds from `now` until the next riddle (local midnight). */
export function untilNextRiddle(now: Date): number {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return midnight.getTime() - now.getTime();
}
