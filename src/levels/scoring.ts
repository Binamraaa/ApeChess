export interface PuzzleOutcome {
  puzzleId: string;
  /** Solved without any wrong move. */
  firstTry: boolean;
  hintUsed: boolean;
  /** True if the solver gave up and the solution was shown. */
  revealed: boolean;
}

export type Stars = 1 | 2 | 3;

export const XP_FIRST_TRY = 10;
export const XP_WITH_HINT = 5;
export const LEVEL_BONUS: Record<Stars, number> = { 1: 20, 2: 40, 3: 60 };

/** XP for a single puzzle: 10 first try, 5 first try with a hint, otherwise 0. */
export function puzzleXp(o: PuzzleOutcome): number {
  if (!isFirstTry(o)) return 0;
  return o.hintUsed ? XP_WITH_HINT : XP_FIRST_TRY;
}

function isFirstTry(o: PuzzleOutcome): boolean {
  return o.firstTry && !o.revealed;
}

/**
 * Stars for a completed level (guided + practice, normally 10 puzzles).
 * ★ complete · ★★ ≥ 7/10 first try · ★★★ ≥ 9/10 first try and no hints.
 * Thresholds are fractions of the set so shorter sets still score sensibly.
 */
export function levelStars(outcomes: PuzzleOutcome[]): Stars {
  const total = outcomes.length;
  if (total === 0) return 1;
  const firstTry = outcomes.filter(isFirstTry).length;
  const anyHints = outcomes.some((o) => o.hintUsed);
  if (firstTry >= Math.ceil(total * 0.9) && !anyHints) return 3;
  if (firstTry >= Math.ceil(total * 0.7)) return 2;
  return 1;
}

export interface LevelScore {
  stars: Stars;
  firstTry: number;
  total: number;
  puzzleXp: number;
  bonusXp: number;
  totalXp: number;
}

export function scoreLevel(outcomes: PuzzleOutcome[]): LevelScore {
  const stars = levelStars(outcomes);
  const pXp = outcomes.reduce((sum, o) => sum + puzzleXp(o), 0);
  const bonusXp = LEVEL_BONUS[stars];
  return {
    stars,
    firstTry: outcomes.filter(isFirstTry).length,
    total: outcomes.length,
    puzzleXp: pXp,
    bonusXp,
    totalXp: pXp + bonusXp,
  };
}
