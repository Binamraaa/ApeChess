import { useEffect, useRef, useState } from 'react';
import { BAPU } from '../../bapu/BapuBubble';
import { THEMES } from '../../bapu/themes';
import { ORDER } from '../../levels/curriculum';
import type { LevelScore } from '../../levels/scoring';
import { starsToPass } from '../../levels/unlock';
import type { LevelDef } from '../../levels/types';
import { saveLevelResult } from '../../progress/store';
import { play } from '../../sound/engine';
import { Bolt, Star } from '../icons';
import { formatTime } from '../format';

interface Props {
  level: LevelDef;
  score: LevelScore;
  /** Practice puzzle ids from this run, remembered so the next run picks fresh ones. */
  played: string[];
  /** Time taken, for timed levels. */
  seconds?: number;
  onDone: () => void;
  onNext?: () => void;
  onReplay: () => void;
}

/** Star n pops in at this delay (seconds); keep in step with the CSS animation below. */
const starDelay = (n: number) => n * 0.18;

/** Counts up to `target` once `delay` ms have passed. */
function useCountUp(target: number, delay: number, duration = 700) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const k = Math.min(Math.max((now - start) / duration, 0), 1);
      setValue(Math.round(target * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, delay, duration]);
  return value;
}

export function SummaryCard({ level, score, played, seconds, onDone, onNext, onReplay }: Props) {
  const headline = { 1: 'Level complete!', 2: 'Sharp moves!', 3: THEMES[level.theme].mastery }[score.stars];
  const entry = ORDER.find((l) => l.id === level.id);
  const passed = score.stars >= (entry ? starsToPass(entry) : 1);
  const saved = useRef(false);
  const [improved, setImproved] = useState(false);
  // Chime each star as it lands, then the fanfare, then count the XP in.
  const fanfareAt = (starDelay(score.stars) + 0.45) * 1000;
  const xp = useCountUp(score.totalXp, fanfareAt);

  useEffect(() => {
    const timers = [1, 2, 3]
      .filter((n) => n <= score.stars)
      .map((n) => window.setTimeout(() => play('star', { step: n - 1 }), (starDelay(n) + 0.3) * 1000));
    timers.push(window.setTimeout(() => play('complete'), fanfareAt));
    return () => timers.forEach(clearTimeout);
  }, [score.stars, fanfareAt]);

  useEffect(() => {
    if (saved.current) return;
    saved.current = true;
    saveLevelResult(level.id, score.stars, score.totalXp, new Date(), played)
      .then((r) => setImproved(r.improved && score.stars > 1))
      .catch((e) => console.error('Could not save progress', e));
  }, [level.id, score, played]);

  return (
    <div className="summary">
      <div className="summary-stars" aria-label={`${score.stars} of 3 stars`}>
        {[1, 2, 3].map((n) => (
          <span key={n} className={`summary-star ${n <= score.stars ? 'on' : ''}`} style={{ animationDelay: `${starDelay(n)}s` }}>
            <Star size={n === 2 ? 72 : 56} filled={n <= score.stars} />
          </span>
        ))}
      </div>

      <h1 className="summary-title">{headline}</h1>
      {improved && <p className="summary-best">New best!</p>}

      <div className="summary-stats">
        <div className="stat">
          <span className="stat-value">
            {score.firstTry}/{score.total}
          </span>
          <span className="stat-label">first try</span>
        </div>
        {seconds !== undefined && (
          <div className="stat">
            <span className="stat-value">{formatTime(seconds)}</span>
            <span className="stat-label">time</span>
          </div>
        )}
        <div className="stat stat-xp">
          <span className="stat-value">
            <Bolt size={20} /> +{xp}
          </span>
          <span className="stat-label">XP earned</span>
        </div>
      </div>

      <div className="rule-card">
        <img src={BAPU.head} alt="" width={44} height={44} />
        <div>
          <span className="rule-tag">Bapu’s rule</span>
          <p>{level.summary}</p>
        </div>
      </div>

      {score.stars < 3 && (
        <p className="summary-tip">
          {!passed
            ? `Checkpoints need ★★ to open the next level: get ${Math.ceil(score.total * 0.7)} of ${score.total} right on the first try.`
            : score.stars === 1
              ? `Get ${Math.ceil(score.total * 0.7)} of ${score.total} right on the first try for ★★.`
              : `Get ${Math.ceil(score.total * 0.9)} of ${score.total} on the first try, without hints, for ★★★.`}
        </p>
      )}

      <div className="play-actions">
        <button className="btn btn-ghost" onClick={onReplay}>
          Play again
        </button>
        {onNext && passed ? (
          <button className="btn btn-teal btn-block" onClick={onNext}>
            Next level
          </button>
        ) : (
          <button className="btn btn-teal btn-block" onClick={onDone}>
            Done
          </button>
        )}
      </div>
    </div>
  );
}
