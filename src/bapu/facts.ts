import { Chess, type Color, type Move, type PieceSymbol, type Square } from 'chess.js';

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

/** Two enemy pieces on one line from our slider: a pin (small piece in front) or a skewer (big piece in front). */
export interface LineTactic {
  kind: 'pin' | 'skewer';
  by: Target;
  front: Target;
  behind: Target;
}

/** A piece of ours that the move unblocked, now attacking something worth attacking. */
export interface Discovery {
  by: Target;
  target: Target;
}

export interface MoveFacts {
  piece: PieceSymbol;
  from: Square;
  to: Square;
  check: boolean;
  mate: boolean;
  captured?: PieceSymbol;
  /** What a pawn promoted to, if it did. */
  promotion?: PieceSymbol;
  special?: 'castle' | 'enPassant' | 'promotion';
  /** Enemy pieces the moved piece attacks after the move, most valuable first (king first). */
  targets: Target[];
  /** The targets that make a real fork: the king, anything undefended, or anything worth more than the attacker. */
  forkTargets: Target[];
  /** True if the moved piece can be captured on its new square. */
  hanging: boolean;
  /** Our pieces guarding the moved piece on its new square, cheapest first. */
  defenders: Target[];
  /** Where the enemy king stands after the move. */
  king: Square;
  /** True if the captured piece had no defender (so it was simply free). */
  capturedFree: boolean;
  /** Pins and skewers by any of our sliders after the move; ones by the moved piece come first. */
  lines: LineTactic[];
  discovered: Discovery[];
  doubleCheck: boolean;
  /** Mate with the king trapped on its back rank by its own pieces. */
  backRank: boolean;
  /** For a check that isn't mate: where the king can run, or how the check can be stopped. */
  escapes: Square[];
  stoppedBy?: 'capture' | 'block';
}

const rank = (t: PieceSymbol) => (t === 'k' ? 100 : PIECE_VALUE[t]);
const byValue = (a: Target, b: Target) => rank(b.type) - rank(a.type);

const DIAGONALS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const STRAIGHTS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const RAYS: Partial<Record<PieceSymbol, number[][]>> = { b: DIAGONALS, r: STRAIGHTS, q: [...DIAGONALS, ...STRAIGHTS] };

function step(sq: Square, df: number, dr: number): Square | undefined {
  const f = sq.charCodeAt(0) - 97 + df;
  const r = Number(sq[1]) + dr;
  return f >= 0 && f < 8 && r >= 1 && r <= 8 ? ((String.fromCharCode(97 + f) + r) as Square) : undefined;
}

/** Pins and skewers by the slider on `square` against the other side. */
export function lineTactics(chess: Chess, square: Square): LineTactic[] {
  const me = chess.get(square);
  if (!me || !RAYS[me.type]) return [];
  const out: LineTactic[] = [];
  for (const [df, dr] of RAYS[me.type]!) {
    const hits: Target[] = [];
    for (let s = step(square, df, dr); s && hits.length < 2; s = step(s, df, dr)) {
      const p = chess.get(s);
      if (!p) continue;
      if (p.color === me.color) break;
      hits.push({ type: p.type, square: s });
    }
    if (hits.length < 2) continue;
    const [front, behind] = hits;
    const by = { type: me.type, square };
    if (behind.type === 'k' || (rank(behind.type) > rank(front.type) && behind.type !== 'p')) {
      out.push({ kind: 'pin', by, front, behind });
    } else if (front.type === 'k' || (rank(front.type) > rank(behind.type) && PIECE_VALUE[behind.type] >= 3)) {
      out.push({ kind: 'skewer', by, front, behind });
    }
  }
  return out;
}

/** Enemy pieces (or the king) that our piece on `square` attacks. */
function attacked(chess: Chess, square: Square, us: Color): Target[] {
  const out: Target[] = [];
  for (const row of chess.board()) {
    for (const sq of row) {
      if (sq && sq.color !== us && chess.attackers(sq.square, us).includes(square)) {
        out.push({ type: sq.type, square: sq.square });
      }
    }
  }
  return out.sort(byValue);
}

function squaresOf(chess: Chess, color: Color, types?: PieceSymbol[]): Target[] {
  const out: Target[] = [];
  for (const row of chess.board()) {
    for (const sq of row) if (sq && sq.color === color && (!types || types.includes(sq.type))) out.push({ type: sq.type, square: sq.square });
  }
  return out;
}

