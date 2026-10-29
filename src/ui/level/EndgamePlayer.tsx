// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Binamra Bhusal

import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import type { DrawShape } from 'chessground/draw';
import type { Key } from 'chessground/types';
import { Board } from '../../board/Board';
import { boardMoveToUci, legalDests } from '../../board/dests';
import { BapuBubble, type Tone } from '../../bapu/BapuBubble';
import { moveInWords } from '../../bapu/explain';
import { THEMES } from '../../bapu/themes';
import { engine } from '../../engine/stockfish';
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

const REPLY_DELAY = 450;

/**
 * Squares the lone king can still reach without walking into an attacked square: its "box".
 * Shrinking the box is the whole plan in these endings.
 */
export function boxSize(chess: Chess): number {
  const color = chess.turn();
  const enemy = color === 'w' ? 'b' : 'w';
  const king = chess.board().flat().find((p) => p?.type === 'k' && p.color === color)!.square;
  const seen = new Set<string>([king]);
  const queue = [king as string];
  while (queue.length) {
    const sq = queue.pop()!;
    for (const df of [-1, 0, 1]) {
      for (const dr of [-1, 0, 1]) {
        const f = sq.charCodeAt(0) - 97 + df;
        const r = Number(sq[1]) + dr;
        if (f < 0 || f > 7 || r < 1 || r > 8) continue;
        const next = String.fromCharCode(97 + f) + r;
        if (seen.has(next) || chess.get(next as Square)?.color === enemy) continue;
        if (chess.attackers(next as Square, enemy).length) continue;
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen.size;
}

/** Level 18: checkmate the lone king against the engine, within a move limit. */
export function EndgamePlayer({ puzzle, mode, onSolved, onContinue }: Props) {
  const [chess, setChess] = useState(() => new Chess(puzzle.fen));
  const [fen, setFen] = useState(puzzle.fen);
  const [last, setLast] = useState<[Key, Key]>();
  const [moves, setMoves] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [shapes, setShapes] = useState<DrawShape[]>([]);
  const [version, setVersion] = useState(0);
  const [msg, setMsg] = useState<{ id: number; tone: Tone; text: string; label?: string | null }>({
    id: 0,
    tone: 'neutral',
    text: `Checkmate the lone king in ${puzzle.limit} moves or fewer. Shrink its box, and bring your king to help.`,
    label: null,
  });
  const track = useRef({ mistakes: 0, hinted: false, overLimit: false });
  const say = (tone: Tone, text: string, label?: string | null) => setMsg((m) => ({ id: m.id + 1, tone, text, label }));
  const limit = puzzle.limit ?? 20;

  // Warm the engine up while the learner thinks.
  useEffect(() => {
    engine();
  }, []);

  function restart(text: string, label: string) {
    track.current.mistakes += 1;
    const fresh = new Chess(puzzle.fen);
    setChess(fresh);
    setFen(fresh.fen());
    setLast(undefined);
    setMoves(0);
    setShapes([]);
    setBusy(false);
    say('bad', text, label);
  }

  async function onMove(from: Key, to: Key) {
    if (busy || done) return;
    const uci = boardMoveToUci(chess, from, to);
    const next = new Chess(chess.fen());
    const m = next.move(parseUci(uci));
    const count = moves + 1;
    setChess(next);
    setFen(next.fen());
    setLast([m.from as Key, m.to as Key]);
    setMoves(count);
    setShapes([]);

    if (next.isCheckmate()) {
      setDone(true);
      const t = track.current;
      const inTime = count <= limit;
      say(
        'good',
        inTime
          ? `Checkmate in ${count} move${count > 1 ? 's' : ''}! The box shrank to nothing, and the king had nowhere left to go.`
          : `Checkmate! It took ${count} moves; the target was ${limit}. Next time, squeeze the box faster.`,
        inTime ? 'Brilliant!' : 'Got there!',
      );
      onSolved({ puzzleId: puzzle.id, firstTry: inTime && t.mistakes === 0, hintUsed: t.hinted, revealed: false });
      return;
    }
    if (next.isStalemate()) {
      return restart(
        'Stalemate! The king isn’t in check but has no legal move, so it’s a draw. Always leave the king at least one square until you can mate. Let’s start again.',
        'Oh no, stalemate',
      );
    }
    if (next.isInsufficientMaterial()) return restart('Your piece was taken, so there’s nothing left to mate with. Keep it protected! Let’s start again.', 'Piece lost');

    if (count === limit && !track.current.overLimit) {
      track.current.overLimit = true;
      say('hint', `That’s ${limit} moves. Finish the job anyway, and next time aim to squeeze faster.`, 'Move limit');
    } else {
      const box = boxSize(next);
      say('neutral', next.inCheck() ? `Check! The king’s box: ${box} squares.` : `The king’s box: ${box} squares. Shrink it!`, null);
    }

    setBusy(true);
    let reply;
    try {
      reply = await engine().bestMove(next.fen(), 10);
    } catch {
      setBusy(false);
      return say('hint', 'Bapu’s engine hiccuped. Play your move again and he’ll answer.', null);
    }
    window.setTimeout(() => {
      const after = new Chess(next.fen());
      const r = after.move(parseUci(reply.uci));
      setChess(after);
      setFen(after.fen());
      setLast([r.from as Key, r.to as Key]);
      setBusy(false);
      if (after.isInsufficientMaterial()) restart('The king took your piece! Keep your queen or rook protected, or out of the king’s reach. Let’s start again.', 'Piece lost');
    }, REPLY_DELAY);
  }

  async function hint() {
    if (busy || done) return;
    track.current.hinted = true;
    setBusy(true);
    const best = await engine()
      .bestMove(chess.fen(), 14)
      .finally(() => setBusy(false));
    const m = new Chess(chess.fen()).move(parseUci(best.uci));
    setShapes([{ orig: m.from as Key, dest: m.to as Key, brush: 'yellow' }]);
    say('hint', `${puzzle.hint ?? THEMES.endgame.hint} Bapu would play: ${moveInWords(m)}.`, 'Hint');
  }

  const dests = useMemo(() => (busy || done ? undefined : legalDests(chess)), [chess, busy, done]);

  return (
    <div className="play">
      <div className="play-prompt">
        <span>
          Moves: <strong>{moves}</strong> / {limit}
        </span>
        <span className={`play-mode play-mode-${mode}`}>{mode === 'guided' ? 'Guided' : 'Practice'}</span>
      </div>

      <Board
        fen={fen}
        version={version}
        orientation="white"
        turnColor={chess.turn() === 'w' ? 'white' : 'black'}
        lastMove={last}
        check={chess.inCheck()}
        dests={dests}
        shapes={shapes}
        onMove={(from, to) => {
          onMove(from, to).catch(() => {
            setBusy(false);
            setVersion((v) => v + 1);
          });
        }}
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
            <button className="btn btn-ghost" disabled={busy} onClick={() => restart('Fresh start. Plan the box first.', 'Restart')}>
              Restart
            </button>
            {mode === 'guided' && (
              <button className="btn btn-ghost" disabled={busy} onClick={() => hint().catch(() => undefined)}>
                <Bulb size={18} /> Hint
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
