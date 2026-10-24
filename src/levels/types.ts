import type { Theme } from '../bapu/themes';
import type { GameConfig } from './game';

/** A move in UCI notation, e.g. "g1f3" or "e7e8q". */
export type Uci = string;

/**
 * What the learner does in one step of a level:
 *   puzzle  – find the winning line (Lichess puzzle format)
 *   drill   – walk one piece onto every star (Level 1)
 *   quiz    – say whether the position is check, checkmate, stalemate or none (Level 3)
 *   choice  – pick the best of three candidate moves (Level 7)
 *   endgame – checkmate a lone king against the engine within a move limit (Level 18)
 */
export type ActivityKind = 'puzzle' | 'drill' | 'quiz' | 'choice' | 'endgame';

export type QuizAnswer = 'check' | 'mate' | 'stalemate' | 'none';

export interface ChoiceOption {
  uci: Uci;
  best?: boolean;
  /** Bapu's verdict on this move. */
  why: string;
}

/**
 * One step of a level. For puzzles (the default kind), Lichess puzzle format:
 * `fen` is the position BEFORE the opponent's move; `moves[0]` is the opponent's
 * move (animated first), then the solver plays moves[1], moves[3], ...
 * Other kinds use `fen` as the position the learner sees, plus their own fields.
 */
export interface PuzzleDef {
  id: string;
  kind?: ActivityKind;
  fen: string;
  moves: Uci[];
  /** "custom" for hand-authored, "lichess:<PuzzleId>" for imported. */
  source?: string;
  rating?: number;
  themes?: string[];
  /** Nudge shown when a hint is requested (guided steps). */
  hint?: string;
  /** Bapu's explanation once solved. Generated from a template if missing. */
  explanation?: string;
  /** Refutations for tempting wrong first moves, keyed by UCI. */
  wrong?: Record<Uci, string>;
  /** Demo only: one narration line per entry in `moves`. */
  narration?: string[];
  /** Demo only: the side the board is seen from (defaults to the side not to move). */
  orientation?: 'white' | 'black';
  /** For mixed levels: the theme of the level this puzzle came from (Bapu explains with it). */
  theme?: Theme;
  /** Drill: squares to visit, and the fewest moves that visit them all. */
  targets?: string[];
  par?: number;
  /** Quiz: the right answer. */
  answer?: QuizAnswer;
  /** Choice: the candidate moves. */
  options?: ChoiceOption[];
  /** Endgame: mate within this many moves to pass first try. */
  limit?: number;
}

/** Practice drawn from other levels' packs (checkpoints and the boss). */
export interface PracticeMix {
  levels: string[];
  count: number;
  /** Theme Bapu explains these with; defaults to each source level's theme. */
  theme?: Theme;
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
  /** Every level has a demo except the final round, which is one whole game (`game`). */
  demo?: PuzzleDef;
  guided: PuzzleDef[];
  /** Practice for this run. In content files: hand-authored steps, merged with the pack. */
  practice: PuzzleDef[];
  /** How many practice steps a run has (default 7). */
  practiceSize?: number;
  /** Checkpoints need ★★ to pass. */
  checkpoint?: boolean;
  /** Shows a clock (the boss level). */
  timed?: boolean;
  /** Draw practice from other levels' packs instead of (or as well as) this level's own. */
  mix?: PracticeMix[];
  /** The final round: a whole game against Bapu instead of puzzles. */
  game?: GameConfig;
  /** Imported puzzles (content/puzzles/LXX.json); each run draws its practice set from these. */
  pack?: PuzzleDef[];
  /** Resolved `mix`: the puzzles each group draws from. Filled in by the curriculum. */
  pools?: { puzzles: PuzzleDef[]; count: number }[];
}
