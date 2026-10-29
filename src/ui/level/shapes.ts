// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Binamra Bhusal

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

const STAR =
  '<polygon points="50,12 61,39 90,40 67,58 75,87 50,70 25,87 33,58 10,40 39,39" fill="#f5c75e" stroke="#b9791a" stroke-width="4" stroke-linejoin="round"/>';

/** Gold stars on the squares a drill still has to visit. */
export function starShapes(squares: string[]): DrawShape[] {
  return squares.map((sq) => ({ orig: sq as Key, customSvg: { html: STAR } }));
}
