// Builds small per-level puzzle packs from the Lichess puzzle database (CC0).
//
//   1. Download https://database.lichess.org/lichess_db_puzzle.csv.zst into data/raw/
//   2. npm run puzzles            (all packs)   or   npm run puzzles -- L05 L06
//      Add --no-engine to skip the Stockfish check (much faster, for trying out filters).
//
// Writes content/puzzles/LXX.json. The raw CSV is never committed (data/raw/ is gitignored).
import { closeSync, createReadStream, existsSync, fstatSync, mkdirSync, openSync, readSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { createZstdDecompress } from 'node:zlib';
import { Chess, type PieceSymbol, type Square } from 'chess.js';
import type { PuzzleDef } from '../src/levels/types';
import { PIECE_VALUE, isFork, lineInsights, material, moveFacts, type LineInsights, type MoveFacts } from '../src/bapu/facts';
import { keyLine } from '../src/bapu/explain';
import { checkPuzzle } from './puzzle-check';
import { UciEngine } from './uci-engine';

const RAW = join(import.meta.dirname, '..', 'data', 'raw', 'lichess_db_puzzle.csv.zst');
const OUT = join(import.meta.dirname, '..', 'content', 'puzzles');

const PACK_SIZE = 40;
/** Only well-liked, well-tested puzzles: the curriculum asks for popularity > 80 and > 500 plays. */
const MIN_POPULARITY = 80;
const MIN_PLAYS = 500;
const MAX_DEVIATION = 90;
/** Ratings are bucketed so each pack spans its whole range instead of clustering at one end. */
const BUCKET = 100;

interface Row {
  id: string;
  fen: string;
  moves: string[];
  rating: number;
  popularity: number;
  plays: number;
  themes: string[];
}

interface PackSpec {
  /** Puzzles must have at least one of these themes. */
  anyTheme: string[];
  /** ...and all of these. */
  allThemes?: string[];
  /** ...and none of these. */
  noThemes?: string[];
  rating: [number, number];
  /** Lower the play-count bar for rare themes. */
  minPlays?: number;
  /** Longest allowed solution, counting the opponent's first move. 4 = two solver moves. */
  maxMoves?: number;
  /** Extra filter, e.g. "the first solver move is a knight move". */
  where?: (r: Row) => boolean;
  /** Spread the pack evenly across these groups (e.g. pawn forks vs queen forks). */
  groupBy?: (r: Row) => string;
  /** Reject puzzles where a different move also mates (the lesson is the move itself). */
  uniqueMate?: boolean;
  /** Lowest final engine score (centipawns, solver's view) that counts as a success. Default: clearly winning. */
  minEval?: number;
}

/** Piece letter (case shows colour) on `square` in a FEN, or undefined. */
function pieceAt(fen: string, square: string): string | undefined {
  const rows = fen.split(' ')[0].split('/');
  const file = square.charCodeAt(0) - 97;
  const row = rows[8 - Number(square[1])];
  let col = 0;
  for (const ch of row) {
    if (/\d/.test(ch)) col += Number(ch);
    else if (col++ === file) return ch;
  }
  return undefined;
}

/** The piece type (lowercase) that makes the solver's first move. */
const firstPiece = (r: Row) => pieceAt(r.fen, r.moves[1].slice(0, 2))?.toLowerCase();

/**
 * Bapu's analysis of each solver move (moves[1], [3], ...). Packs only keep puzzles where this
 * finds the level's idea, so the templates can always explain them.
 */
const uciMove = (uci: string) => ({
  from: uci.slice(0, 2) as Square,
  to: uci.slice(2, 4) as Square,
  promotion: uci[4] as PieceSymbol | undefined,
});

const factsCache = new WeakMap<Row, MoveFacts[]>();
function solverFacts(r: Row): MoveFacts[] {
  let out = factsCache.get(r);
  if (out) return out;
  out = [];
  const chess = new Chess(r.fen);
  r.moves.forEach((uci, i) => {
    const before = chess.fen();
    const move = uciMove(uci);
    if (i % 2 === 1) out!.push(moveFacts(before, move));
    chess.move(move);
  });
  factsCache.set(r, out);
  return out;
}
/** Material the solver wins over the line (Lichess lines can stop before a recapture, so it's a lower bar, not a score). */
function gain(r: Row): number {
  const chess = new Chess(r.fen);
  const solver = chess.turn() === 'w' ? 'b' : 'w';
  const opp = solver === 'w' ? 'b' : 'w';
  const balance = () => material(chess.fen(), solver) - material(chess.fen(), opp);
  chess.move(uciMove(r.moves[0]));
  const start = balance();
  for (const m of r.moves.slice(1)) chess.move(uciMove(m));
  return balance() - start;
}
/** The idea has to pay off: mate, or at least two points of material. */
const wins = (r: Row) => last(r).mate || gain(r) >= 2;

const insightCache = new WeakMap<Row, LineInsights>();
function insights(r: Row): LineInsights {
  let out = insightCache.get(r);
  if (!out) insightCache.set(r, (out = lineInsights(r.fen, r.moves)));
  return out;
}

const first = (r: Row) => solverFacts(r)[0];
const last = (r: Row) => solverFacts(r).at(-1)!;

/** The last solver move captures one of the pieces the first move forked. */
const forkWins = (r: Row) => first(r).forkTargets.some((t) => t.square === last(r).to);

/** Per-level filters, from docs/curriculum-mvp.md. */
const PACKS: Record<string, PackSpec> = {
  // A free piece (not a pawn), taken on the first move.
  L02: {
    anyTheme: ['hangingPiece'],
    rating: [400, 900],
    noThemes: ['mate'],
    where: (r) => first(r).capturedFree && PIECE_VALUE[first(r).captured!] >= 3 && wins(r),
  },
  L04: {
    anyTheme: ['castling', 'enPassant', 'promotion'],
    // Castling and en passant puzzles are rare, so look wider than the curriculum's 400–1000.
    rating: [400, 1400],
    minPlays: 100,
    uniqueMate: true,
    where: (r) => solverFacts(r).some((f) => f.special),
    groupBy: (r) => r.themes.find((t) => ['castling', 'enPassant', 'promotion'].includes(t))!,
  },
  L05: { anyTheme: ['mateIn1'], rating: [400, 1000] },
  L06: { anyTheme: ['mateIn1'], allThemes: ['backRankMate'], rating: [500, 1100], where: (r) => last(r).backRank },
  // Forks that win the forked piece, with no mate in the line (that's a different lesson).
  L08: {
    anyTheme: ['fork'],
    noThemes: ['mate'],
    rating: [500, 1100],
    where: (r) => firstPiece(r) === 'n' && isFork(first(r)) && !first(r).hanging && forkWins(r) && wins(r),
  },
  L09: {
    anyTheme: ['fork'],
    noThemes: ['mate'],
    rating: [600, 1200],
    where: (r) => {
      const f = first(r);
      return ['q', 'p'].includes(f.piece) && !f.promotion && isFork(f) && (f.piece === 'p' || !f.hanging) && forkWins(r) && wins(r);
    },
    groupBy: (r) => firstPiece(r)!,
  },
  L10: {
    anyTheme: ['pin'],
    noThemes: ['mate'],
    rating: [600, 1200],
    // Pin it, then win it: the first move makes the pin.
    where: (r) => {
      const line = keyLine(first(r));
      return line?.kind === 'pin' && line.by.square === first(r).to && !isFork(first(r)) && wins(r);
    },
  },
  L11: {
    anyTheme: ['skewer'],
    noThemes: ['mate'],
    rating: [700, 1200],
    where: (r) => keyLine(first(r))?.kind === 'skewer' && wins(r),
  },
  L12: {
    anyTheme: ['discoveredAttack', 'doubleCheck'],
    rating: [700, 1300],
    where: (r) => (first(r).doubleCheck || first(r).discovered.length > 0) && wins(r),
    groupBy: (r) => (first(r).doubleCheck ? 'double' : 'discovered'),
  },
  L14: {
    anyTheme: ['capturingDefender'],
    noThemes: ['mate'],
    rating: [800, 1300],
    // The prize must be a real piece, not a pawn.
    where: (r) => {
      const i = insights(r);
      const prize = i.removedDefender?.target.type ?? (i.deflected ? last(r).captured : undefined);
      return Boolean(prize && prize !== 'p') && wins(r);
    },
  },
  L15: {
    anyTheme: ['deflection', 'attraction'],
    rating: [900, 1400],
    where: (r) => Boolean(insights(r).deflected || insights(r).attracted) && wins(r),
    groupBy: (r) => (insights(r).attracted ? 'attraction' : 'deflection'),
  },
  L16: { anyTheme: ['trappedPiece'], noThemes: ['mate'], rating: [800, 1400], where: (r) => Boolean(insights(r).trapped) && wins(r) },
  L17: {
    anyTheme: ['mateIn2'],
    rating: [800, 1400],
    where: (r) => last(r).mate,
    groupBy: (r) => (insights(r).smothered ? 'smothered' : 'other'),
  },
  L19: { anyTheme: ['pawnEndgame'], noThemes: ['mate'], rating: [700, 1300], where: (r) => wins(r) },
  // The boss's "defend" puzzles: the only move that holds. Holding is enough, so the bar is "not losing".
  L20: { anyTheme: ['defensiveMove'], noThemes: ['mate'], rating: [700, 1400], minEval: -50 },
};

/**
 * The Lichess file is written by pzstd: many zstd frames, each preceded by a skippable frame that holds
 * the next frame's compressed size. Node's zstd stream stops at the first skippable frame, so decode
 * frame by frame and stitch the output together.
 */
async function* decompressFrames(path: string): AsyncGenerator<Buffer> {
  const fd = openSync(path, 'r');
  const size = fstatSync(fd).size;
  const head = Buffer.alloc(12);
  try {
    for (let pos = 0; pos < size; ) {
      readSync(fd, head, 0, 12, pos);
      const skippable = (head.readUInt32LE(0) & 0xfffffff0) === 0x184d2a50;
      let end = size;
      if (skippable) {
        const len = head.readUInt32LE(4);
        const frameSize = len === 4 ? head.readUInt32LE(8) : 0;
        pos += 8 + len;
        if (!frameSize) continue;
        end = pos + frameSize;
      }
      yield* createReadStream(path, { start: pos, end: end - 1 }).pipe(createZstdDecompress());
      pos = end;
    }
  } finally {
    closeSync(fd);
  }
}

function parse(line: string): Row | undefined {
  // PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
  const c = line.split(',');
  if (c.length < 8 || c[0] === 'PuzzleId') return undefined;
  if (Number(c[4]) > MAX_DEVIATION || Number(c[5]) <= MIN_POPULARITY || Number(c[6]) <= 100) return undefined;
  return {
    id: c[0],
    fen: c[1],
    moves: c[2].split(' '),
    rating: Number(c[3]),
    popularity: Number(c[5]),
    plays: Number(c[6]),
    themes: c[7].split(' '),
  };
}

function matches(spec: PackSpec, r: Row): boolean {
  const [lo, hi] = spec.rating;
  if (r.plays <= (spec.minPlays ?? MIN_PLAYS)) return false;
  if (r.rating < lo || r.rating > hi) return false;
  if (r.moves.length > (spec.maxMoves ?? 4)) return false;
  // The board always promotes to a queen, so skip puzzles that need an underpromotion.
  if (r.moves.some((m, i) => i % 2 === 1 && m.length === 5 && m[4] !== 'q')) return false;
  if (!spec.anyTheme.some((t) => r.themes.includes(t))) return false;
  if (spec.allThemes && !spec.allThemes.every((t) => r.themes.includes(t))) return false;
  if (spec.noThemes?.some((t) => r.themes.some((x) => x.startsWith(t)))) return false;
  return spec.where ? spec.where(r) : true;
}

/** Best-loved first: popularity, then how often it's been played. */
const score = (r: Row) => r.popularity * 1e7 + Math.min(r.plays, 9_999_999);

/** Keeps at most `keep` best candidates per bucket, so memory stays small. */
class Candidates {
  private buckets = new Map<string, Row[]>();
  constructor(private keep: number) {}
  add(key: string, r: Row) {
    const b = this.buckets.get(key) ?? [];
    b.push(r);
    if (b.length > this.keep * 2) {
      b.sort((x, y) => score(y) - score(x));
      b.length = this.keep;
    }
    this.buckets.set(key, b);
  }
  /** All candidates, round-robin across buckets (best first in each), so any prefix is balanced. */
  ordered(): Row[] {
    const lists = [...this.buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, b]) => b.sort((x, y) => score(y) - score(x)));
    const out: Row[] = [];
    for (let i = 0; lists.some((l) => i < l.length); i++) {
      for (const l of lists) if (i < l.length) out.push(l[i]);
    }
    return out;
  }
}

