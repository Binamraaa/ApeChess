// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Binamra Bhusal

import { useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import type { DrawShape } from 'chessground/draw';
import type { Key } from 'chessground/types';
import { Board } from '../../board/Board';
import { BapuBubble, type Tone } from '../../bapu/BapuBubble';
import { moveInWords } from '../../bapu/explain';
import { THEMES } from '../../bapu/themes';
import { parseUci } from '../../levels/puzzle';
import type { PuzzleOutcome } from '../../levels/scoring';
import type { PuzzleDef } from '../../levels/types';
import { Bulb } from '../icons';

interface Props {
  puzzle: PuzzleDef;
  mode: 'guided' | 'practice';
  onSolved: (outcome: PuzzleOutcome) => void;
  onContinue: () => void;
}

const LETTERS = ['A', 'B', 'C', 'D'];
const BRUSHES = ['blue', 'green', 'yellow', 'red'];

/** Level 7: three candidate moves on the board; pick the best and hear why the others are worse. */
export function ChoicePlayer({ puzzle, mode, onSolved, onContinue }: Props) {
  const chess = useMemo(() => new Chess(puzzle.fen), [puzzle.fen]);
  const side = chess.turn() === 'w' ? 'white' : 'black';
  const options = useMemo(
    () => (puzzle.options ?? []).map((o) => ({ ...o, move: new Chess(puzzle.fen).move(parseUci(o.uci)) })),
    [puzzle],
  );
  const [tried, setTried] = useState<number[]>([]);
  const [done, setDone] = useState(false);
  const [hinted, setHinted] = useState(false);
  const [msg, setMsg] = useState<{ id: number; tone: Tone; text: string; label?: string | null }>({
    id: 0,
    tone: 'neutral',
    text: `You play ${side === 'white' ? 'White' : 'Black'}. Three ideas are on the board. Which one would Bapu play?`,
    label: null,
  });
  const say = (tone: Tone, text: string, label?: string | null) => setMsg((m) => ({ id: m.id + 1, tone, text, label }));

  const best = options.findIndex((o) => o.best);
  const after = useMemo(() => {
    const c = new Chess(puzzle.fen);
    c.move(options[best].move.san);
    return c.fen();
  }, [puzzle.fen, options, best]);

  function pick(i: number) {
    if (done || tried.includes(i)) return;
    const o = options[i];
    const next = [...tried, i];
    setTried(next);
    if (o.best) {
      setDone(true);
      say('good', o.why, next.length === 1 ? 'Bapu approves!' : 'That’s the one');
      onSolved({ puzzleId: puzzle.id, firstTry: next.length === 1, hintUsed: hinted, revealed: false });
    } else {
      say('bad', `${o.why} Try another.`, 'Not the best');
    }
  }

  const shapes: DrawShape[] = done
    ? []
    : options
        .map((o, i) => ({ o, i }))
        .filter(({ i }) => !tried.includes(i))
        .map(({ o, i }) => ({
          orig: o.move.from as Key,
          dest: o.move.to as Key,
          brush: BRUSHES[i],
          label: { text: LETTERS[i] },
        }));

  return (
    <div className="play">
      <div className="play-prompt">
        <span className={`side-dot side-${side}`} aria-hidden="true" />
        <span>
          You play <strong>{side === 'white' ? 'White' : 'Black'}</strong>
        </span>
        <span className={`play-mode play-mode-${mode}`}>{mode === 'guided' ? 'Guided' : 'Practice'}</span>
      </div>

      <Board
        fen={done ? after : puzzle.fen}
        orientation={side}
        turnColor={side}
        lastMove={done ? [options[best].move.from as Key, options[best].move.to as Key] : undefined}
        shapes={shapes}
      />

      <div className="play-talk">
        <BapuBubble key={msg.id} tone={msg.tone} label={msg.label}>
          {msg.text}
        </BapuBubble>
      </div>

      {done ? (
        <div className="play-actions">
          <button className="btn btn-good btn-block" onClick={onContinue}>
            Continue
          </button>
        </div>
      ) : (
        <>
          <div className="choice-list">
            {options.map((o, i) => (
              <button key={o.uci} className={`btn choice-btn choice-${BRUSHES[i]}`} disabled={tried.includes(i)} onClick={() => pick(i)}>
                <span className="choice-letter">{LETTERS[i]}</span> {moveInWords(o.move)}
              </button>
            ))}
          </div>
          {mode === 'guided' && (
            <div className="play-actions">
              <button
                className="btn btn-ghost"
                disabled={hinted}
                onClick={() => {
                  setHinted(true);
                  say('hint', puzzle.hint ?? THEMES.choice.hint, 'Hint');
                }}
              >
                <Bulb size={18} /> Hint
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
