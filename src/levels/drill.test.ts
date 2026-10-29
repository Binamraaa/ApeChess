// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Binamra Bhusal

import { describe, expect, it } from 'vitest';
import { drillFen, drillMove, drillMoves, parseDrill, solveDrill } from './drill';

describe('drills', () => {
  it('round-trips a board', () => {
    const b = parseDrill('8/8/3p4/8/8/8/8/R7');
    expect(b).toMatchObject({ piece: 'R', square: 'a1' });
    expect(drillFen(b)).toBe('8/8/3p4/8/8/8/8/R7');
  });

  it('moves like the real pieces', () => {
    expect(drillMoves(parseDrill('8/8/8/8/8/8/8/N7')).sort()).toEqual(['b3', 'c2']);
    expect(drillMoves(parseDrill('8/8/8/8/3K4/8/8/8'))).toHaveLength(8);
    // A rook stops at a pawn (and can take it).
    expect(drillMoves(parseDrill('8/8/8/8/p7/8/8/R7'))).toContain('a4');
    expect(drillMoves(parseDrill('8/8/8/8/p7/8/8/R7'))).not.toContain('a5');
  });

  it('pawns push one or two from the start, capture diagonally, and promote', () => {
    const b = parseDrill('8/8/8/8/8/2p5/1P6/8');
    expect(drillMoves(b).sort()).toEqual(['b3', 'b4', 'c3']);
    expect(drillMove(parseDrill('8/1P6/8/8/8/8/8/8'), 'b8').piece).toBe('Q');
  });

  it('finds the shortest route through every star', () => {
    // A rook from a1 to h1 and h8: two moves.
    expect(solveDrill(parseDrill('8/8/8/8/8/8/8/R7'), ['h1', 'h8']).moves).toBe(2);
    // A knight from a1 to b1, the slowest square next door: three moves.
    expect(solveDrill(parseDrill('8/8/8/8/8/8/8/N7'), ['b1']).moves).toBe(3);
  });
});
