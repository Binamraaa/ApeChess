// Picks start positions for Level 18 (mate with queen or rook against a lone king). Positions are
// generated with a seeded random generator, then measured with Stockfish so each one can be mated
// comfortably inside the move limit. Prints JSON steps and the demo line to paste into L18.json.
//   npx tsx scripts/build-endgames.ts
import { Chess, type Square } from 'chess.js';
import { UciEngine } from './uci-engine';

function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

async function pick(engine: UciEngine, piece: 'q' | 'r', want: number, [lo, hi]: [number, number], seed: number) {
  const rand = rng(seed);
  const sq = () => (String.fromCharCode(97 + Math.floor(rand() * 8)) + (1 + Math.floor(rand() * 8))) as Square;
  const out: { fen: string; mateIn: number }[] = [];
  while (out.length < want) {
    const c = new Chess();
    c.clear();
    c.put({ type: 'k', color: 'w' }, sq());
    c.put({ type: 'k', color: 'b' }, sq());
    c.put({ type: piece, color: 'w' }, sq());
    let pos: Chess;
    try {
      pos = new Chess(c.fen());
    } catch {
      continue;
    }
    if (pos.inCheck() || pos.isGameOver()) continue;
    // The lone king shouldn't start in check (illegal with White to move), on the edge (too easy),
    // or next to the white piece (it would just take it).
    const bk = pos.board().flat().find((p) => p?.type === 'k' && p.color === 'b')!.square;
    if (/[18ah]/.test(bk)) continue;
    const black = new Chess(pos.fen().replace(' w ', ' b '));
    if (black.inCheck() || black.moves({ verbose: true }).some((m) => m.captured)) continue;
    const [line] = await engine.analyse(pos.fen(), 18, 1);
    if (line?.mate && line.mate >= lo && line.mate <= hi) out.push({ fen: pos.fen(), mateIn: line.mate });
  }
  return out;
}

async function main() {
  const engine = new UciEngine();
  await engine.init();
  const queens = await pick(engine, 'q', 4, [6, 8], 18);
  const rooks = await pick(engine, 'r', 3, [11, 15], 81);
  console.log(JSON.stringify({ queens, rooks }, null, 1));

  // Demo: the quickest of the queen positions, played out by the engine for both sides.
  const shortest = (await pick(engine, 'q', 1, [4, 5], 7))[0];
  console.log('demo', shortest.fen, 'mate in', shortest.mateIn);
  const demo = new Chess(shortest.fen);
  const line: string[] = [];
  while (!demo.isGameOver() && line.length < 30) {
    const [best] = await engine.analyse(demo.fen(), 18, 1);
    const m = demo.move({ from: best.pv[0].slice(0, 2), to: best.pv[0].slice(2, 4), promotion: best.pv[0][4] });
    line.push(`${m.from}${m.to} ${m.san}`);
  }
  console.log(line.join('\n'));
  engine.quit();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
