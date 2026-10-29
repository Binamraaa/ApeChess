// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Binamra Bhusal

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
  | 'discovered'
  | 'removeDefender'
  | 'deflection'
  | 'trapped'
  | 'mateIn2'
  | 'pawnEndgame'
  | 'defend'
  | 'mixed'
  | 'drill'
  | 'quiz'
  | 'choice'
  | 'endgame';

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
  removeDefender: {
    prompt: 'remove the defender!',
    hint: 'Find the enemy piece that guards something valuable. What happens if it disappears?',
    followUp: 'The guard is gone. Now take what it was protecting.',
    nudge: 'Not quite. Look for one enemy piece doing an important guarding job, then capture it or chase it away.',
    mastery: 'Bodyguard buster!',
  },
  deflection: {
    prompt: 'drag a defender away!',
    hint: 'One enemy piece is holding everything together. Can you force it to move, or lure the king somewhere bad?',
    followUp: 'It took the bait. Now strike where it used to guard.',
    nudge: 'That gives them time. Look for a forcing move, a check or a capture, that pulls a defender away from its job.',
    mastery: 'Master of distraction!',
  },
  trapped: {
    prompt: 'trap a piece!',
    hint: 'Look for an enemy piece with very few safe squares. Can you take the last ones away?',
    followUp: 'It’s got nowhere to run. Go and collect it.',
    nudge: 'That lets it escape. Find the enemy piece that’s short of squares, and cut off its last way out.',
    mastery: 'Piece hunter!',
  },
  mateIn2: {
    prompt: 'find checkmate in two!',
    hint: 'Start with the most forcing move: a check, or a sacrifice they must take. Then look for mate.',
    followUp: 'Now finish it: one more move is checkmate.',
    nudge: 'That gives the king time to breathe. Look for a forcing first move, usually a check, that leads to mate next move.',
    mastery: 'Two-move terminator!',
  },
  pawnEndgame: {
    prompt: 'win the pawn ending!',
    hint: 'In pawn endings, every king step counts. Think about opposition, and whether a pawn can outrun the king.',
    followUp: 'Good. Keep marching, the queen is near.',
    nudge: 'In a pawn ending one wasted move can throw away the win. Think about which king has to give way.',
    mastery: 'Endgame expert!',
  },
  defend: {
    prompt: 'spot the threat and stop it!',
    hint: 'What is your opponent threatening right now? Deal with that before anything else.',
    followUp: 'Threat stopped. Now make your own move count.',
    nudge: 'Careful: that ignores what your opponent is threatening. Ask what they want to do next, and stop it.',
    mastery: 'Rock-solid defender!',
  },
  mixed: {
    prompt: 'find the best move!',
    hint: 'Run the checklist: checks, captures, threats. For you AND for your opponent.',
    followUp: 'Good start. Keep going, and finish the job.',
    nudge: 'Not this time. Run the checklist again: checks first, then captures, then threats.',
    mastery: 'Tactic spotter!',
  },
  drill: {
    prompt: 'collect every star!',
    hint: 'Look at where your piece can go from here, and plan a route through all the stars.',
    followUp: 'Keep going!',
    nudge: 'That piece can’t move like that.',
    mastery: 'Smooth moves!',
  },
  quiz: {
    prompt: 'check, checkmate, stalemate, or none?',
    hint: 'Is the king attacked? Then ask: can it run, can anything block, can the attacker be captured?',
    followUp: '',
    nudge: '',
    mastery: 'Sharp eyes!',
  },
  choice: {
    prompt: 'pick the best move!',
    hint: 'Think about the centre, getting knights and bishops out, and keeping your king safe.',
    followUp: '',
    nudge: '',
    mastery: 'Opening sage!',
  },
  endgame: {
    prompt: 'checkmate the lone king!',
    hint: 'Shrink the box the king lives in, and bring your own king closer to help.',
    followUp: '',
    nudge: '',
    mastery: 'Mating machine!',
  },
};
