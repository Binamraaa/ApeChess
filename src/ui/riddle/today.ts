import { LEVELS, ORDER } from '../../levels/curriculum';
import { dueReview } from '../../levels/review';
import { pickRiddle, riddleNumber, riddlePool } from '../../levels/riddle';
import type { LevelDef, PuzzleDef } from '../../levels/types';
import { getAllLevelProgress, getReview, todaysRiddle, type RiddleRecord } from '../../progress/store';
import { localDay } from '../../progress/streak';

export interface TodaysRiddle {
  record: RiddleRecord;
  number: number;
  /** The level it comes from (its theme picks Bapu's prompt and hints). */
  level: LevelDef;
  puzzle: PuzzleDef;
}

/** A puzzle anywhere in a level: featured, hand-made practice, its pack, or a mixed level's pools. */
function findPuzzle(level: LevelDef, id: string): PuzzleDef | undefined {
  const all = [...level.guided, ...level.practice, ...(level.pack ?? []), ...(level.pools ?? []).flatMap((p) => p.puzzles)];
  return all.find((p) => p.id === id && (p.kind ?? 'puzzle') === 'puzzle');
}

/**
 * Today's riddle for this learner, picked once a day: a rematch of a puzzle they missed if one is
 * due, otherwise a fresh one from the levels they've passed.
 */
export async function loadTodaysRiddle(now = new Date()): Promise<TodaysRiddle | null> {
  const day = localDay(now);
  const [progress, review] = await Promise.all([getAllLevelProgress(), getReview()]);
  const passed = new Set(progress.filter((p) => p.bestStars > 0).map((p) => p.id));
  const levels = ORDER.map((l) => LEVELS[l.id]).filter(Boolean);
  const pool = riddlePool(levels, (id) => passed.has(id));

  const record = await todaysRiddle(day, (recent) => {
    const due = dueReview(review, day);
    if (due && LEVELS[due.levelId] && findPuzzle(LEVELS[due.levelId], due.puzzleId))
      return { levelId: due.levelId, puzzleId: due.puzzleId, rematch: due.missedOn };
    const pick = pickRiddle(pool, day, recent);
    return pick && { levelId: pick.levelId, puzzleId: pick.puzzle.id };
  });
  const level = record && LEVELS[record.levelId];
  const puzzle = level && findPuzzle(level, record!.puzzleId);
  if (!record || !level || !puzzle) return null;
  return { record, number: riddleNumber(day), level, puzzle: { ...puzzle, theme: puzzle.theme ?? level.theme } };
}
