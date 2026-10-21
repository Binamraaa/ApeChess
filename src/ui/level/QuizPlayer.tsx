import { useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import { Board } from '../../board/Board';
import { BapuBubble, type Tone } from '../../bapu/BapuBubble';
import { ANSWER_LABEL, explainQuiz, quizAnswer } from '../../bapu/quiz';
import { THEMES } from '../../bapu/themes';
import type { PuzzleOutcome } from '../../levels/scoring';
import type { PuzzleDef, QuizAnswer } from '../../levels/types';
import { Bulb } from '../icons';

interface Props {
  puzzle: PuzzleDef;
  mode: 'guided' | 'practice';
  onSolved: (outcome: PuzzleOutcome) => void;
  onContinue: () => void;
}

const CHOICES: QuizAnswer[] = ['check', 'mate', 'stalemate', 'none'];

/** Level 3: is it check, checkmate, stalemate, or none? */
export function QuizPlayer({ puzzle, mode, onSolved, onContinue }: Props) {
  const chess = useMemo(() => new Chess(puzzle.fen), [puzzle.fen]);
  const answer = quizAnswer(puzzle.fen);
  const side = chess.turn() === 'w' ? 'White' : 'Black';
  const [picked, setPicked] = useState<QuizAnswer | null>(null);
  const [hinted, setHinted] = useState(false);
  const [msg, setMsg] = useState<{ id: number; tone: Tone; text: string; label?: string | null }>({
    id: 0,
    tone: 'neutral',
    text: `${side} to move. Look at ${side}'s king: is it check, checkmate, stalemate, or none of these?`,
    label: null,
  });

  function choose(a: QuizAnswer) {
    if (picked) return;
    setPicked(a);
    const right = a === answer;
    const why = puzzle.explanation ?? explainQuiz(puzzle.fen);
    setMsg((m) => ({
      id: m.id + 1,
      tone: right ? 'good' : 'bad',
      // Every explanation opens with the right answer ("Check! ...", "Stalemate! ..."), so it reads well either way.
      text: why,
      label: right ? 'Spot on!' : 'Not quite',
    }));
    onSolved({ puzzleId: puzzle.id, firstTry: right, hintUsed: hinted, revealed: false });
  }

  return (
    <div className="play">
      <div className="play-prompt">
        <span className={`side-dot side-${chess.turn() === 'w' ? 'white' : 'black'}`} aria-hidden="true" />
        <span>
          <strong>{side}</strong> to move
        </span>
        <span className={`play-mode play-mode-${mode}`}>{mode === 'guided' ? 'Guided' : 'Practice'}</span>
      </div>

      <Board fen={puzzle.fen} orientation="white" turnColor={chess.turn() === 'w' ? 'white' : 'black'} check={chess.inCheck()} />

      <div className="play-talk">
        <BapuBubble key={msg.id} tone={msg.tone} label={msg.label}>
          {msg.text}
        </BapuBubble>
      </div>

      {picked ? (
        <div className="play-actions">
          <button className="btn btn-good btn-block" onClick={onContinue}>
            Continue
          </button>
        </div>
      ) : (
        <>
          <div className="quiz-grid">
            {CHOICES.map((a) => (
              <button key={a} className="btn quiz-btn" onClick={() => choose(a)}>
                {ANSWER_LABEL[a]}
              </button>
            ))}
          </div>
          {mode === 'guided' && (
            <div className="play-actions">
              <button
                className="btn btn-ghost"
                disabled={hinted}
                onClick={() => {
                  setHinted(true);
                  setMsg((m) => ({ id: m.id + 1, tone: 'hint', text: puzzle.hint ?? THEMES.quiz.hint, label: 'Hint' }));
                }}
              >
                <Bulb size={18} /> Hint
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
