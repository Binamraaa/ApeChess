// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Binamra Bhusal

import { Chess, type PieceSymbol, type Square } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { explainCorrect, explainSolved } from './explain';
import { isFork, moveFacts, type MoveFacts } from './facts';

/** Facts for every solver move of a Lichess-format line (moves[1], [3], ...). */
function line(fen: string, moves: string[]): MoveFacts[] {
  const chess = new Chess(fen);
  const out: MoveFacts[] = [];
  moves.forEach((uci, i) => {
    const move = { from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square, promotion: uci[4] as PieceSymbol | undefined };
    if (i % 2 === 1) out.push(moveFacts(chess.fen(), move));
    chess.move(move);
  });
  return out;
}

// Positions from the featured puzzles in content/levels.
describe('move facts on real puzzles', () => {
  it('sees a pin made by the moved bishop (L10 demo)', () => {
    const [f] = line('r1bqkb1r/pp1n3p/4p1p1/8/3pP3/8/PPP1B1PP/RNBQ1RK1 w kq - 0 12', ['d1d4', 'f8c5', 'c1e3', 'c5d4']);
    expect(f.lines[0]).toMatchObject({ kind: 'pin', by: { square: 'c5' }, front: { type: 'q' }, behind: { type: 'k' } });
    expect(explainCorrect(f, 'pin')).toMatch(/^Your bishop pins the queen on d4 to the king/);
  });

  it('sees a skewer through the king (L11 demo)', () => {
    const moves = ['d4e4', 'f6e6', 'e4f4', 'e6e3'];
    const facts = line('6k1/5p2/5rp1/7p/3K3P/4Q1P1/8/8 w - - 12 61', moves);
    expect(facts[0].lines[0]).toMatchObject({ kind: 'skewer', front: { type: 'k' }, behind: { type: 'q' } });
    expect(explainSolved(facts, 'skewer')).toMatch(/^The skewer forced the king to step aside, and the queen behind it fell/);
  });

  it('sees a discovered attack (L12 demo)', () => {
    const [f] = line('r1b2rk1/pp3pbp/2nq2p1/3B4/8/5N2/PP3PPP/R1BQ1RK1 b - - 0 14', ['c6b4', 'd5f7', 'f8f7', 'd1d6']);
    expect(f.check).toBe(true);
    expect(f.discovered[0]).toMatchObject({ by: { type: 'q', square: 'd1' }, target: { type: 'q', square: 'd6' } });
  });

  it('sees a double check, then a back-rank mate (L12 g3)', () => {
    const facts = line('6k1/pp2r1p1/2p2pp1/3pb3/6Q1/1P1P2P1/P1P2PBP/4qK2 w - - 0 24', ['f1e1', 'e5c3', 'e1d1', 'e7e1']);
    expect(facts[0].doubleCheck).toBe(true);
    expect(facts[1].mate).toBe(true);
  });

  it('tells a back-rank mate from a supported mate (L06 demo, L05 demo)', () => {
    const [back] = line('3r2k1/5ppp/6nq/1B2p3/4P2P/1bP1N3/1P1R1PP1/2K5 b - - 0 26', ['g6f4', 'd2d8']);
    expect(back.backRank).toBe(true);
    const [kiss] = line('r2q1rk1/ppp3bp/3p2p1/4p1NN/2Pn4/3Q4/PP3PP1/R1B1K2R b KQ - 0 14', ['g6h5', 'd3h7']);
    expect(kiss).toMatchObject({ mate: true, backRank: false });
    expect(explainSolved([kiss], 'mate')).toMatch(/your knight protects it/);
  });

  it('names the special moves (L04 guided)', () => {
    expect(line('7k/1p5p/p7/P1p5/8/8/5pK1/8 b - - 0 51', ['b7b5', 'a5b6'])[0].special).toBe('enPassant');
    const [castle] = line('r3r1k1/p5Rp/1n6/3pB3/8/8/P5PP/4K2R b K - 0 29', ['g8f8', 'e1g1']);
    expect(castle).toMatchObject({ special: 'castle', mate: true });
  });

  it('only counts real fork targets (defended pieces worth less than the attacker do not count)', () => {
    // L09 g3: Qf7+ hits the king and the loose rook on e8.
    const [f] = line('r1b1r3/7k/1q4pp/1ppp4/p7/4PQ2/PP3PPP/R4RK1 b - - 0 25', ['b6d6', 'f3f7', 'h7h8', 'f7e8']);
    expect(isFork(f)).toBe(true);
    expect(f.forkTargets.map((t) => t.square)).toEqual(['h7', 'e8']);
  });
});
