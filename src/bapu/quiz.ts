import { Chess, type Square } from 'chess.js';
import type { QuizAnswer } from '../levels/types';
import { PIECE_NAME } from './facts';

export const ANSWER_LABEL: Record<QuizAnswer, string> = {
  check: 'Check',
  mate: 'Checkmate',
  stalemate: 'Stalemate',
  none: 'None',
};

/** What the position is for the side to move. */
export function quizAnswer(fen: string): QuizAnswer {
  const chess = new Chess(fen);
  if (chess.isCheckmate()) return 'mate';
  if (chess.isStalemate()) return 'stalemate';
  if (chess.inCheck()) return 'check';
  return 'none';
}

/** Bapu's explanation of why the position is check, mate, stalemate or nothing special. */
export function explainQuiz(fen: string): string {
  const chess = new Chess(fen);
  const side = chess.turn() === 'w' ? 'White' : 'Black';
  const enemy = chess.turn() === 'w' ? 'b' : 'w';
  const king = chess.board().flat().find((p) => p?.type === 'k' && p.color === chess.turn())!.square;
  const checkers = chess.attackers(king as Square, enemy).map((sq) => `the ${PIECE_NAME[chess.get(sq)!.type]} on ${sq}`);
  const by = checkers.length > 1 ? `${checkers.join(' and ')} (double check!)` : checkers[0];

  switch (quizAnswer(fen)) {
    case 'mate':
      return `Checkmate! ${side}'s king is attacked by ${by}, it has no safe square, and nothing can block or capture the attacker. Game over.`;
    case 'stalemate':
      return `Stalemate! It’s ${side}’s move and the king is NOT in check, but there isn’t a single legal move. That’s a draw, so the side that was winning just threw it away.`;
    case 'check': {
      const replies = chess.moves({ verbose: true });
      const run = replies.find((m) => m.piece === 'k');
      const take = replies.find((m) => m.piece !== 'k' && m.captured);
      const way = run
        ? `the king can step to ${run.to}`
        : take
          ? `the ${PIECE_NAME[take.piece]} can capture the attacker`
          : 'another piece can block the line';
      return `Check! ${side}'s king is attacked by ${by}. But it isn’t mate: ${way}.`;
    }
    case 'none':
      return `Nothing special: ${side}'s king isn’t attacked, and ${side} has moves to play. Just a normal position.`;
  }
}
