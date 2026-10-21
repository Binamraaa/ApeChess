import { describe, expect, it } from 'vitest';
import { describeMove, explainCorrect, explainSolved, explainWrong, isFork, moveFacts } from './explain';

// L08 demo position, after Black's ...Bc5.
const AFTER_BC5 = 'r3k3/pp3ppp/8/1Nb5/8/8/PPB2PPP/2R3K1 w - - 1 2';

describe('moveFacts', () => {
  it('finds the king and rook targets of Nc7+', () => {
    const f = moveFacts(AFTER_BC5, { from: 'b5', to: 'c7' });
    expect(f.piece).toBe('n');
    expect(f.check).toBe(true);
    expect(f.targets.map((t) => t.type + t.square)).toEqual(['ke8', 'ra8']);
    expect(isFork(f)).toBe(true);
    expect(f.hanging).toBe(false);
  });

  it('notices a capture and a non-fork', () => {
    const f = moveFacts(AFTER_BC5, { from: 'b5', to: 'a7' });
    expect(f.captured).toBe('p');
    expect(isFork(f)).toBe(false);
  });
});

describe('templates', () => {
  it('describes a checking fork', () => {
    const f = moveFacts(AFTER_BC5, { from: 'b5', to: 'c7' });
    expect(explainCorrect(f)).toBe(
      'Check! Your knight on c7 hits the king AND the rook on a8. The king must move first, so something gets left behind.',
    );
  });

  it('summarises a solved fork', () => {
    const fork = moveFacts(AFTER_BC5, { from: 'b5', to: 'c7' });
    const final = moveFacts('r7/ppNk1ppp/8/2b5/8/8/PPB2PPP/2R3K1 w - - 3 3', { from: 'c7', to: 'a8' });
    expect(explainSolved(fork, final)).toBe(
      'Knight to c7 forked the king AND the rook on a8. Only one could escape, so you collect the rook.',
    );
  });

  it('prefers hand-written refutations, then falls back to nudges', () => {
    const p = { id: 'x', fen: AFTER_BC5, moves: ['x', 'b5c7'], wrong: { b5a7: 'Custom!' } };
    const a7 = moveFacts(AFTER_BC5, { from: 'b5', to: 'a7' });
    expect(explainWrong(p, 'b5a7', a7, 0)).toBe('Custom!');

    const d4 = moveFacts(AFTER_BC5, { from: 'b5', to: 'd4' });
    expect(explainWrong(p, 'b5d4', d4, 0)).toMatch(/^Right piece!/);

    const rook = moveFacts(AFTER_BC5, { from: 'c1', to: 'd1' });
    expect(explainWrong(p, 'c1d1', rook, 0)).toMatch(/all about the knight/);

    expect(explainWrong(p, 'b5a7', a7, 1)).toMatch(/collect the prize/);
  });
});

describe('describeMove', () => {
  it('reads like a sentence', () => {
    expect(describeMove({ color: 'b', piece: 'b', to: 'c5', san: 'Bc5' })).toBe('Black moved the bishop to c5.');
    expect(describeMove({ color: 'w', piece: 'r', to: 'b2', captured: 'p', san: 'Rxb2' })).toBe(
      "White's rook took your pawn on b2.",
    );
    expect(describeMove({ color: 'w', piece: 'q', to: 'h7', san: 'Qh7+' })).toBe('White moved the queen to h7. Check!');
  });
});
