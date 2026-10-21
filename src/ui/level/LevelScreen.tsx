import { useEffect, useMemo, useReducer, useState } from 'react';
import { levelRun } from '../../levels/practice';
import { currentPuzzle, initialRun, progress, runReducer, type RunAction, type RunState } from '../../levels/runner';
import { scoreLevel } from '../../levels/scoring';
import type { LevelDef } from '../../levels/types';
import { getLevelProgress, markStarted } from '../../progress/store';
import { formatTime } from '../format';
import { Close } from '../icons';
import { ConceptCard } from './ConceptCard';
import { DemoPlayer } from './DemoPlayer';
import { ChoicePlayer } from './ChoicePlayer';
import { DrillPlayer } from './DrillPlayer';
import { EndgamePlayer } from './EndgamePlayer';
import { PuzzlePlayer } from './PuzzlePlayer';
import { QuizPlayer } from './QuizPlayer';
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
      return `${level.timed ? 'Puzzle' : 'Practice'} ${s.index + 1}/${level.practice.length}`;
    case 'summary':
      return 'Done!';
  }
}

type StepProps = Parameters<typeof PuzzlePlayer>[0];

/** One guided or practice step, played by the component for its kind. */
function Step(props: StepProps) {
  switch (props.puzzle.kind ?? 'puzzle') {
    case 'drill':
      return <DrillPlayer {...props} />;
    case 'quiz':
      return <QuizPlayer {...props} />;
    case 'choice':
      return <ChoicePlayer {...props} />;
    case 'endgame':
      return <EndgamePlayer {...props} />;
    default:
      return <PuzzlePlayer {...props} />;
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

  // The boss level is timed from its first puzzle to the summary.
  const [clock, setClock] = useState<{ start?: number; now: number }>({ now: Date.now() });
  const playing = state.phase === 'guided' || state.phase === 'practice';
  useEffect(() => {
    if (!level.timed || !playing) return;
    setClock((c) => ({ start: c.start ?? Date.now(), now: Date.now() }));
    const t = window.setInterval(() => setClock((c) => ({ ...c, now: Date.now() })), 1000);
    return () => clearInterval(t);
  }, [level.timed, playing]);
  const seconds = clock.start ? Math.round((clock.now - clock.start) / 1000) : 0;

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
        <span className="level-phase">
          {phaseLabel(level, state)}
          {level.timed && playing && <span className="level-clock">{formatTime(seconds)}</span>}
        </span>
      </header>

      <main className="level-main">
        {state.phase === 'concept' && <ConceptCard level={level} onContinue={next} />}
        {state.phase === 'demo' && <DemoPlayer puzzle={level.demo} onContinue={next} />}
        {(state.phase === 'guided' || state.phase === 'practice') && puzzle && (
          <Step
            key={puzzle.id}
            puzzle={puzzle}
            mode={state.phase}
            theme={level.theme}
            onSolved={(outcome) => dispatch({ type: 'puzzleDone', outcome })}
            onContinue={next}
          />
        )}
        {state.phase === 'summary' && (
          <SummaryCard
            level={level}
            score={score}
            played={played}
            seconds={level.timed ? seconds : undefined}
            onDone={onExit}
            onNext={onNext}
            onReplay={() => onReplay(played)}
          />
        )}
      </main>
    </div>
  );
}
