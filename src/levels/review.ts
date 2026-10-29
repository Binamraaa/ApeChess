// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Binamra Bhusal

import type { PuzzleDef } from './types';

/**
 * Rematches: puzzles the learner missed come back as the daily riddle a couple of days later,
 * until they're solved first try. Positions from games against Bapu come back the same way.
 */

export interface ReviewItem {
  puzzleId: string;
  /** The level it was played in (where to find it again). */
  levelId: string;
  /** Local day of the last miss, YYYY-MM-DD. */
  missedOn: string;
  /** The puzzle itself, for one that isn't in any level (made from a game against Bapu). */
  puzzle?: PuzzleDef;
}

/** Days to wait after a miss before the rematch. */
export const REVIEW_GAP = 2;
/** At most this many waiting rematches; the oldest drop off. */
export const REVIEW_LIMIT = 30;

const dayNumber = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
};

/** Adds misses (or moves them to today) and drops puzzles just solved first try. Newest first. */
export function updateReview(items: ReviewItem[], levelId: string, missed: string[], solved: string[], day: string): ReviewItem[] {
  const fresh = missed.map((puzzleId) => ({ puzzleId, levelId, missedOn: day }));
  const gone = new Set([...missed, ...solved]);
  return [...fresh, ...items.filter((i) => !gone.has(i.puzzleId))].slice(0, REVIEW_LIMIT);
}

/** Adds puzzles made from a game's blunders. */
export function addGameRematches(items: ReviewItem[], levelId: string, puzzles: PuzzleDef[], day: string): ReviewItem[] {
  const fresh = puzzles.map((puzzle) => ({ puzzleId: puzzle.id, levelId, missedOn: day, puzzle }));
  const ids = new Set(puzzles.map((p) => p.id));
  return [...fresh, ...items.filter((i) => !ids.has(i.puzzleId))].slice(0, REVIEW_LIMIT);
}

/** The rematch that's been waiting longest, if any is due. */
export function dueReview(items: ReviewItem[], day: string): ReviewItem | undefined {
  return items
    .filter((i) => dayNumber(day) - dayNumber(i.missedOn) >= REVIEW_GAP)
    .sort((a, b) => dayNumber(a.missedOn) - dayNumber(b.missedOn))[0];
}
