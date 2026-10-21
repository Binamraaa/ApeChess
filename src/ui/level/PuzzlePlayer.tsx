import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Move } from 'chess.js';
import type { DrawShape } from 'chessground/draw';
import type { Key } from 'chessground/types';
import { Board } from '../../board/Board';
import { boardMoveToUci, legalDests } from '../../board/dests';
import { BapuBubble, type Tone } from '../../bapu/BapuBubble';
import {
  PIECE_NAME,
  describeMove,
  explainCorrect,
  explainSolved,
  explainWrong,
  isFork,
  moveFacts,
  type MoveFacts,
} from '../../bapu/explain';
import { THEMES, type Theme } from '../../bapu/themes';
import { PuzzleSession, parseUci, type MoveResult } from '../../levels/puzzle';
import type { PuzzleOutcome } from '../../levels/scoring';
import type { PuzzleDef } from '../../levels/types';
import { Bulb } from '../icons';
import { tacticArrows } from './shapes';

type Status = 'intro' | 'solving' | 'busy' | 'solved';
type Played = Extract<MoveResult, { kind: 'correct' | 'solved' }>;

interface Message {
  id: number;
  tone: Tone;
  text: string;
  label?: string | null;
}

interface View {
  fen: string;
  lastMove?: [Key, Key];
  check: boolean;
  /** Bumped to force the board back in sync (e.g. after a wrong move). */
  version: number;
}

interface Props {
  puzzle: PuzzleDef;
  mode: 'guided' | 'practice';
  theme: Theme;
  onSolved: (outcome: PuzzleOutcome) => void;
  onContinue: () => void;
}

const OPPONENT_DELAY = 700;
const REPLY_DELAY = 850;

const vibrate = (ms: number) => navigator.vibrate?.(ms);

function capitalize(s: string) {
  return s[0].toUpperCase() + s.slice(1);
}

/** The little label on Bapu's bubble after a good move. */
function goodLabel(f: MoveFacts): string {
  if (isFork(f)) return 'Fork!';
  if (f.doubleCheck) return 'Double check!';
  if (f.discovered.length) return 'Discovered!';
  const line = f.lines.find((l) => l.by.square === f.to);
  if (line) return line.kind === 'pin' ? 'Pinned!' : 'Skewer!';
  return 'Good move';
}

/**
 * One guided or practice puzzle. Rules and checking live in PuzzleSession;
 * this component only sequences animations and Bapu's lines.
 */
