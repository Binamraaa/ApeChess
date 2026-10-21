import type { DrawShape } from 'chessground/draw';
import type { Key } from 'chessground/types';
import { isFork, type MoveFacts } from '../../bapu/explain';

const arrow = (orig: string, dest: string): DrawShape => ({ orig: orig as Key, dest: dest as Key, brush: 'red' });

/** Red arrows from the forking piece to each big target. */
export function forkArrows(f: MoveFacts): DrawShape[] {
  return f.forkTargets.filter((t) => t.type !== 'p').map((t) => arrow(f.to, t.square));
}

/** Arrows that show the idea behind a move: fork targets, a pin or skewer line, or the piece a discovery unleashed. */
export function tacticArrows(f: MoveFacts): DrawShape[] {
  if (isFork(f)) return forkArrows(f);
  if (f.discovered.length) return f.discovered.map((d) => arrow(d.by.square, d.target.square));
  const line = f.lines.find((l) => l.by.square === f.to);
  if (line) return [arrow(line.by.square, line.behind.square)];
  return [];
}
