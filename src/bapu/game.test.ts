// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Binamra Bhusal

import { describe, expect, it } from 'vitest';
import { positions } from '../levels/game';
import { bapuMoveLine, explainMoment, gameHeadline, gameVerdict, quietLine } from './game';

describe('Bapu talking through his moves', () => {
  it('names a fork', () => {
    expect(bapuMoveLine('4k3/8/8/8/3n4/8/8/R3K3 b - - 0 1', 'd4c2')).toBe(
      'My knight on c2 attacks your king and your rook on a1 at once. Which one will you save?',
    );
  });

  it('takes a free piece politely', () => {
    expect(bapuMoveLine('3rk3/8/8/8/3N4/8/8/4K3 b - - 0 1', 'd8d4')).toBe('Your knight on d4 had no guard, so I’ll take it. Thank you!');
  });

  it('says checkmate, and stays quiet about ordinary moves', () => {
    const scholar = ['e2e4', 'e7e5', 'd1h5', 'b8c6', 'f1c4', 'g8f6', 'h5f7'];
    expect(bapuMoveLine(positions(scholar)[6], 'h5f7')).toMatch(/^Checkmate/);
    expect(bapuMoveLine(positions(scholar)[1], 'e7e5')).toBeNull();
    expect(quietLine(0)).toBeTruthy();
  });
});

describe('the review after the game', () => {
  it('explains a blunder by the answer that punished it', () => {
    const scholar = ['e2e4', 'e7e5', 'd1h5', 'b8c6', 'f1c4', 'g8f6'];
    const m = explainMoment(positions(scholar)[5], 5, 'g8f6', 'd8e7', 'h5f7');
    expect(m.title).toBe('Move 3: you played Knight to f6.');
    expect(m.why).toBe('It let me checkmate you: Queen takes on f7.');
    expect(m.better).toBe('Queen to e7 was better.');
  });

  it('points out a piece left with no guard', () => {
    const m = explainMoment('3qk3/8/8/8/8/8/8/2B1K3 w - - 0 1', 0, 'c1g5', 'e1f2', 'd8g5');
    expect(m.why).toBe('Your bishop on g5 had no guard, so I could just take it.');
    expect(m.better).toBe('King to f2 was better.');
  });

  it('names the fork a move allowed', () => {
    // The knight leaves e4 unguarded: the queen takes the pawn with check and hits the loose knight too.
    const fen = 'rnb1kbnr/pppp1ppp/8/4p3/4P2q/2N5/PPPP1PPP/R1BQKBNR w KQkq - 2 3';
    const m = explainMoment(fen, 4, 'c3d5', 'g1f3', 'h4e4');
    expect(m.why).toBe('It let my queen fork your king and your knight on d5: Queen takes on e4.');
  });

  it('has a headline and a verdict for every ending', () => {
    for (const outcome of ['won', 'lost', 'drawn', 'resigned'] as const) {
      for (const stars of [0, 1, 2, 3]) {
        expect(gameHeadline(outcome, stars)).toBeTruthy();
        expect(gameVerdict(outcome, stars, 25)).toBeTruthy();
      }
    }
  });
});
