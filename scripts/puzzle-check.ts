// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Binamra Bhusal

// Stockfish checks shared by verify-puzzles (hand-made levels) and build-puzzles (Lichess packs).
import { Chess } from 'chess.js';
import type { PuzzleDef } from '../src/levels/types';
import type { UciEngine } from './uci-engine';

export interface CheckOptions {
  depth?: number;
  /** The solution must beat the second-best move by this much (centipawns)... */
  minGap?: number;
  /** ...unless the second-best move doesn't also win (less than this for the solver). */
  winning?: number;
  /** An opponent reply in the line may be at most this much worse than its best defence. */
  replySlack?: number;
  /**
   * Reject a final checkmate if a different move also mates. The app accepts any mate, so this
   * only matters when the lesson is about *how* to mate (e.g. castling into mate).
   */
  uniqueMate?: boolean;
  log?: (line: string) => void;
}

const MATE = 90000;

export function fmt(cp: number) {
  if (Math.abs(cp) > MATE) return (cp > 0 ? '#' : '-#') + (100000 - Math.abs(cp));
  return (cp > 0 ? '+' : '') + (cp / 100).toFixed(1);
}

function play(chess: Chess, uci: string) {
  return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
}

/** The board always promotes to a queen, so e7e8q and e7e8r count as the same move. */
const sameSquares = (a: string, b: string) => a.slice(0, 4) === b.slice(0, 4);

const matesIn = (fen: string, uci: string) => {
  const probe = new Chess(fen);
  play(probe, uci);
  return probe.isCheckmate();
};

/**
 * Checks one puzzle line. Returns the problems found (empty means it's sound):
 *   - every solver move is the engine's best, clearly better than any other winning move
 *   - every opponent reply after the first is a sensible defence, not a blunder
 *   - the solver is clearly winning (or has mated) at the end
 */
export async function checkPuzzle(engine: UciEngine, p: PuzzleDef, opts: CheckOptions = {}): Promise<string[]> {
  const { depth = 16, minGap = 100, winning = 200, replySlack = 150, uniqueMate = false, log = () => {} } = opts;
  const problems: string[] = [];
  const chess = new Chess(p.fen);
  play(chess, p.moves[0]);

  for (let i = 1; i < p.moves.length; i += 2) {
    const fen = chess.fen();
    const lines = await engine.analyse(fen, depth, 4);
    const best = lines[0];
    const second = lines.find((l) => !sameSquares(l.pv[0], best?.pv[0] ?? ''));
    if (!best) {
      problems.push(`step ${(i + 1) / 2}: engine gave no line`);
      break;
    }
    const want = p.moves[i];
    const last = i === p.moves.length - 1;
    const note =
      `step ${(i + 1) / 2}: want ${want}, engine ${best.pv[0]} ${fmt(best.cp)}` +
      (second ? `, 2nd ${second.pv[0]} ${fmt(second.cp)}` : '');
    log(note);

    const wantMates = matesIn(fen, want);
    // Any mate is accepted in the app, so a final mate only needs to be a mate.
    if (last && wantMates) {
      const otherMate = lines.some((l) => !sameSquares(l.pv[0], want) && matesIn(fen, l.pv[0]));
      if (uniqueMate && otherMate) problems.push(`${note}: another move also mates`);
    } else if (!sameSquares(best.pv[0], want)) {
      problems.push(`${note}: solution is not the engine's best move`);
    } else if (second && second.cp >= winning && best.cp - second.cp < minGap) {
      problems.push(`${note}: another move wins about as well, so the solution isn't unique`);
    }

    play(chess, want);
    if (i + 1 < p.moves.length) {
      const before = chess.fen();
      const reply = p.moves[i + 1];
      const [defence] = await engine.analyse(before, depth, 1);
      if (defence && !sameSquares(defence.pv[0], reply)) {
        const after = new Chess(before);
        play(after, reply);
        const [then] = after.isGameOver() ? [] : await engine.analyse(after.fen(), depth, 1);
        // Scores are from the side to move: the opponent before, the solver after.
        const replyCp = then ? -then.cp : -100000;
        if (defence.cp - replyCp > replySlack) {
          problems.push(`opponent reply ${reply} is a blunder (${fmt(replyCp)} vs ${defence.pv[0]} ${fmt(defence.cp)})`);
        }
      }
      play(chess, reply);
    }
  }

  if (!chess.isCheckmate()) {
    const [final] = await engine.analyse(chess.fen(), depth, 1);
    const solverCp = final ? -final.cp : 0; // the opponent is to move
    log(`final eval for solver: ${fmt(solverCp)}`);
    if (solverCp < winning) problems.push(`final eval ${fmt(solverCp)} is not clearly winning`);
  }
  return problems;
}
