// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Binamra Bhusal

import { describe, expect, it } from 'vitest';
import { PuzzleSession } from './puzzle';
import type { PuzzleDef } from './types';

// Demo position from L08: Black's bishop leaves d6, White forks with Nc7+.
const fork: PuzzleDef = {
  id: 'fork',
  fen: 'r3k3/pp3ppp/3b4/1N6/8/8/PPB2PPP/2R3K1 b - - 0 1',
  moves: ['d6c5', 'b5c7', 'e8d7', 'c7a8'],
};

// Back-rank position with two mates (Re8# and Ra8#); only Re8# is listed.
const mate: PuzzleDef = {
  id: 'mate',
  fen: '6k1/1p3ppp/8/8/8/8/5PPP/R3R1K1 b - - 0 1',
  moves: ['b7b6', 'e1e8'],
};

describe('PuzzleSession', () => {
  it('works out the solver colour from the FEN (opponent moves first)', () => {
    expect(new PuzzleSession(fork).solver).toBe('white');
    const blackSolves = { ...fork, fen: fork.fen.replace(' b ', ' w '), moves: ['c2d3', 'a8c8'] };
    expect(new PuzzleSession(blackSolves).solver).toBe('black');
  });

  it("plays the opponent's setup move on start", () => {
    const s = new PuzzleSession(fork);
    const m = s.start();
    expect(m.from + m.to).toBe('d6c5');
    expect(s.turn).toBe('white');
    expect(s.expected()).toBe('b5c7');
  });

  it('accepts the solution, auto-plays the reply, then solves', () => {
    const s = new PuzzleSession(fork);
    s.start();
    const r1 = s.tryMove('b5c7');
    expect(r1.kind).toBe('correct');
    if (r1.kind === 'correct') expect(r1.reply.from + r1.reply.to).toBe('e8d7');
    expect(s.expected()).toBe('c7a8');
    const r2 = s.tryMove('c7a8');
    expect(r2.kind).toBe('solved');
    expect(s.done).toBe(true);
  });

  it('rejects a legal wrong move without changing the position', () => {
    const s = new PuzzleSession(fork);
    s.start();
    const before = s.fen;
    const r = s.tryMove('b5a7');
    expect(r.kind).toBe('wrong');
    expect(s.fen).toBe(before);
    expect(s.expected()).toBe('b5c7');
  });

  it('reports illegal moves', () => {
    const s = new PuzzleSession(fork);
    s.start();
    expect(s.tryMove('b5b6').kind).toBe('illegal');
    expect(s.tryMove('e2e4').kind).toBe('illegal');
  });

  it('accepts any checkmating move, like Lichess', () => {
    const s = new PuzzleSession(mate);
    s.start();
    expect(s.tryMove('a1a8').kind).toBe('solved');
    expect(s.done).toBe(true);
  });

  it('can play the solution for the learner', () => {
    const s = new PuzzleSession(fork);
    s.start();
    expect(s.playSolution().kind).toBe('correct');
    expect(s.playSolution().kind).toBe('solved');
  });

  it('guards against misuse', () => {
    const s = new PuzzleSession(fork);
    expect(() => s.tryMove('b5c7')).toThrow();
    s.start();
    expect(() => s.start()).toThrow();
    expect(() => new PuzzleSession({ ...fork, moves: ['d6c5'] })).toThrow();
  });
});

describe('solverStep', () => {
  it('counts solver moves', () => {
    const s = new PuzzleSession(fork);
    s.start();
    expect(s.solverStep).toBe(0);
    s.tryMove('b5c7');
    expect(s.solverStep).toBe(1);
  });
});
