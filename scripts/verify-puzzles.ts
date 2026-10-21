// Checks puzzles against Stockfish (see scripts/puzzle-check.ts for the rules):
//   npm run verify-puzzles                         every level file
//   npm run verify-puzzles -- content/levels/L08.json
//   npm run verify-puzzles -- content/puzzles/L04.json
import { readFileSync, readdirSync } from 'node:fs';
import { checkPuzzle } from './puzzle-check';
import { UciEngine } from './uci-engine';
import type { LevelDef, PuzzleDef } from '../src/levels/types';

/** Levels whose lesson is the move itself, so a different mate doesn't count. */
const UNIQUE_MATE = new Set(['L04']);

function puzzlesOf(file: string): { title: string; puzzles: PuzzleDef[] } {
  const json = JSON.parse(readFileSync(file, 'utf8'));
  if (json.puzzles) return { title: `pack ${json.level}`, puzzles: json.puzzles };
  const level = json as LevelDef;
  // Only Lichess-format puzzles: not drills, quizzes, choices or endgames, and not demos that
  // start with the hero's own move (those set an orientation).
  const steps = [level.demo, ...level.guided, ...level.practice].filter((p) => (p.kind ?? 'puzzle') === 'puzzle' && !p.orientation);
  return { title: level.title, puzzles: steps };
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
    const { title, puzzles } = puzzlesOf(file);
    const uniqueMate = [...UNIQUE_MATE].some((id) => file.includes(id));
    console.log(`\n${file}: ${title}`);
    for (const p of puzzles) {
      console.log(`  ${p.id}`);
      const problems = await checkPuzzle(engine, p, { uniqueMate, log: (l) => console.log(`    ${l}`) });
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
