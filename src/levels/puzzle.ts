import { Chess, type Move } from 'chess.js';
import type { PuzzleDef, Uci } from './types';

export type Color = 'white' | 'black';

export type MoveResult =
  /** Right move; the opponent answered with `reply` and it's the solver's turn again. */
  | { kind: 'correct'; move: Move; reply: Move }
  /** Right move and the puzzle is finished. */
  | { kind: 'solved'; move: Move }
  /** Legal but not the solution. The position is NOT changed. */
  | { kind: 'wrong'; move: Move }
  | { kind: 'illegal' };

export function parseUci(uci: Uci): { from: string; to: string; promotion?: string } {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] };
}

export function moveToUci(m: Pick<Move, 'from' | 'to' | 'promotion'>): Uci {
  return m.from + m.to + (m.promotion ?? '');
}

/**
 * Plays through one Lichess-style puzzle. Pure: no UI, no timers.
 * Call `start()` to play the opponent's setup move, then feed solver moves to `tryMove`.
 */
export class PuzzleSession {
  readonly def: PuzzleDef;
  readonly solver: Color;
  private chess: Chess;
  /** Index into def.moves of the next move to be played. */
  private ply = 0;
  private history: Move[] = [];

  constructor(def: PuzzleDef) {
    if (def.moves.length < 2) throw new Error(`Puzzle ${def.id} needs at least 2 moves`);
    this.def = def;
    this.chess = new Chess(def.fen);
    // The opponent moves first, so the solver is the side NOT to move in the FEN.
    this.solver = this.chess.turn() === 'w' ? 'black' : 'white';
  }

  get started(): boolean {
    return this.ply > 0;
  }

  get done(): boolean {
    return this.ply >= this.def.moves.length;
  }

  get fen(): string {
    return this.chess.fen();
  }

  get lastMove(): Move | undefined {
    return this.history[this.history.length - 1];
  }

  get turn(): Color {
    return this.chess.turn() === 'w' ? 'white' : 'black';
  }

  get inCheck(): boolean {
    return this.chess.inCheck();
  }

  /** Which solver move we're on: 0 for the first, 1 for the second, ... */
  get solverStep(): number {
    return Math.max(0, Math.floor((this.ply - 1) / 2));
  }

  /** Read-only copy of the current position, for move generation and analysis. */
  position(): Chess {
    return new Chess(this.chess.fen());
  }

  /** Plays the opponent's first move. */
  start(): Move {
    if (this.started) throw new Error('Puzzle already started');
    return this.play(this.def.moves[0]);
  }

  /** The solution move the solver should play now. */
  expected(): Uci | undefined {
    return this.done ? undefined : this.def.moves[this.ply];
  }

  tryMove(uci: Uci): MoveResult {
    if (!this.started) throw new Error('Call start() first');
    if (this.done) throw new Error('Puzzle already solved');

    const probe = new Chess(this.chess.fen());
    let move: Move;
    try {
      move = probe.move(parseUci(uci));
    } catch {
      return { kind: 'illegal' };
    }

    // Like Lichess: any move that delivers checkmate is accepted.
    const mates = probe.isCheckmate();
    if (moveToUci(move) !== this.expected() && !mates) return { kind: 'wrong', move };

    this.play(moveToUci(move));
    if (mates) this.ply = this.def.moves.length;
    if (this.done) return { kind: 'solved', move };

    const reply = this.play(this.def.moves[this.ply]);
    if (this.done) return { kind: 'solved', move };
    return { kind: 'correct', move, reply };
  }

  /** Plays the expected solver move (and the reply), e.g. for "show solution". */
  playSolution(): MoveResult {
    const uci = this.expected();
    if (!uci) throw new Error('Puzzle already solved');
    return this.tryMove(uci);
  }

  private play(uci: Uci): Move {
    const move = this.chess.move(parseUci(uci));
    this.history.push(move);
    this.ply++;
    return move;
  }
}
