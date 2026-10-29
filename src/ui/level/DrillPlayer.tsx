// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Binamra Bhusal

import { useMemo, useRef, useState } from 'react';
import type { DrawShape } from 'chessground/draw';
import type { Key } from 'chessground/types';
import { Board } from '../../board/Board';
import { BapuBubble, type Tone } from '../../bapu/BapuBubble';
import { drillFen, drillMove, drillMoves, parseDrill, solveDrill, type DrillPiece } from '../../levels/drill';
import type { PuzzleOutcome } from '../../levels/scoring';
import type { PuzzleDef } from '../../levels/types';
import { Bulb } from '../icons';
import { starShapes } from './shapes';

const NAME: Record<DrillPiece, string> = { K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight', P: 'pawn' };

/** How each piece walks, said the way Bapu would. */
export const WALK: Record<DrillPiece, string> = {
  R: 'The rook glides in straight lines: up, down, left or right, as far as it likes.',
  B: 'The bishop glides diagonally, as far as it likes, and stays on its own colour forever.',
  Q: 'The queen is a rook and a bishop in one: any straight line or diagonal, as far as she likes.',
  N: 'The knight jumps in an L: two squares one way, then one square to the side. It’s the only piece that can hop over others.',
  K: 'The king walks one square in any direction. Slow, but precious.',
  P: 'The pawn walks straight forward, one square (or two on its first move), but captures one square diagonally forward.',
};

interface Props {
  puzzle: PuzzleDef;
  mode: 'guided' | 'practice';
  onSolved: (outcome: PuzzleOutcome) => void;
  onContinue: () => void;
}

/** Level 1: walk one piece onto every star, ideally in the fewest moves. */
export function DrillPlayer({ puzzle, mode, onSolved, onContinue }: Props) {
  const start = useMemo(() => parseDrill(puzzle.fen), [puzzle.fen]);
  const targets = puzzle.targets ?? [];
  const par = puzzle.par ?? solveDrill(start, targets).moves;
  const [board, setBoard] = useState(start);
  const [left, setLeft] = useState(targets);
  const [moves, setMoves] = useState(0);
  const [last, setLast] = useState<[Key, Key]>();
  const [hint, setHint] = useState<DrawShape[]>([]);
  const [version, setVersion] = useState(0);
  const [msg, setMsg] = useState<{ id: number; tone: Tone; text: string; label?: string | null }>({
    id: 0,
    tone: 'neutral',
    text: `${WALK[start.piece]} Collect every star${par ? ` in ${par} move${par > 1 ? 's' : ''}` : ''}!`,
    label: null,
  });
  const hinted = useRef(false);
  const done = left.length === 0;

  const say = (tone: Tone, text: string, label?: string | null) => setMsg((m) => ({ id: m.id + 1, tone, text, label }));

  function onMove(from: Key, to: Key) {
    if (done || !drillMoves(board).includes(to)) return setVersion((v) => v + 1);
    const next = drillMove(board, to);
    const remaining = left.filter((t) => t !== to);
    const count = moves + 1;
    setBoard(next);
    setLeft(remaining);
    setMoves(count);
    setLast([from, to]);
    setHint([]);

    if (remaining.length === 0) {
      const firstTry = count <= par;
      say(
        'good',
        firstTry
          ? `Every star in ${count} move${count > 1 ? 's' : ''}. That’s the shortest route there is!`
          : `Got them all in ${count} moves! It can be done in ${par}. Can you spot the shorter route?`,
        firstTry ? 'Perfect route!' : 'All stars!',
      );
      onSolved({ puzzleId: puzzle.id, firstTry, hintUsed: hinted.current, revealed: false });
      return;
    }
    if (next.piece !== board.piece) say('good', 'Your pawn reached the last row and became a queen! Now she moves like one.', 'Promotion!');
    else if (left.includes(to)) say('good', `Star! ${remaining.length} to go.`, null);
    else if (count >= par) say('hint', `That’s ${count} moves already, and ${remaining.length} star${remaining.length > 1 ? 's' : ''} left. Keep going!`, null);
    else say('neutral', `${remaining.length} star${remaining.length > 1 ? 's' : ''} to go.`, null);
  }

  function showHint() {
    hinted.current = true;
    const { route } = solveDrill(board, left);
    setHint([{ orig: board.square as Key, dest: route[0] as Key, brush: 'yellow' }]);
    say('hint', `${puzzle.hint ?? ''} Try ${NAME[board.piece]} to ${route[0]}.`.trim());
  }

  const dests = useMemo(
    () => (done ? undefined : new Map<Key, Key[]>([[board.square as Key, drillMoves(board) as Key[]]])),
    [board, done],
  );

  return (
    <div className="play">
      <div className="play-prompt">
        <span>
          Moves: <strong>{moves}</strong> · Best: <strong>{par}</strong>
        </span>
        <span className={`play-mode play-mode-${mode}`}>{mode === 'guided' ? 'Guided' : 'Practice'}</span>
      </div>

      <Board
        fen={drillFen(board)}
        version={version}
        orientation="white"
        turnColor="white"
        lastMove={last}
        dests={dests}
        shapes={[...starShapes(left), ...hint]}
        onMove={onMove}
      />

      <div className="play-talk">
        <BapuBubble key={msg.id} tone={msg.tone} label={msg.label}>
          {msg.text}
        </BapuBubble>
      </div>

      <div className="play-actions">
        {done ? (
          <button className="btn btn-good btn-block" onClick={onContinue}>
            Continue
          </button>
        ) : (
          <>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setBoard(start);
                setLeft(targets);
                setMoves(0);
                setLast(undefined);
                setHint([]);
                say('neutral', 'Fresh start. Plan the whole route before the first move.', null);
              }}
            >
              Restart
            </button>
            {mode === 'guided' && (
              <button className="btn btn-ghost" onClick={showHint}>
                <Bulb size={18} /> Hint
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
