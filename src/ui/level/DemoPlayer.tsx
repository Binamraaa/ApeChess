import { useMemo, useState } from 'react';
import { Chess, type Move } from 'chess.js';
import type { DrawShape } from 'chessground/draw';
import type { Key } from 'chessground/types';
import { Board } from '../../board/Board';
import { BapuBubble } from '../../bapu/BapuBubble';
import { moveFacts } from '../../bapu/explain';
import { parseUci } from '../../levels/puzzle';
import type { PuzzleDef } from '../../levels/types';
import { tacticArrows } from './shapes';

interface Frame {
  fen: string;
  move?: Move;
  shapes: DrawShape[];
}

/** Precomputes every position of the demo line, so stepping is just an index. */
function framesOf(p: PuzzleDef): Frame[] {
  const chess = new Chess(p.fen);
  const frames: Frame[] = [{ fen: p.fen, shapes: [] }];
  p.moves.forEach((uci, i) => {
    const before = chess.fen();
    const move = chess.move(parseUci(uci));
    // Arrows on the hero's moves show the idea; none on the last move, where it's already cashed in.
    const idea = i % 2 === 1 && i < p.moves.length - 1;
    frames.push({ fen: chess.fen(), move, shapes: idea ? tacticArrows(moveFacts(before, move)) : [] });
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
  // The opponent moves first, so the "hero" of the demo is the side not to move.
  const hero = new Chess(puzzle.fen).turn() === 'w' ? 'black' : 'white';
  const opponent = hero === 'white' ? 'Black' : 'White';
  const text = i === 0 ? `Watch closely. ${opponent} is about to make a tiny mistake.` : puzzle.narration?.[i - 1];

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
        turnColor={new Chess(frame.fen).turn() === 'w' ? 'white' : 'black'}
        lastMove={frame.move ? [frame.move.from as Key, frame.move.to as Key] : undefined}
        check={new Chess(frame.fen).inCheck()}
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
