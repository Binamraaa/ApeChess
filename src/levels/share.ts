// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Binamra Bhusal

import type { Outcome } from './game';
import type { PuzzleOutcome, Stars } from './scoring';

/**
 * Results as short spoiler-free text to post anywhere, one square per puzzle:
 * 🟩 first try · 🟨 got there (hint or a mistake) · ⬜ solution shown
 */

export function mark(o: PuzzleOutcome): string {
  if (o.revealed) return '⬜';
  return o.firstTry && !o.hintUsed ? '🟩' : '🟨';
}

/** Squares in rows of five. */
export function grid(outcomes: PuzzleOutcome[]): string {
  const marks = outcomes.map(mark);
  const rows: string[] = [];
  for (let i = 0; i < marks.length; i += 5) rows.push(marks.slice(i, i + 5).join(''));
  return rows.join('\n');
}

interface LevelShare {
  number: number;
  title: string;
  stars: Stars;
  outcomes: PuzzleOutcome[];
  /** Time taken, for timed levels. */
  seconds?: number;
  url: string;
}

export function levelShareText({ number, title, stars, outcomes, seconds, url }: LevelShare): string {
  const firstTry = outcomes.filter((o) => o.firstTry && !o.revealed).length;
  const time = seconds !== undefined ? ` · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : '';
  return [
    `ApeChess · Level ${number}: ${title}`,
    `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)} ${firstTry}/${outcomes.length} first try${time}`,
    grid(outcomes),
    url,
  ].join('\n');
}

interface GameShare {
  outcome: Outcome;
  stars: Stars;
  moves: number;
  blunders: number;
  url: string;
}

export function gameShareText({ outcome, stars, moves, blunders, url }: GameShare): string {
  const result = { won: 'I beat Bapu!', drawn: 'I held Bapu to a draw!', lost: 'Bapu won, but I made him work', resigned: 'Bapu won, but I made him work' }[outcome];
  const slips = blunders === 0 ? 'no blunders' : `${blunders} blunder${blunders > 1 ? 's' : ''}`;
  return [`ApeChess · The final: a game against Bapu`, `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)} ${result}`, `${moves} moves · ${slips}`, url].join('\n');
}

interface RiddleShare {
  number: number;
  outcome: PuzzleOutcome;
  streak: number;
  url: string;
}

export function riddleShareText({ number, outcome, streak, url }: RiddleShare): string {
  const how = outcome.revealed ? 'Learned a new trick' : outcome.firstTry ? (outcome.hintUsed ? 'Solved with a hint' : 'Solved first try') : 'Solved';
  return [`ApeChess · Bapu’s riddle #${number}`, `${mark(outcome)} ${how}${streak > 1 ? ` · 🔥 ${streak}` : ''}`, url].join('\n');
}