async function main() {
  if (!existsSync(RAW)) {
    console.error(`Missing ${RAW}\nDownload https://database.lichess.org/lichess_db_puzzle.csv.zst there first.`);
    process.exit(1);
  }
  const args = process.argv.slice(2);
  const useEngine = !args.includes('--no-engine');
  const wanted = args.filter((a) => !a.startsWith('--'));
  const levels = Object.keys(PACKS).filter((id) => wanted.length === 0 || wanted.includes(id));
  const found = Object.fromEntries(levels.map((id) => [id, new Candidates(PACK_SIZE)]));

  const lines = createInterface({ input: Readable.from(decompressFrames(RAW)), crlfDelay: Infinity });
  let n = 0;
  for await (const line of lines) {
    if (++n % 1_000_000 === 0) console.log(`  ${n / 1_000_000}M rows…`);
    const r = parse(line);
    if (!r) continue;
    for (const id of levels) {
      const spec = PACKS[id];
      if (!matches(spec, r)) continue;
      const band = Math.floor(r.rating / BUCKET) * BUCKET;
      found[id].add(`${spec.groupBy?.(r) ?? ''}:${String(band).padStart(4, '0')}`, r);
    }
  }

  // Stockfish pass: Lichess already engine-checks its puzzles, but we also want the solution to be
  // the only good move, the opponent's replies to be real defences, and the win to survive.
  const engine = useEngine ? new UciEngine() : undefined;
  await engine?.init();

  mkdirSync(OUT, { recursive: true });
  for (const id of levels) {
    const puzzles: PuzzleDef[] = [];
    let rejected = 0;
    for (const r of found[id].ordered()) {
      if (puzzles.length >= PACK_SIZE) break;
      const p: PuzzleDef = { id: r.id, source: `lichess:${r.id}`, fen: r.fen, moves: r.moves, rating: r.rating, themes: r.themes };
      const spec = PACKS[id];
      const problems = engine
        ? await checkPuzzle(engine, p, { depth: 14, uniqueMate: spec.uniqueMate, winning: spec.minEval ?? 200 })
        : [];
      if (problems.length) {
        rejected++;
        continue;
      }
      puzzles.push(p);
    }
    puzzles.sort((a, b) => a.rating! - b.rating!);
    const pack = {
      level: id,
      source: 'Lichess puzzle database (CC0), https://database.lichess.org/#puzzles',
      puzzles,
    };
    writeFileSync(join(OUT, `${id}.json`), JSON.stringify(pack, null, 1) + '\n');
    const [lo, hi] = [puzzles[0]?.rating, puzzles.at(-1)?.rating];
    console.log(`${id}: ${puzzles.length} puzzles, rating ${lo}–${hi}` + (engine ? `, ${rejected} rejected by Stockfish` : ''));
  }
  engine?.quit();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
