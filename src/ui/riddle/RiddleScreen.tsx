import { useEffect, useState } from 'react';
import { BapuBubble, BAPU } from '../../bapu/BapuBubble';
import { riddleXp, untilNextRiddle } from '../../levels/riddle';
import { cleanRun, type PuzzleOutcome } from '../../levels/scoring';
import { displayStreak, getProfile, saveRiddleResult, type RiddleRecord } from '../../progress/store';
import { play } from '../../sound/engine';
import { formatCountdown } from '../format';
import { Bolt, Close, Flame } from '../icons';
import { PuzzlePlayer } from '../level/PuzzlePlayer';
import { useCountUp } from '../useCountUp';
import { loadTodaysRiddle, type TodaysRiddle } from './today';
import '../level/level.css';
import './riddle.css';

interface Props {
  onExit: () => void;
}

/** Today's riddle: play it, or see how it went if it's already solved. */
export function RiddleScreen({ onExit }: Props) {
  const [riddle, setRiddle] = useState<TodaysRiddle | null | undefined>(undefined);
  const [done, setDone] = useState<{ record: RiddleRecord; streak: number; extended: boolean } | null>(null);
  const [solvedNow, setSolvedNow] = useState(false);

  useEffect(() => {
    Promise.all([loadTodaysRiddle(), getProfile()])
      .then(([r, p]) => {
        setRiddle(r);
        if (r?.record.result) setDone({ record: r.record, streak: displayStreak(p), extended: false });
      })
      .catch((e) => {
        console.error('Could not load the riddle', e);
        setRiddle(null);
      });
  }, []);

  const solved = (outcome: PuzzleOutcome) => {
    if (!riddle) return;
    if (cleanRun([outcome])) play('solved');
    const before = getProfile().then(displayStreak);
    saveRiddleResult(riddle.record.day, outcome, riddleXp(outcome))
      .then(async (r) => {
        if (!r) return;
        const was = await before;
        const streak = displayStreak(r.profile);
        setDone({ record: r.riddle, streak, extended: streak > was });
      })
      .catch((e) => console.error('Could not save the riddle', e));
  };

  return (
    <div className="level riddle">
      <header className="level-bar">
        <button className="icon-btn" onClick={onExit} aria-label="Leave riddle">
          <Close size={22} />
        </button>
        <span className="riddle-title">{riddle ? `Bapu’s riddle #${riddle.number}` : 'Bapu’s riddle'}</span>
      </header>

      <main className="level-main">
        {riddle === null && (
          <div className="riddle-empty">
            <BapuBubble>My riddle book is closed today. Play a level and I’ll find you one!</BapuBubble>
            <button className="btn btn-teal btn-block" onClick={onExit}>
              Back home
            </button>
          </div>
        )}
        {riddle && done && (riddle.record.result || solvedNow) ? (
          <RiddleDone riddle={riddle} record={done.record} streak={done.streak} extended={done.extended} onExit={onExit} />
        ) : (
          riddle && (
            <PuzzlePlayer
              puzzle={riddle.puzzle}
              mode="riddle"
              theme={riddle.level.theme}
              onSolved={solved}
              onContinue={() => setSolvedNow(true)}
            />
          )
        )}
      </main>
    </div>
  );
}

const SIGN_OFF = [
  'Same time tomorrow? I’ll have a fresh one waiting, and it’s devious.',
  'That’s your brain warmed up for the day. Now, about that next level…',
  'One riddle a day keeps the blunders away. Mostly.',
  'Chess is a long walk. You just took today’s step.',
  'I’ll be polishing my spectacles and picking tomorrow’s. Don’t be late!',
];

function headline(r: NonNullable<RiddleRecord['result']>): string {
  if (r.revealed) return 'Now you know the trick';
  if (!r.firstTry) return 'Got there!';
  return r.hintUsed ? 'Solved, with a nudge' : 'Solved first try!';
}

interface DoneProps {
  riddle: TodaysRiddle;
  record: RiddleRecord;
  streak: number;
  extended: boolean;
  onExit: () => void;
}

function RiddleDone({ riddle, record, streak, extended, onExit }: DoneProps) {
  const result = record.result!;
  const xp = useCountUp(result.xp, 500);
  const [left, setLeft] = useState(() => untilNextRiddle(new Date()));

  useEffect(() => {
    play('complete');
    const t = window.setInterval(() => setLeft(untilNextRiddle(new Date())), 30_000);
    return () => clearInterval(t);
  }, []);

  const line = result.revealed
    ? 'Now you’ve seen the idea, it’ll jump out at you next time. See you tomorrow.'
    : SIGN_OFF[riddle.number % SIGN_OFF.length];

  return (
    <div className="summary riddle-done">
      <div className="riddle-medal" aria-hidden="true">
        <img src={BAPU.headLarge} alt="" width={120} height={120} />
        <span className="riddle-medal-no">#{riddle.number}</span>
      </div>
      <h1 className="summary-title">{headline(result)}</h1>
      <p className="riddle-from">
        From Level {riddle.level.number}: {riddle.level.title}
      </p>

      <div className="summary-stats">
        <div className="stat stat-xp">
          <span className="stat-value">
            <Bolt size={20} /> +{xp}
          </span>
          <span className="stat-label">XP earned</span>
        </div>
        <div className={`stat stat-streak ${extended ? 'grew' : ''}`}>
          <span className="stat-value">
            <Flame size={22} /> {streak}
          </span>
          <span className="stat-label">day streak</span>
        </div>
      </div>

      <BapuBubble label={null}>{line}</BapuBubble>

      <p className="riddle-next">Next riddle in {formatCountdown(left)}</p>

      <div className="play-actions">
        <button className="btn btn-teal btn-block" onClick={onExit}>
          Back home
        </button>
      </div>
    </div>
  );
}