function kingSquare(chess: Chess, color: Color): Square {
  return squaresOf(chess, color, ['k'])[0].square;
}

/** Material in pawns for one side (king not counted). */
export function material(fen: string, color: Color): number {
  return squaresOf(new Chess(fen), color).reduce((n, t) => n + PIECE_VALUE[t.type], 0);
}

/** Facts about `move` played from `fenBefore`, used to fill Bapu's templates. */
export function moveFacts(fenBefore: string, move: Pick<Move, 'from' | 'to' | 'promotion'>): MoveFacts {
  const before = new Chess(fenBefore);
  const chess = new Chess(fenBefore);
  const played = chess.move({ from: move.from, to: move.to, promotion: move.promotion });
  const us = played.color;
  const them: Color = us === 'w' ? 'b' : 'w';

  const special = played.isKingsideCastle() || played.isQueensideCastle()
    ? 'castle'
    : played.isEnPassant()
      ? 'enPassant'
      : played.isPromotion()
        ? 'promotion'
        : undefined;

  // Lines: our sliders after the move, the moved piece's first.
  const sliders = squaresOf(chess, us, ['b', 'r', 'q']).sort(
    (a, b) => Number(b.square === played.to) - Number(a.square === played.to),
  );
  const lines = sliders.flatMap((s) => lineTactics(chess, s.square));

  // Discoveries: our other pieces that attack something new now the moved piece is out of the way.
  const discovered: Discovery[] = [];
  for (const s of sliders) {
    if (s.square === played.to) continue;
    const old = new Set(attacked(before, s.square, us).map((t) => t.square));
    for (const t of attacked(chess, s.square, us)) {
      if (!old.has(t.square) && (t.type === 'k' || PIECE_VALUE[t.type] >= 3)) discovered.push({ by: s, target: t });
    }
  }

  const check = chess.inCheck();
  const mate = chess.isCheckmate();
  const theirKing = kingSquare(chess, them);
  const checkers = check ? chess.attackers(theirKing, us).length : 0;

  let escapes: Square[] = [];
  let stoppedBy: MoveFacts['stoppedBy'];
  if (check && !mate) {
    const replies = chess.moves({ verbose: true });
    escapes = replies.filter((m) => m.piece === 'k').map((m) => m.to);
    if (escapes.length === 0) stoppedBy = replies.some((m) => m.captured) ? 'capture' : 'block';
  }

  // Back-rank mate: king on its home rank, mated along that rank, its own pieces blocking the way out.
  const home = them === 'w' ? '1' : '8';
  const backRank =
    mate &&
    theirKing[1] === home &&
    chess.attackers(theirKing, us).some((sq) => sq[1] === home) &&
    [-1, 0, 1].some((df) => {
      const s = step(theirKing, df, them === 'w' ? 1 : -1);
      return s && chess.get(s)?.color === them;
    });

  const targets = attacked(chess, played.to, us);
  const forkTargets = targets.filter(
    (t) => t.type === 'k' || PIECE_VALUE[t.type] > PIECE_VALUE[played.piece] || chess.attackers(t.square, them).length === 0,
  );

  return {
    piece: played.piece,
    from: played.from,
    to: played.to,
    check,
    mate,
    captured: played.captured,
    promotion: played.promotion,
    special,
    targets,
    forkTargets,
    hanging: chess.attackers(played.to, them).length > 0,
    defenders: chess
      .attackers(played.to, us)
      .map((sq) => ({ type: chess.get(sq)!.type, square: sq }))
      .sort(byValue)
      .reverse(),
    capturedFree: Boolean(played.captured) && before.attackers(played.to, them).length === 0,
    king: theirKing,
    lines,
    discovered,
    doubleCheck: checkers >= 2,
    backRank,
    escapes,
    stoppedBy,
  };
}

/** True if two squares touch (including diagonally). */
export function adjacent(a: Square, b: Square): boolean {
  return Math.abs(a.charCodeAt(0) - b.charCodeAt(0)) <= 1 && Math.abs(Number(a[1]) - Number(b[1])) <= 1 && a !== b;
}

/** A fork worth celebrating: two or more real targets bigger than a pawn. */
export function isFork(f: MoveFacts): boolean {
  return f.forkTargets.filter((t) => t.type !== 'p').length >= 2;
}
