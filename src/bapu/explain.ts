import { Chess, type Move, type PieceSymbol, type Square } from 'chess.js';
import type { PuzzleDef } from '../levels/types';

export const PIECE_NAME: Record<PieceSymbol, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
};

export const PIECE_VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export interface Target {
  type: PieceSymbol;
  square: Square;
}

export interface MoveFacts {
  piece: PieceSymbol;
  from: Square;
  to: Square;
  check: boolean;
  captured?: PieceSymbol;
  /** Enemy pieces the moved piece attacks after the move, most valuable first (king first). */
  targets: Target[];
  /** True if the moved piece can be captured on its new square. */
  hanging: boolean;
}

function rank(t: PieceSymbol): number {
  return t === 'k' ? 100 : PIECE_VALUE[t];
}

/** Facts about `move` played from `fenBefore`, used to fill Bapu's templates. */
export function moveFacts(fenBefore: string, move: Pick<Move, 'from' | 'to' | 'promotion'>): MoveFacts {
  const chess = new Chess(fenBefore);
  const played = chess.move({ from: move.from, to: move.to, promotion: move.promotion });
  const us = played.color;
  const them = us === 'w' ? 'b' : 'w';

  const targets: Target[] = [];
  for (const row of chess.board()) {
    for (const sq of row) {
      if (!sq || sq.color !== them) continue;
      if (chess.attackers(sq.square, us).includes(played.to)) {
        targets.push({ type: sq.type, square: sq.square });
      }
    }
  }
  targets.sort((a, b) => rank(b.type) - rank(a.type));

  return {
    piece: played.piece,
    from: played.from,
    to: played.to,
    check: chess.inCheck(),
    captured: played.captured,
    targets,
    hanging: chess.attackers(played.to, them).length > 0,
  };
}

/** A fork worth celebrating: two or more targets that are the king or worth more than a pawn. */
export function isFork(f: MoveFacts): boolean {
  return f.targets.filter((t) => t.type !== 'p').length >= 2;
}

function targetName(t: Target): string {
  return t.type === 'k' ? 'the king' : `the ${PIECE_NAME[t.type]} on ${t.square}`;
}

function list(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return names.slice(0, -1).join(', ') + ' AND ' + names[names.length - 1];
}

/** Bapu's line right after the solver plays a correct move that isn't the last one. */
export function explainCorrect(f: MoveFacts): string {
  const big = f.targets.filter((t) => t.type !== 'p');
  if (isFork(f)) {
    const names = list(big.map(targetName));
    if (f.check) return `Check! Your ${PIECE_NAME[f.piece]} on ${f.to} hits ${names}. The king must move first, so something gets left behind.`;
    return `Your ${PIECE_NAME[f.piece]} on ${f.to} attacks ${names} at once. Only one can escape.`;
  }
  return 'Good move. Keep going!';
}

/** Bapu's line when the puzzle is solved (used when the puzzle has no hand-written explanation). */
export function explainSolved(fork: MoveFacts | undefined, final: MoveFacts): string {
  const prize = final.captured ? `the ${PIECE_NAME[final.captured]}` : 'the prize';
  if (fork && isFork(fork)) {
    const names = list(fork.targets.filter((t) => t.type !== 'p').map(targetName));
    return `${capitalize(PIECE_NAME[fork.piece])} to ${fork.to} forked ${names}. Only one could escape, so you collect ${prize}.`;
  }
  return `Nicely done, you won ${prize}.`;
}

/**
 * Bapu's line after a wrong move. Uses the puzzle's hand-written refutation if there is one,
 * otherwise a nudge based on what the move did.
 */
export function explainWrong(p: PuzzleDef, uci: string, f: MoveFacts, step: number, focus: PieceSymbol = 'n'): string {
  const custom = p.wrong?.[uci];
  if (custom && step === 0) return custom;
  if (step > 0) return 'The fork did its job. Now collect the prize: take the piece that couldn’t escape.';
  if (f.piece !== focus) {
    return `That's legal, but this level is all about the ${PIECE_NAME[focus]}. Find the square where it attacks two things at once.`;
  }
  if (isFork(f) && f.hanging) {
    return `Nice fork shape, but your ${PIECE_NAME[f.piece]} can just be captured on ${f.to}. A fork has to land on a safe square.`;
  }
  return `Right piece! But from ${f.to} it doesn't hit two big targets. Look for a square that does, ideally with check.`;
}

function capitalize(s: string): string {
  return s[0].toUpperCase() + s.slice(1);
}

/** Plain-English description of the opponent's move, e.g. "Black moved the bishop to c5." */
export function describeMove(m: Pick<Move, 'color' | 'piece' | 'to' | 'captured' | 'san'>): string {
  const who = m.color === 'w' ? 'White' : 'Black';
  const piece = PIECE_NAME[m.piece];
  const check = m.san.endsWith('+') ? ' Check!' : '';
  if (m.captured) return `${who}'s ${piece} took your ${PIECE_NAME[m.captured]} on ${m.to}.${check}`;
  return `${who} moved the ${piece} to ${m.to}.${check}`;
}
