import { LEVELS, ORDER } from '../../levels/curriculum';
import { pickRiddle, riddleNumber, riddlePool } from '../../levels/riddle';
import type { LevelDef, PuzzleDef } from '../../levels/types';
import { getAllLevelProgress, todaysRiddle, type RiddleRecord } from '../../progress/store';
import { localDay } from '../../progress/streak';

export interface TodaysRiddle {
  record: RiddleRecord;
  number: number;
  /** The level it comes from (its theme picks Bapu's prompt and hints). */
  level: LevelDef;
  puzzle: PuzzleDef;
}

/** Today's riddle for this learner: picked once a day from the levels they've passed. */
export async function loadTodaysRiddle(now = new Date()): Promise<TodaysRiddle | null> {
  const day = localDay(now);
  const passed = new Set((await getAllLevelProgress()).filter((p) => p.bestStars > 0).map((p) => p.id));
  const levels = ORDER.map((l) => LEVELS[l.id]).filter(Boolean);
  const pool = riddlePool(levels, (id) => passed.has(id));

  const record = await todaysRiddle(day, (recent) => {
    const pick = pickRiddle(pool, day, recent);
    return pick && { levelId: pick.levelId, puzzleId: pick.puzzle.id };
  });
  const level = record && LEVELS[record.levelId];
  const puzzle = level?.pack?.find((p) => p.id === record!.puzzleId);
  if (!record || !level || !puzzle) return null;
  return { record, number: riddleNumber(day), level, puzzle: { ...puzzle, theme: puzzle.theme ?? level.theme } };
}
