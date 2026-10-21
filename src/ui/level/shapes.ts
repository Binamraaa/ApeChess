import type { DrawShape } from 'chessground/draw';
import type { Key } from 'chessground/types';
import type { MoveFacts } from '../../bapu/explain';

/** Red arrows from the forking piece to each big target. */
export function forkArrows(f: MoveFacts): DrawShape[] {
  return f.targets
    .filter((t) => t.type !== 'p')
    .map((t) => ({ orig: f.to as Key, dest: t.square as Key, brush: 'red' }));
}
