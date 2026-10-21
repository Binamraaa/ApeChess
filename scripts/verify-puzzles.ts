// Checks hand-authored puzzles against Stockfish:
//   - every solver move is the engine's best move, clearly better than the alternatives
//   - the solver is clearly winning at the end of the line
//   - prints the engine's preferred opponent replies, to help when authoring
// Usage: npm run verify-puzzles [-- content/levels/L08.json]
import { readFileSync, readdirSync } from 'node:fs';
import { Chess } from 'chess.js';
import { UciEngine } from './uci-engine';
import type { LevelDef, PuzzleDef } from '../src/levels/types';

const DEPTH = 16;
/** The solution must beat the second-best move by this much (centipawns)... */
const MIN_GAP = 100;
/** ...unless the second-best move doesn't also win (less than this for the solver). */
const WINNING = 200;

function moveOf(chess: Chess, uci: string) {
  return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
}

function fmt(cp: number) {
  if (Math.abs(cp) > 90000) return (cp > 0 ? '#' : '-#') + (100000 - Math.abs(cp));
  return (cp > 0 ? '+' : '') + (cp / 100).toFixed(1);
}

async function verify(engine: UciEngine, p: PuzzleDef): Promise<string[]> {
  const problems: string[] = [];
  const chess = new Chess(p.fen);
  moveOf(chess, p.moves[0]);

  for (let i = 1; i < p.moves.length; i += 2) {
    const fen = chess.fen();
    const lines = await engine.analyse(fen, DEPTH, 3);
    const [best, second] = lines;
    const want = p.moves[i];
    const top = best.pv[0];
    const note = `step ${(i + 1) / 2}: want ${want}, engine ${top} ${fmt(best.cp)}` +
      (second ? `, 2nd ${second.pv[0]} ${fmt(second.cp)}` : '');
    console.log('   ', note);

    const probe = new Chess(fen);
    moveOf(probe, top);
    const topIsMate = probe.isCheckmate();
    if (top !== want && !topIsMate) {
      problems.push(`${note}: solution is not the engine's best move`);
    } else if (second && best.cp - second.cp < MIN_GAP && second.cp >= WINNING) {
      problems.push(`${note}: second-best move also wins, solution isn't unique`);
    }

    moveOf(chess, want);
    if (i + 1 < p.moves.length) {
      const reply = (await engine.analyse(chess.fen(), DEPTH, 1))[0];
      if (reply && reply.pv[0] !== p.moves[i + 1]) {
        console.log(`    note: engine prefers opponent reply ${reply.pv[0]} over ${p.moves[i + 1]}`);
      }
      moveOf(chess, p.moves[i + 1]);
    }
  }

  // Final position: the solver should be clearly ahead.
  const final = (await engine.analyse(chess.fen(), DEPTH, 1))[0];
  if (final) {
    const solverCp = -final.cp; // side to move is the opponent
    console.log(`    final eval for solver: ${fmt(solverCp)}`);
    if (solverCp < WINNING && !chess.isCheckmate()) problems.push(`final eval ${fmt(solverCp)} is not clearly winning`);
  }
  return problems;
}

async function main() {
  const files = process.argv.slice(2);
  const targets = files.length
    ? files
    : readdirSync('content/levels').filter((f) => f.endsWith('.json')).map((f) => `content/levels/${f}`);

  const engine = new UciEngine();
  await engine.init();
  let failures = 0;

  for (const file of targets) {
    const level = JSON.parse(readFileSync(file, 'utf8')) as LevelDef;
    console.log(`\n${file}: ${level.title}`);
    for (const p of [level.demo, ...level.guided, ...level.practice]) {
      console.log(`  ${p.id}`);
      const problems = await verify(engine, p);
      for (const msg of problems) console.log(`    ✗ ${msg}`);
      failures += problems.length;
    }
  }

  engine.quit();
  console.log(failures ? `\n${failures} problem(s) found` : '\nAll puzzles verified');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
