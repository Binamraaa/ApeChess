// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Binamra Bhusal

// Writes content/levels/L07.json (Opening Principles) from move sequences, and checks with Stockfish
// that the move Bapu calls best really is clearly better than the other two options.
//   npx tsx scripts/build-openings.ts
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Chess } from 'chess.js';
import type { ChoiceOption, LevelDef, PuzzleDef } from '../src/levels/types';
import { fmt } from './puzzle-check';
import { UciEngine } from './uci-engine';

/** The best option must beat the others by at least this much (centipawns). */
const MIN_GAP = 40;

interface Item {
  id: string;
  /** Moves from the starting position, in SAN. */
  line: string[];
  hint?: string;
  /** [SAN, why]; the first is the best move. */
  best: [string, string];
  others: [string, string][];
}

const items: Item[] = [
  {
    id: 'L07-g1',
    line: [],
    hint: 'Which move does something for the centre AND helps your pieces come out?',
    best: ['e4', 'Pawn to e4 grabs a centre square and opens lines for your queen and bishop. A dream first move.'],
    others: [
      ['a3', 'Pawn to a3 does nothing for the centre and doesn’t help a single piece come out.'],
      ['h4', 'Pawn to h4 weakens the side where your king usually lives, and ignores the centre.'],
    ],
  },
  {
    id: 'L07-g2',
    line: ['e4', 'e5'],
    hint: 'Knights love the centre. Which move brings one out AND puts pressure on Black?',
    best: ['Nf3', 'Knight to f3 comes out toward the centre and attacks the pawn on e5 straight away. Development with a threat!'],
    others: [
      ['Qh5', 'Queen to h5 comes out too early. Black will chase her with knights and pawns, gaining moves while you retreat.'],
      ['f3', 'Pawn to f3 weakens your king and steals the knight’s best square.'],
    ],
  },
  {
    id: 'L07-g3',
    line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'd3', 'Nf6'],
    hint: 'Your knight and bishop are out. What’s the last step of a good opening?',
    best: ['O-O', 'Castle! Your king hides behind the pawns, and the rook moves toward the centre where it can join the game.'],
    others: [
      ['Kf1', 'King to f1 walks the king one step and loses the right to castle forever. Castling does the same job much better.'],
      ['Rg1', 'Rook to g1 gives up castling on the kingside, so your king is stuck in the middle for good.'],
    ],
  },
  {
    id: 'L07-p1',
    line: ['e4', 'e5', 'Nf3'],
    best: ['Nc6', 'Knight to c6 comes out and defends the pawn on e5. One move, two jobs.'],
    others: [
      ['f6', 'Pawn to f6 defends e5, but it opens the diagonal to your king and takes the knight’s best square.'],
      ['Qf6', 'Queen to f6 defends e5, but the queen comes out early, blocks your knight, and becomes a target.'],
    ],
  },
  {
    id: 'L07-p2',
    line: ['d4', 'd5'],
    best: ['Nf3', 'Knight to f3 heads for the centre, controls e5, and gets ready for castling.'],
    others: [
      ['Nh3', 'Knight to h3 sits on the edge, where it controls only a few squares. A knight on the rim is dim!'],
      ['g4', 'Pawn to g4 just gives a pawn away: Black’s bishop on c8 takes it for free.'],
    ],
  },
  {
    id: 'L07-p3',
    line: ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5'],
    best: ['g6', 'Pawn to g6 blocks the queen’s threat on f7 AND attacks her. Always check what your opponent threatens before you move!'],
    others: [
      ['Nf6', 'Knight to f6 attacks the queen, but it ignores the real threat: queen takes f7 is checkmate!'],
      ['a6', 'Pawn to a6 ignores the threat on f7. Queen takes f7 is checkmate. Ouch.'],
    ],
  },
  {
    id: 'L07-p4',
    line: ['d4', 'Nf6', 'c4', 'e6', 'Nc3'],
    best: ['Bb4', 'Bishop to b4 comes out with purpose: it pins the knight and fights for the e4 square.'],
    others: [
      ['h5', 'Pawn to h5 weakens your kingside and does nothing for development.'],
      ['Ng4', 'Knight to g4 moves the same piece twice in the opening, and it does nothing there.'],
    ],
  },
  {
    id: 'L07-p5',
    line: ['e4', 'c5'],
    best: ['Nf3', 'Knight to f3 develops toward the centre and prepares to break open the middle with d4.'],
    others: [
      ['Qh5', 'Queen to h5 is far too early: she’ll get chased around while Black develops.'],
      ['Ba6', 'Bishop to a6 just gives the bishop away: the b7 pawn or the knight takes it.'],
    ],
  },
  {
    id: 'L07-p6',
    line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'd3', 'Bc5', 'O-O'],
    best: ['O-O', 'Castle too! Your king gets safe and your rook joins the game. Now both sides are ready for the middlegame.'],
    others: [
      ['Ng4', 'Knight to g4 moves the same piece twice to make a one-move threat. White simply plays h3 and you’ve lost time.'],
      ['Rg8', 'Rook to g8 gives up castling on that side and leaves your king stuck in the centre.'],
    ],
  },
  {
    id: 'L07-p7',
    line: ['e4', 'd5', 'exd5', 'Qxd5', 'Nc3'],
    best: ['Qa5', 'Queen to a5 escapes to a safe square where she still eyes the board. When the queen is chased, find her a safe spot fast.'],
    others: [
      ['Qe5+', 'Queen to e5, check, just invites Be2 or Nge2 and the queen will be chased again.'],
      ['Qxg2', 'Taking the g2 pawn walks the queen into a trap: Qf3 and she’s in serious trouble.'],
    ],
  },
];

