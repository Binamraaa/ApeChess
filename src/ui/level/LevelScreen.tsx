import { useEffect, useMemo, useReducer, useState } from 'react';
import { levelRun } from '../../levels/practice';
import { currentPuzzle, initialRun, progress, runReducer, type RunAction, type RunState } from '../../levels/runner';
import { scoreLevel } from '../../levels/scoring';
import type { LevelDef } from '../../levels/types';
import { getLevelProgress, markStarted } from '../../progress/store';
import { Close } from '../icons';
import { ConceptCard } from './ConceptCard';
import { DemoPlayer } from './DemoPlayer';
import { PuzzlePlayer } from './PuzzlePlayer';
import { SummaryCard } from './SummaryCard';
import './level.css';

function phaseLabel(level: LevelDef, s: RunState): string {
  switch (s.phase) {
    case 'concept':
      return 'New idea';
    case 'demo':
      return 'Demo';
    case 'guided':
      return `Guided ${s.index + 1}/${level.guided.length}`;
    case 'practice':
      return `Practice ${s.index + 1}/${level.practice.length}`;
    case 'summary':
      return 'Done!';
  }
}

interface Props {
  level: LevelDef;
  onExit: () => void;
  /** Starts the following level, if there is one to go to. */
  onNext?: () => void;
}

/** Loads the learner's recent puzzles, then runs the level with a fresh practice set. */
export function LevelScreen({ level, onExit, onNext }: Props) {
  const [run, setRun] = useState<LevelDef | null>(null);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    let live = true;
    getLevelProgress(level.id)
      .catch(() => undefined)
      .then((p) => {
        if (!live) return;
        setRecent(p?.recent ?? []);
        setRun(levelRun(level, p?.recent ?? []));
      });
    return () => {
      live = false;
    };
  }, [level]);

  // Play again: draw another practice set, skipping the one just played.
  const replay = (played: string[]) => {
    const seen = [...played, ...recent];
    setRecent(seen);
    setRun(levelRun(level, seen));
  };

  if (!run) return <div className="level" />;
  return <LevelRun key={run.practice.map((p) => p.id).join()} level={run} onExit={onExit} onNext={onNext} onReplay={replay} />;
}

function LevelRun({ level, onExit, onNext, onReplay }: Props & { onReplay: (played: string[]) => void }) {
  const [state, dispatch] = useReducer((s: RunState, a: RunAction) => runReducer(level, s, a), initialRun);

  useEffect(() => {
    markStarted().catch(() => {});
  }, []);

  // Scroll back to the top whenever the step changes (small phones).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [state.phase, state.index]);

  const puzzle = currentPuzzle(level, state);
  const score = useMemo(() => scoreLevel(state.outcomes), [state.outcomes]);
  const next = () => dispatch({ type: 'next' });
  const played = level.practice.map((p) => p.id);

  return (
    <div className="level">
      <header className="level-bar">
        <button className="icon-btn" onClick={onExit} aria-label="Leave lesson">
          <Close size={22} />
        </button>
        <div
          className="progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress(level, state) * 100)}
        >
          <div className="progress-fill" style={{ width: `${Math.max(progress(level, state) * 100, 4)}%` }} />
        </div>
        <span className="level-phase">{phaseLabel(level, state)}</span>
      </header>

      <main className="level-main">
        {state.phase === 'concept' && <ConceptCard level={level} onContinue={next} />}
        {state.phase === 'demo' && <DemoPlayer puzzle={level.demo} onContinue={next} />}
        {(state.phase === 'guided' || state.phase === 'practice') && puzzle && (
          <PuzzlePlayer
            key={puzzle.id}
            puzzle={puzzle}
            mode={state.phase}
            theme={level.theme}
            onSolved={(outcome) => dispatch({ type: 'puzzleDone', outcome })}
            onContinue={next}
          />
        )}
        {state.phase === 'summary' && (
          <SummaryCard level={level} score={score} played={played} onDone={onExit} onNext={onNext} onReplay={() => onReplay(played)} />
        )}
      </main>
    </div>
  );
}
