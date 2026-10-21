import type { PieceSymbol } from 'chess.js';

/** What a level drills. Picks the prompt, default hint and wrong-move nudges. */
export type Theme =
  | 'knightFork'
  | 'fork'
  | 'hanging'
  | 'special'
  | 'mate'
  | 'backRank'
  | 'pin'
  | 'skewer'
  | 'discovered';

export interface ThemeCopy {
  /** Shown after the opponent's move: "Your move: …" */
  prompt: string;
  /** First-level hint when the puzzle has no hand-written one. */
  hint: string;
  /** Wrong move on a later step of the solution (the idea already landed). */
  followUp: string;
  /** Wrong first move that wasn't covered by a more specific message. */
  nudge: string;
  /** Pieces the level is about; a wrong move with another piece gets a gentle redirect. */
  focus?: PieceSymbol[];
  /** Summary headline for three stars. */
  mastery: string;
}

export const THEMES: Record<Theme, ThemeCopy> = {
  knightFork: {
    prompt: 'find the knight fork!',
    hint: 'Look at your knight. Which square lets it attack two things at once?',
    followUp: 'The fork did its job. Now collect the prize: take the piece that couldn’t escape.',
    nudge: 'Right piece! But from there it doesn’t hit two big targets. Look for a square that does, ideally with check.',
    focus: ['n'],
    mastery: 'Fork master!',
  },
  fork: {
    prompt: 'find the fork!',
    hint: 'Which of your pieces can attack two things at once? Don’t forget your pawns.',
    followUp: 'The fork did its job. Now collect the prize: take the piece that couldn’t escape.',
    nudge: 'That doesn’t attack two things at once. Look for a move that does, ideally with check.',
    focus: ['q', 'p'],
    mastery: 'Fork master!',
  },
  hanging: {
    prompt: 'find the free piece!',
    hint: 'Look for an enemy piece that nobody is guarding.',
    followUp: 'Nice. Keep going: is anything else left unguarded?',
    nudge: 'That doesn’t win anything. Look for an enemy piece with no defenders, and grab it.',
    mastery: 'Sharp eyes!',
  },
  special: {
    prompt: 'find the special move!',
    hint: 'Think castling, en passant or promotion. One of them is hiding here.',
    followUp: 'Good start. Now finish the job.',
    nudge: 'That’s an ordinary move. This position calls for one of the three secret handshakes: castling, en passant or promotion.',
    mastery: 'Secret handshake!',
  },
  mate: {
    prompt: 'find checkmate in one!',
    hint: 'Try every check in your head. Which one leaves the king no escape?',
    followUp: 'Keep checking. The king is almost out of squares.',
    nudge: 'That’s not check. Checkmate always starts with a check, so try those first.',
    mastery: 'Mate master!',
  },
  backRank: {
    prompt: 'find the back-rank mate!',
    hint: 'The king is boxed in by its own pawns. Which of your pieces can reach its back row?',
    followUp: 'Keep going. The back row is still weak.',
    nudge: 'That’s not check. Look at the king’s back row: its own pawns have locked the door.',
    mastery: 'Back-rank bandit!',
  },
  pin: {
    prompt: 'use the pin!',
    hint: 'Look for an enemy piece stuck in front of something bigger. Can you pile on it, or pin it?',
    followUp: 'The pinned piece is stuck. Now cash in.',
    nudge: 'That doesn’t use the pin. Find the enemy piece that can’t move without exposing something bigger behind it.',
    mastery: 'Pin wizard!',
  },
  skewer: {
    prompt: 'find the skewer!',
    hint: 'Line up a long-range piece on the king or queen, with something else hiding behind it.',
    followUp: 'The big piece stepped aside. Now take what was behind it.',
    nudge: 'No skewer there. Use a bishop, rook or queen to attack a big piece that has a smaller one lined up behind it.',
    mastery: 'Skewer chef!',
  },
  discovered: {
    prompt: 'find the discovered attack!',
    hint: 'One of your long-range pieces is hiding behind another of your pieces. Move the front one, with a threat of its own.',
    followUp: 'Two threats, one reply. Now take what they couldn’t save.',
    nudge: 'Not quite. Look for a piece of yours that’s blocking your own bishop, rook or queen, and move it with a threat.',
    mastery: 'Surprise artist!',
  },
};
