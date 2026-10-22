import { useEffect, useRef } from 'react';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { DrawShape } from 'chessground/draw';
import type { Color, Key } from 'chessground/types';
import { play } from '../sound/engine';
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.cburnett.css';
import './board.css';

export interface BoardProps {
  fen: string;
  orientation: Color;
  turnColor: Color;
  /** Legal moves for the side that may move; omit to make the board read-only. */
  dests?: Map<Key, Key[]>;
  lastMove?: [Key, Key];
  check?: boolean;
  shapes?: DrawShape[];
  onMove?: (from: Key, to: Key) => void;
  /** Bumped to replay the "shake" animation after a wrong move. */
  shake?: number;
  /** Bump to force a resync with `fen`, e.g. to undo a wrong move the user dragged on the board. */
  version?: number;
}

const brushes = {
  green: { key: 'g', color: '#2f8a57', opacity: 0.85, lineWidth: 10 },
  red: { key: 'r', color: '#c2452d', opacity: 0.85, lineWidth: 10 },
  blue: { key: 'b', color: '#1f5c57', opacity: 0.8, lineWidth: 10 },
  yellow: { key: 'y', color: '#f0a500', opacity: 1, lineWidth: 12 },
};

const pieceCount = (fen: string) => fen.split(' ')[0].replace(/[^a-z]/gi, '').length;

/** Thin React wrapper around Lichess's chessground. Chess rules live outside (chess.js). */
export function Board({ fen, orientation, turnColor, dests, lastMove, check, shapes, onMove, shake, version }: BoardProps) {
  const el = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  // For move sounds: what the board last showed, and a move the learner just played by hand.
  const shown = useRef({ fen, move: lastMove?.join() });
  const dropped = useRef<string | null>(null);

  useEffect(() => {
    if (!el.current) return;
    api.current = Chessground(el.current, {
      coordinates: true,
      animation: { enabled: true, duration: 260 },
      highlight: { lastMove: true, check: true },
      premovable: { enabled: false },
      draggable: { showGhost: true },
      drawable: { enabled: false, visible: true, brushes },
      movable: {
        free: false,
        showDests: true,
        events: {
          after: (from, to, meta) => {
            // Sound on the drop itself, not after the position round-trips through the parent.
            dropped.current = `${from},${to}`;
            play(meta.captured ? 'capture' : 'move');
            onMoveRef.current?.(from, to);
          },
        },
      },
    });
    return () => api.current?.destroy();
  }, []);

  // A new last move means a move was played (opponent, demo or engine): clack, and warn of check.
  useEffect(() => {
    const move = lastMove?.join();
    const prev = shown.current;
    const mine = dropped.current;
    shown.current = { fen, move };
    dropped.current = null;
    if (!move || move === prev.move || fen === prev.fen) return;
    if (move !== mine) play(pieceCount(fen) < pieceCount(prev.fen) ? 'capture' : 'move');
    if (check) play('check');
  }, [fen, lastMove, check]);

  useEffect(() => {
    api.current?.set({
      fen,
      orientation,
      turnColor,
      lastMove,
      check: check ? turnColor : false,
      movable: { color: dests ? turnColor : undefined, dests: dests ?? new Map() },
    });
  }, [fen, orientation, turnColor, dests, lastMove, check, version]);

  useEffect(() => {
    api.current?.setAutoShapes(shapes ?? []);
  }, [shapes]);

  useEffect(() => {
    const f = frame.current;
    if (!f || !shake) return;
    f.classList.remove('board-shake');
    void f.offsetWidth; // restart the CSS animation
    f.classList.add('board-shake');
  }, [shake]);

  return (
    <div ref={frame} className="board-frame">
      <div ref={el} className="board" />
    </div>
  );
}
