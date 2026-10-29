// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Binamra Bhusal

import { describe, expect, it } from 'vitest';
import { currentPuzzle, initialRun, progress, runReducer, type RunState } from './runner';
import type { LevelDef, PuzzleDef } from './types';

const pz = (id: string): PuzzleDef => ({ id, fen: '8/8/8/8/8/8/8/8 w - - 0 1', moves: ['a1a2', 'a2a3'] });
const level: LevelDef = {
  id: 'LX',
  number: 1,
  unit: 1,
  unitTitle: 'Unit',
  title: 'Test',
  theme: 'knightFork',
  icon: 'wN',
  concept: 'c',
  summary: 's',
  demo: pz('demo'),
  guided: [pz('g1'), pz('g2'), pz('g3')],
  practice: Array.from({ length: 7 }, (_, i) => pz(`p${i + 1}`)),
};

const next = (s: RunState) => runReducer(level, s, { type: 'next' });

describe('level runner', () => {
  it('walks concept → demo → guided ×3 → practice ×7 → summary', () => {
    const seen: string[] = [];
    let s = initialRun;
    while (s.phase !== 'summary') {
      seen.push(currentPuzzle(level, s)?.id ?? s.phase);
      s = next(s);
    }
    expect(seen).toEqual(['concept', 'demo', 'g1', 'g2', 'g3', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7']);
    expect(next(s)).toBe(s); // summary is terminal
  });

  it('records one outcome per puzzle, only during puzzle phases', () => {
    const outcome = { puzzleId: 'g1', firstTry: true, hintUsed: false, revealed: false };
    let s = runReducer(level, initialRun, { type: 'puzzleDone', outcome });
    expect(s.outcomes).toHaveLength(0);

    s = next(next(initialRun)); // guided g1
    s = runReducer(level, s, { type: 'puzzleDone', outcome });
    s = runReducer(level, s, { type: 'puzzleDone', outcome });
    expect(s.outcomes).toHaveLength(1);
  });

  it('skips empty sets', () => {
    const noGuided = { ...level, guided: [] };
    const s = runReducer(noGuided, { ...initialRun, phase: 'demo' }, { type: 'next' });
    expect(s.phase).toBe('practice');
  });

  it('reports progress from 0 to 1', () => {
    expect(progress(level, initialRun)).toBe(0);
    expect(progress(level, { ...initialRun, phase: 'summary' })).toBe(1);
  });
});
