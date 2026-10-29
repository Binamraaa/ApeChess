// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Binamra Bhusal

import { useMemo, useState } from 'react';
import { Chess, type Move } from 'chess.js';
import type { DrawShape } from 'chessground/draw';
import type { Key } from 'chessground/types';
import { Board } from '../../board/Board';
import { BapuBubble } from '../../bapu/BapuBubble';
import { moveFacts } from '../../bapu/explain';
import { drillFen, drillMove, parseDrill } from '../../levels/drill';
import { parseUci } from '../../levels/puzzle';
import type { PuzzleDef } from '../../levels/types';
import { starShapes, tacticArrows } from './shapes';

interface Frame {
  fen: string;
  move?: Pick<Move, 'from' | 'to'>;
  shapes: DrawShape[];
  check?: boolean;
  turn?: 'white' | 'black';
}

/** The side the demo is about: given explicitly, else the side not to move (the opponent moves first). */
function heroOf(p: PuzzleDef): 'white' | 'black' {
  if (p.orientation) return p.orientation;
  if (p.kind === 'drill') return 'white';
  return new Chess(p.fen).turn() === 'w' ? 'black' : 'white';
}

/** Precomputes every position of the demo line, so stepping is just an index. */
function framesOf(p: PuzzleDef): Frame[] {
  if (p.kind === 'drill') {
    // A single piece walking onto stars (Level 1); no chess rules needed.
    let b = parseDrill(p.fen);
    let left = p.targets ?? [];
    const frames: Frame[] = [{ fen: drillFen(b), shapes: starShapes(left) }];
    for (const uci of p.moves) {
      const { from, to } = parseUci(uci);
      b = drillMove(b, to);
      left = left.filter((t) => t !== to);
      frames.push({ fen: drillFen(b), move: { from, to } as Frame['move'], shapes: starShapes(left) });
    }
    return frames;
  }
  const chess = new Chess(p.fen);
  const hero = heroOf(p)[0];
  const status = (): Pick<Frame, 'check' | 'turn'> => ({ check: chess.inCheck(), turn: chess.turn() === 'w' ? 'white' : 'black' });
  const frames: Frame[] = [{ fen: p.fen, shapes: [], ...status() }];
  p.moves.forEach((uci, i) => {
    const before = chess.fen();
    const move = chess.move(parseUci(uci));
    // Arrows on the hero's moves show the idea; none on the last move, where it's already cashed in.
    const idea = move.color === hero && i < p.moves.length - 1;
    frames.push({ fen: chess.fen(), move, shapes: idea ? tacticArrows(moveFacts(before, move)) : [], ...status() });
  });
  return frames;
}

interface Props {
  puzzle: PuzzleDef;
  onContinue: () => void;
}

/** Bapu walks through one position move by move. The learner taps to advance. */
export function DemoPlayer({ puzzle, onContinue }: Props) {
  const frames = useMemo(() => framesOf(puzzle), [puzzle]);
  const [i, setI] = useState(0);
  const frame = frames[i];
  const last = i === frames.length - 1;
  const hero = heroOf(puzzle);
  const opponent = hero === 'white' ? 'Black' : 'White';
  // A narration with one extra line opens with its own intro instead of the default one.
  const narration = puzzle.narration ?? [];
  const intro = narration.length > puzzle.moves.length;
  const text =
    i === 0
      ? intro
        ? narration[0]
        : `Watch closely. ${opponent} is about to make a tiny mistake.`
      : narration[intro ? i : i - 1];

  return (
    <div className="play">
      <div className="play-prompt">
        <span className="play-mode play-mode-demo">Watch Bapu</span>
        <span className="play-steps">
          Move {i} of {frames.length - 1}
        </span>
      </div>

      <Board
        fen={frame.fen}
        orientation={hero}
        turnColor={frame.turn ?? 'white'}
        lastMove={frame.move ? [frame.move.from as Key, frame.move.to as Key] : undefined}
        check={frame.check}
        shapes={frame.shapes}
      />

      <div className="play-talk">
        <BapuBubble key={i} label={i === 0 ? 'Demo' : null}>
          {text}
        </BapuBubble>
      </div>

      <div className="play-actions">
        {i > 0 && (
          <button className="btn btn-ghost" onClick={() => setI(i - 1)} aria-label="Previous move">
            Back
          </button>
        )}
        {last ? (
          <button className="btn btn-teal btn-block" onClick={onContinue}>
            My turn!
          </button>
        ) : (
          <button className="btn btn-block" onClick={() => setI(i + 1)}>
            {i === 0 ? 'Play the move' : 'Next move'}
          </button>
        )}
      </div>
    </div>
  );
}
