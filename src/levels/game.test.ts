// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Binamra Bhusal

import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import {
  BLUNDER,
  MISTAKE,
  acceptsDraw,
  colorFor,
  isClear,
  learnerMoves,
  loss,
  mergeGames,
  outcomeOf,
  positions,
  rematchPuzzles,
  replay,
  scoreGame,
  verdict,
  winChance,
  worstMoments,
  type Judged,
  type SavedGame,
} from './game';

const config = { minMoves: 25 };

/** A judged move that gave away `cp` centipawns from level. */
const judged = (ply: number, cp: number): Judged => ({ ply, played: 'a2a3', before: 0, after: -cp, best: 'e2e4' });

describe('winning chances', () => {
  it('is 0 at level, rises with the score, and caps mates', () => {
    expect(winChance(0)).toBe(0);
    expect(winChance(100)).toBeGreaterThan(0);
    expect(winChance(300)).toBeGreaterThan(winChance(100));
    expect(winChance(-300)).toBeCloseTo(-winChance(300));
    expect(winChance(99990)).toBe(winChance(1000));
    expect(winChance(1000)).toBeLessThan(1);
  });

  it('judges a move by the chances it gave away', () => {
    expect(verdict(judged(0, 30))).toBe('ok');
    expect(verdict(judged(0, 130))).toBe('mistake');
    expect(verdict(judged(0, 400))).toBe('blunder');
    expect(loss(judged(0, 400))).toBeGreaterThanOrEqual(BLUNDER);
    expect(loss({ ...judged(0, 0), after: 200 })).toBe(0);
  });

  it('never blames the engine’s own choice, whatever the scores say', () => {
    expect(verdict({ ...judged(0, 900), played: 'e2e4' })).toBe('ok');
  });

  it('doesn’t call it a blunder to slip further in a position that was already lost', () => {
    const j: Judged = { ply: 0, played: 'a2a3', before: -900, after: -1400, best: 'e2e4' };
    expect(loss(j)).toBeLessThan(MISTAKE);
  });
});

describe('scoring the game', () => {
  it('gives nothing for a game that ended too soon', () => {
    expect(scoreGame('lost', 12, [], config)).toMatchObject({ stars: 0, xp: 0 });
    expect(scoreGame('resigned', 24, [], config).stars).toBe(0);
  });

  it('counts blunders for the stars once the learner lasts the game', () => {
    expect(scoreGame('resigned', 25, [], config).stars).toBe(3);
    expect(scoreGame('lost', 40, [judged(1, 400), judged(3, 130)], config)).toMatchObject({ stars: 2, blunders: 1, mistakes: 1 });
    expect(scoreGame('lost', 40, [judged(1, 400), judged(3, 500)], config).stars).toBe(2);
    expect(scoreGame('lost', 40, [judged(1, 400), judged(3, 500), judged(5, 600)], config).stars).toBe(1);
  });

  it('gives three stars for a win or a draw, however early', () => {
    expect(scoreGame('won', 10, [judged(1, 400)], config).stars).toBe(3);
    expect(scoreGame('drawn', 20, [judged(1, 400), judged(3, 500), judged(5, 600)], config).stars).toBe(3);
  });

  it('adds XP for every move that wasn’t a blunder, and for the result', () => {
    expect(scoreGame('lost', 30, [judged(1, 400)], config).xp).toBe(40 + 29 * 2);
    expect(scoreGame('lost', 80, [], config).xp).toBe(60 + 40 * 2);
    expect(scoreGame('won', 30, [], config).xp).toBe(60 + 30 * 2 + 100);
  });

  it('takes a draw only after the full game, in a position Bapu isn’t better in', () => {
    expect(acceptsDraw(24, 0, config)).toBe(false);
    expect(acceptsDraw(25, 10, config)).toBe(true);
    expect(acceptsDraw(30, 120, config)).toBe(false);
    expect(acceptsDraw(30, -300, config)).toBe(true);
  });

  it('picks the worst moments, in game order', () => {
    const moments = worstMoments([judged(1, 400), judged(3, 50), judged(5, 900), judged(7, 130), judged(9, 600)]);
    expect(moments.map((m) => m.ply)).toEqual([1, 5, 9]);
  });

  it('only makes a puzzle of a position with one clear answer', () => {
    expect(isClear([{ uci: 'h5f7', cp: 99999 }, { uci: 'h5e5', cp: 50 }])).toBe(true);
    expect(isClear([{ uci: 'h5f7', cp: 500 }, { uci: 'h5e5', cp: 480 }])).toBe(false);
    expect(isClear([{ uci: 'h5f7', cp: 20 }])).toBe(false);
    expect(isClear([{ uci: 'h5f7', cp: 600 }])).toBe(true);
  });
});

// Scholar's mate: Black (the learner) blunders with ...Nf6 and White mates on f7.
const scholar = ['e2e4', 'e7e5', 'd1h5', 'b8c6', 'f1c4', 'g8f6', 'h5f7'];

describe('the game itself', () => {
  it('alternates colours, starting with White', () => {
    expect([0, 1, 2].map(colorFor)).toEqual(['w', 'b', 'w']);
  });

  it('counts the learner’s moves', () => {
    expect(learnerMoves(scholar, 'w')).toBe(4);
    expect(learnerMoves(scholar, 'b')).toBe(3);
  });

  it('knows who won', () => {
    const chess = replay(scholar);
    expect(outcomeOf(chess, 'b')).toBe('lost');
    expect(outcomeOf(chess, 'w')).toBe('won');
    expect(outcomeOf(replay(scholar.slice(0, 6)), 'b')).toBeUndefined();
    expect(outcomeOf(new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'), 'b')).toBe('drawn');
  });

  it('turns a clearly punished blunder into a rematch puzzle', () => {
    const blunder: Judged = { ply: 5, played: 'g8f6', before: -150, after: -99998, best: 'd8e7', reply: 'h5f7', clear: true };
    const unclear: Judged = { ...blunder, ply: 3, played: 'b8c6', clear: false };
    const [puzzle, ...rest] = rematchPuzzles('g1', scholar, [unclear, blunder]);
    expect(rest).toEqual([]);
    expect(puzzle).toMatchObject({ id: 'game-g1-5', fen: positions(scholar)[5], moves: ['g8f6', 'h5f7'], source: 'game' });
    const chess = new Chess(puzzle.fen);
    for (const m of puzzle.moves) chess.move({ from: m.slice(0, 2), to: m.slice(2, 4) });
    expect(chess.isCheckmate()).toBe(true);
  });
});

describe('merging games between devices', () => {
  const game = (id: string, updated: string): SavedGame => ({ id, color: 'w', moves: ['e2e4'], judged: [], updated });

  it('keeps the newer unfinished game and the most games played', () => {
    const a = { current: game('x', '2026-10-24T10:00:00Z'), finished: [], played: 2 };
    const b = { current: game('y', '2026-10-24T11:00:00Z'), finished: [], played: 3 };
    expect(mergeGames(a, b)).toEqual({ current: b.current, finished: [], played: 3 });
    expect(mergeGames(b, a).current?.id).toBe('y');
  });

  it('never brings back a game another device finished', () => {
    const phone = { current: game('x', '2026-10-24T10:00:00Z'), finished: [], played: 0 };
    const laptop = { finished: ['x'], played: 1 };
    expect(mergeGames(phone, laptop)).toEqual({ finished: ['x'], played: 1 });
  });
});
