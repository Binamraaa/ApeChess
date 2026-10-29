// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Binamra Bhusal

import type { LevelDef, PuzzleDef } from './types';
import type { PuzzleOutcome } from './scoring';

/** concept → demo → guided (3) → practice (7) → summary */
export type Phase = 'concept' | 'demo' | 'guided' | 'practice' | 'summary';

export interface RunState {
  phase: Phase;
  /** Index within the guided or practice set. */
  index: number;
  outcomes: PuzzleOutcome[];
}

export type RunAction = { type: 'next' } | { type: 'puzzleDone'; outcome: PuzzleOutcome };

export const initialRun: RunState = { phase: 'concept', index: 0, outcomes: [] };

export function runReducer(level: LevelDef, state: RunState, action: RunAction): RunState {
  switch (action.type) {
    case 'next':
      return advance(level, state);
    case 'puzzleDone': {
      if (state.phase !== 'guided' && state.phase !== 'practice') return state;
      // One outcome per puzzle: ignore duplicates (e.g. a double tap).
      if (state.outcomes.some((o) => o.puzzleId === action.outcome.puzzleId)) return state;
      return { ...state, outcomes: [...state.outcomes, action.outcome] };
    }
  }
}

function advance(level: LevelDef, state: RunState): RunState {
  switch (state.phase) {
    case 'concept':
      return { ...state, phase: 'demo', index: 0 };
    case 'demo':
      return enter(level, state, 'guided');
    case 'guided':
      if (state.index + 1 < level.guided.length) return { ...state, index: state.index + 1 };
      return enter(level, state, 'practice');
    case 'practice':
      if (state.index + 1 < level.practice.length) return { ...state, index: state.index + 1 };
      return { ...state, phase: 'summary', index: 0 };
    case 'summary':
      return state;
  }
}

/** Moves to the first puzzle of a set, skipping the set if it's empty. */
function enter(level: LevelDef, state: RunState, phase: 'guided' | 'practice'): RunState {
  const set = phase === 'guided' ? level.guided : level.practice;
  if (set.length > 0) return { ...state, phase, index: 0 };
  return phase === 'guided' ? enter(level, state, 'practice') : { ...state, phase: 'summary', index: 0 };
}

export function currentPuzzle(level: LevelDef, state: RunState): PuzzleDef | undefined {
  if (state.phase === 'demo') return level.demo;
  if (state.phase === 'guided') return level.guided[state.index];
  if (state.phase === 'practice') return level.practice[state.index];
  return undefined;
}

/** Overall progress through the level, 0..1, for the progress bar. */
export function progress(level: LevelDef, state: RunState): number {
  const steps = 2 + level.guided.length + level.practice.length; // concept, demo, puzzles
  const done = {
    concept: 0,
    demo: 1,
    guided: 2 + state.index,
    practice: 2 + level.guided.length + state.index,
    summary: steps,
  }[state.phase];
  return done / steps;
}