export function PuzzlePlayer({ puzzle, mode, theme, onSolved, onContinue }: Props) {
  const copy = THEMES[theme];
  const [session] = useState(() => new PuzzleSession(puzzle));
  const [view, setView] = useState<View>({ fen: puzzle.fen, check: false, version: 0 });
  const [status, setStatus] = useState<Status>('intro');
  const [msg, setMsg] = useState<Message>({ id: 0, tone: 'neutral', text: 'Let’s see what your opponent does…' });
  const [shapes, setShapes] = useState<DrawShape[]>([]);
  const [shake, setShake] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [hintLevel, setHintLevel] = useState(0);

  // Read inside timers, so kept in a ref rather than state.
  const track = useRef({ mistakes: 0, hinted: false, revealed: false, offScript: false, played: [] as MoveFacts[] });
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const say = (tone: Tone, text: string, label?: string | null) =>
    setMsg((m) => ({ id: m.id + 1, tone, text, label }));

  const show = (fen: string, move?: Pick<Move, 'from' | 'to'>) =>
    setView((v) => ({
      fen,
      lastMove: move ? [move.from, move.to] : undefined,
      check: new Chess(fen).inCheck(),
      version: v.version + 1,
    }));

  // The opponent's first move, after a pause so the learner can take in the position.
  useEffect(() => {
    const t = window.setTimeout(() => {
      const m = session.start();
      show(session.fen, m);
      setStatus('solving');
      say('neutral', `${describeMove(m)} Your move: ${copy.prompt}`, null);
    }, OPPONENT_DELAY);
    return () => clearTimeout(t);
    // Runs once per puzzle; the component is keyed by puzzle id.
  }, []);

  function finish() {
    const t = track.current;
    setStatus('solved');
    // The hand-written explanation describes the intended line; a different mate gets its own words.
    const text = (!t.offScript && puzzle.explanation) || explainSolved(t.played, theme);
    say('good', text, t.revealed ? 'Here’s the idea' : t.mistakes ? 'Got there!' : 'Brilliant!');
    if (!t.revealed) vibrate(30);
    onSolved({ puzzleId: puzzle.id, firstTry: t.mistakes === 0, hintUsed: t.hinted, revealed: t.revealed });
  }

  /** Shows the solver's move, then (unless it was the last) the opponent's reply. */
  function applyPlayed(fenBefore: string, result: Played) {
    const t = track.current;
    const facts = moveFacts(fenBefore, result.move);
    t.played.push(facts);
    // No arrows on the final move: the piece often "forks" again there, which is noise.
    setShapes(result.kind !== 'solved' ? tacticArrows(facts) : []);
    setHintLevel(0);

    const afterMine = new Chess(fenBefore);
    afterMine.move(result.move.san);
    show(afterMine.fen(), result.move);

    if (result.kind === 'solved') return finish();

    setStatus('busy');
    if (!t.revealed) say('good', explainCorrect(facts, theme), goodLabel(facts));
    later(() => {
      show(session.fen, result.reply);
      if (t.revealed) later(revealNext, REPLY_DELAY);
      else setStatus('solving');
    }, REPLY_DELAY);
  }

  function onMove(from: Key, to: Key) {
    if (status !== 'solving') return;
    const fenBefore = session.fen;
    const uci = boardMoveToUci(session.position(), from, to);
    const expected = session.expected();
    const result = session.tryMove(uci);
    if (result.kind === 'solved' && uci !== expected) track.current.offScript = true;

    if (result.kind === 'illegal') return show(session.fen, session.lastMove);
    if (result.kind === 'wrong') {
      track.current.mistakes += 1;
      setMistakes(track.current.mistakes);
      say('bad', explainWrong(puzzle, uci, moveFacts(fenBefore, result.move), session.solverStep, theme));
      setShake((s) => s + 1);
      vibrate(120);
      show(session.fen, session.lastMove); // put the piece back
      return;
    }
    applyPlayed(fenBefore, result);
  }

  function revealNext() {
    if (session.done) return;
    const fenBefore = session.fen;
    const result = session.playSolution();
    if (result.kind === 'correct' || result.kind === 'solved') applyPlayed(fenBefore, result);
  }

  function showSolution() {
    track.current.revealed = true;
    setStatus('busy');
    setShapes([]);
    say('hint', 'No problem. Watch closely, I’ll play it for you.', 'Let me show you');
    later(revealNext, 600);
  }

  function hint() {
    const expected = session.expected();
    if (!expected) return;
    const { from, to } = parseUci(expected);
    const piece = session.position().get(from as never);
    const name = piece ? PIECE_NAME[piece.type] : 'piece';
    const level = Math.min(hintLevel + 1, 2);
    track.current.hinted = true;
    setHintLevel(level);

    if (level === 1) {
      setShapes([{ orig: from as Key, brush: 'yellow' }]);
      say(
        'hint',
        session.solverStep === 0 ? (puzzle.hint ?? copy.hint) : copy.followUp,
      );
    } else {
      setShapes([{ orig: from as Key, dest: to as Key, brush: 'yellow' }]);
      say('hint', `${capitalize(name)} to ${to}. Can you see why it works?`);
    }
  }

  const dests = useMemo(
    () => (status === 'solving' ? legalDests(session.position()) : undefined),
    [status, view.fen, session],
  );

  const canReveal = status === 'solving' && (mode === 'practice' ? mistakes >= 1 : mistakes >= 2);

  return (
    <div className="play">
      <div className="play-prompt">
        <span className={`side-dot side-${session.solver}`} aria-hidden="true" />
        <span>
          You play <strong>{session.solver === 'white' ? 'White' : 'Black'}</strong>
        </span>
        <span className={`play-mode play-mode-${mode}`}>{mode === 'guided' ? 'Guided' : 'Practice'}</span>
      </div>

      <Board
        fen={view.fen}
        version={view.version}
        orientation={session.solver}
        turnColor={session.turn}
        lastMove={view.lastMove}
        check={view.check}
        dests={dests}
        shapes={shapes}
        onMove={onMove}
        shake={shake}
      />

      <div className="play-talk">
        <BapuBubble key={msg.id} tone={msg.tone} label={msg.label}>
          {msg.text}
        </BapuBubble>
      </div>

      <div className="play-actions">
        {status === 'solved' ? (
          <button className="btn btn-good btn-block" onClick={onContinue}>
            Continue
          </button>
        ) : (
          <>
            {mode === 'guided' && (
              <button className="btn btn-ghost" onClick={hint} disabled={status !== 'solving' || hintLevel >= 2}>
                <Bulb size={18} /> Hint
              </button>
            )}
            {canReveal && (
              <button className="btn btn-ghost" onClick={showSolution}>
                Show solution
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