async function main() {
  const engine = new UciEngine();
  await engine.init();
  let bad = 0;
  const steps: PuzzleDef[] = [];
  for (const it of items) {
    const chess = new Chess();
    for (const san of it.line) chess.move(san);
    const fen = chess.fen();
    const options: ChoiceOption[] = [];
    const scores: string[] = [];
    let bestCp = 0;
    let othersCp = -Infinity;
    for (const [i, [san, why]] of [it.best, ...it.others].entries()) {
      const after = new Chess(fen);
      const m = after.move(san);
      const [line] = await engine.analyse(after.fen(), 16, 1);
      const cp = after.isCheckmate() ? 100000 : -(line?.cp ?? 0); // the mover's point of view
      scores.push(`${san} ${fmt(cp)}`);
      if (i === 0) bestCp = cp;
      else othersCp = Math.max(othersCp, cp);
      options.push({ uci: m.from + m.to + (m.promotion ?? ''), ...(i === 0 ? { best: true } : {}), why });
    }
    const ok = bestCp - othersCp >= MIN_GAP;
    if (!ok) bad++;
    console.log(`${ok ? ' ' : '✗'} ${it.id}: ${scores.join(', ')}`);
    // Shuffle so the best answer isn't always "A" (deterministic, by id).
    const shift = [...it.id].reduce((n, ch) => n + ch.charCodeAt(0), 0) % 3;
    const shuffled = [...options.slice(shift), ...options.slice(0, shift)];
    steps.push({ id: it.id, kind: 'choice', source: 'custom', fen, moves: [], options: shuffled, ...(it.hint ? { hint: it.hint } : {}) });
  }
  engine.quit();

  const level: LevelDef = {
    id: 'L07',
    number: 7,
    unit: 2,
    unitTitle: 'Finishing the Game',
    title: 'Opening Principles',
    theme: 'choice',
    icon: 'wN',
    concept: 'Control the centre, develop knights and bishops, castle early, and don’t bring the queen out too soon.',
    glossary: { term: 'Develop', definition: 'Bring a knight or bishop off its starting square so it can join the game.' },
    summary: 'In the opening: grab the centre, bring out knights and bishops, castle early, and keep the queen home until the pieces are out. And always ask what your opponent is threatening.',
    demo: {
      id: 'L07-demo',
      source: 'custom',
      orientation: 'white',
      fen: new Chess().fen(),
      moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'e1g1'],
      narration: [
        'The first moves of a game decide a lot. Bapu’s three rules: grab the centre, bring out knights and bishops, castle early. Watch.',
        'Pawn to e4: a centre square, and it opens lines for the queen and bishop.',
        'Black does the same. Fair enough.',
        'Knight to f3: develops toward the centre and attacks e5.',
        'Black defends with a knight of its own. Development with purpose.',
        'Bishop to c4: out, and aiming at f7, the weakest square near Black’s king.',
        'Black copies the idea. Both sides are developing nicely.',
        'Castle! The king is tucked away and the rook is ready to join. Centre, development, castling: three rules, seven moves.',
      ],
    },
    guided: steps.slice(0, 3),
    practice: steps.slice(3),
  };
  writeFileSync(join(import.meta.dirname, '..', 'content', 'levels', 'L07.json'), JSON.stringify(level, null, 2) + '\n');
  console.log(bad ? `${bad} item(s) need a clearer best move` : 'All openings checked');
  process.exit(bad ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
