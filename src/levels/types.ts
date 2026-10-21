import type { Theme } from '../bapu/themes';

/** A move in UCI notation, e.g. "g1f3" or "e7e8q". */
export type Uci = string;

/**
 * One puzzle, in Lichess puzzle format.
 * `fen` is the position BEFORE the opponent's move; `moves[0]` is the opponent's
 * move (animated first), then the solver plays moves[1], moves[3], ...
 */
export interface PuzzleDef {
  id: string;
  fen: string;
  moves: Uci[];
  /** "custom" for hand-authored, "lichess:<PuzzleId>" for imported. */
  source?: string;
  rating?: number;
  themes?: string[];
  /** Nudge shown when a hint is requested (guided puzzles). */
  hint?: string;
  /** Bapu's explanation once solved. Generated from a template if missing. */
  explanation?: string;
  /** Refutations for tempting wrong first moves, keyed by UCI. */
  wrong?: Record<Uci, string>;
  /** Demo only: one narration line per entry in `moves`. */
  narration?: string[];
}

export interface LevelDef {
  id: string;
  number: number;
  unit: number;
  unitTitle: string;
  title: string;
  /** What the level drills: picks Bapu's prompt, default hints and templates. */
  theme: Theme;
  /** Piece shown on the level's badge, e.g. "wN" (public/pieces/wN.svg). */
  icon: string;
  /** Concept card, Bapu speaking (≤ 2 sentences). */
  concept: string;
  /** One-line definition of the jargon this level introduces. */
  glossary?: { term: string; definition: string };
  /** The one-line rule to remember, shown on the summary card. */
  summary: string;
  demo: PuzzleDef;
  guided: PuzzleDef[];
  /** Practice puzzles for this run. In content files: hand-authored extras, merged with the pack. */
  practice: PuzzleDef[];
  /** Imported puzzles (content/puzzles/LXX.json); each run draws its practice set from these. */
  pack?: PuzzleDef[];
}
