// Level 1 drills: one white piece walks onto every star. chess.js insists on both kings being
// on the board, so drills use their own tiny move generator instead.

export type DrillPiece = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P';

export interface DrillBoard {
  piece: DrillPiece;
  square: string;
  /** Black pawns: the white pawn captures them, other pieces can take them too. */
  pawns: Set<string>;
}

const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const STRAIGHT = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];

const at = (sq: string) => [sq.charCodeAt(0) - 97, Number(sq[1]) - 1] as const;
const name = (f: number, r: number) => (f >= 0 && f < 8 && r >= 0 && r < 8 ? String.fromCharCode(97 + f) + (r + 1) : undefined);

/** Parses a drill FEN: one white piece plus optional black pawns. */
export function parseDrill(fen: string): DrillBoard {
  const rows = fen.split(' ')[0].split('/');
  let piece: DrillPiece | undefined;
  let square = '';
  const pawns = new Set<string>();
  rows.forEach((row, i) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) {
        f += Number(ch);
        continue;
      }
      const sq = name(f, 7 - i)!;
      if (ch === 'p') pawns.add(sq);
      else if ('KQRBNP'.includes(ch)) {
        piece = ch as DrillPiece;
        square = sq;
      } else throw new Error(`Drills only have one white piece and black pawns: ${fen}`);
      f++;
    }
  });
  if (!piece) throw new Error(`No white piece in drill ${fen}`);
  return { piece, square, pawns };
}

/** Board placement for chessground (piece placement only). */
export function drillFen(b: DrillBoard): string {
  const rows: string[] = [];
  for (let r = 7; r >= 0; r--) {
    let row = '';
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const sq = name(f, r)!;
      const ch = sq === b.square ? b.piece : b.pawns.has(sq) ? 'p' : '';
      if (!ch) empty++;
      else {
        row += (empty || '') + ch;
        empty = 0;
      }
    }
    rows.push(row + (empty || ''));
  }
  return rows.join('/');
}

/** Squares the piece can move to. */
export function drillMoves(b: DrillBoard): string[] {
  const [f, r] = at(b.square);
  const out: string[] = [];
  const slide = (dirs: number[][], max: number) => {
    for (const [df, dr] of dirs) {
      for (let i = 1; i <= max; i++) {
        const sq = name(f + df * i, r + dr * i);
        if (!sq) break;
        out.push(sq);
        if (b.pawns.has(sq)) break;
      }
    }
  };
  switch (b.piece) {
    case 'R': slide(STRAIGHT, 7); break;
    case 'B': slide(DIAG, 7); break;
    case 'Q': slide([...STRAIGHT, ...DIAG], 7); break;
    case 'K': slide([...STRAIGHT, ...DIAG], 1); break;
    case 'N':
      for (const [df, dr] of KNIGHT) {
        const sq = name(f + df, r + dr);
        if (sq) out.push(sq);
      }
      break;
    case 'P': {
      const one = name(f, r + 1);
      if (one && !b.pawns.has(one)) {
        out.push(one);
        const two = name(f, r + 2);
        if (r === 1 && two && !b.pawns.has(two)) out.push(two);
      }
      for (const df of [-1, 1]) {
        const sq = name(f + df, r + 1);
        if (sq && b.pawns.has(sq)) out.push(sq);
      }
      break;
    }
  }
  return out;
}

/** Plays a move: captures any pawn on the square, and a pawn on the last row becomes a queen. */
export function drillMove(b: DrillBoard, to: string): DrillBoard {
  const pawns = new Set(b.pawns);
  pawns.delete(to);
  const piece = b.piece === 'P' && to[1] === '8' ? 'Q' : b.piece;
  return { piece, square: to, pawns };
}

const key = (b: DrillBoard, left: string[]) => `${b.piece}${b.square}|${[...b.pawns].sort().join()}|${left.join()}`;

/**
 * Fewest moves to visit every target from this board, and the route that does it
 * (breadth-first search over piece square, pawns left and stars left). Drills are small, so this is quick.
 */
export function solveDrill(b: DrillBoard, targets: string[]): { moves: number; route: string[] } {
  const start = targets.filter((t) => t !== b.square).sort();
  if (!start.length) return { moves: 0, route: [] };
  type Node = { b: DrillBoard; left: string[]; route: string[] };
  let frontier: Node[] = [{ b, left: start, route: [] }];
  const seen = new Set([key(b, start)]);
  for (let depth = 1; frontier.length && depth <= 40; depth++) {
    const next: Node[] = [];
    for (const n of frontier) {
      for (const to of drillMoves(n.b)) {
        const nb = drillMove(n.b, to);
        const left = n.left.filter((t) => t !== to);
        const route = [...n.route, to];
        if (!left.length) return { moves: depth, route };
        const k = key(nb, left);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push({ b: nb, left, route });
      }
    }
    frontier = next;
  }
  throw new Error('Drill has no solution');
}
