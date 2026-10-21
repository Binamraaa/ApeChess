import type { Chess, Square } from 'chess.js';
import type { Key } from 'chessground/types';

/** Legal destinations per origin square, in the shape chessground expects. */
export function legalDests(chess: Chess): Map<Key, Key[]> {
  const dests = new Map<Key, Key[]>();
  for (const m of chess.moves({ verbose: true })) {
    const list = dests.get(m.from) ?? [];
    if (!list.includes(m.to)) list.push(m.to);
    dests.set(m.from, list);
  }
  return dests;
}

/** UCI for a board move, auto-promoting to a queen. */
export function boardMoveToUci(chess: Chess, from: Key, to: Key): string {
  const piece = chess.get(from as Square);
  const promotes = piece?.type === 'p' && (to[1] === '8' || to[1] === '1');
  return from + to + (promotes ? 'q' : '');
}
