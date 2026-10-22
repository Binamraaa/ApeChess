import { useEffect, useRef, useState } from 'react';
import { BAPU } from '../../bapu/BapuBubble';
import { THEMES } from '../../bapu/themes';
import { LEVELS, ORDER, UNITS } from '../../levels/curriculum';
import { rankFor } from '../../levels/notebook';
import { levelShareText } from '../../levels/share';
import type { LevelScore, PuzzleOutcome } from '../../levels/scoring';
import { starsToPass } from '../../levels/unlock';
import type { LevelDef } from '../../levels/types';
import { getAllLevelProgress, recordReview, saveLevelResult } from '../../progress/store';
import { localDay } from '../../progress/streak';
import { play } from '../../sound/engine';
import { Bolt, Star } from '../icons';
import { formatTime } from '../format';
import { useCountUp } from '../useCountUp';
import { APP_URL, ShareButton } from '../ShareButton';

interface Props {
  level: LevelDef;
  score: LevelScore;
  /** Practice puzzle ids from this run, remembered so the next run picks fresh ones. */
  played: string[];
  /** Time taken, for timed levels. */
  seconds?: number;
  outcomes: PuzzleOutcome[];
  /** Puzzles missed this run (they come back as rematches) and solved first try. */
  review: { missed: string[]; solved: string[] };
  onDone: () => void;
  onNext?: () => void;
  onReplay: () => void;
}

/** Star n pops in at this delay (seconds); keep in step with the CSS animation below. */
const starDelay = (n: number) => n * 0.18;

export function SummaryCard({ level, score, played, seconds, outcomes, review, onDone, onNext, onReplay }: Props) {
  const headline = { 1: 'Level complete!', 2: 'Sharp moves!', 3: THEMES[level.theme].mastery }[score.stars];
  const entry = ORDER.find((l) => l.id === level.id);
  const passed = score.stars >= (entry ? starsToPass(entry) : 1);
  const saved = useRef(false);
  const [improved, setImproved] = useState(false);
  const [news, setNews] = useState<{ rank?: string; page: boolean; freeze: boolean }>({ page: false, freeze: false });
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
    const now = new Date();
    saveLevelResult(level.id, score.stars, score.totalXp, now, played)
      .then(async (r) => {
        setImproved(r.improved && score.stars > 1);
        const best = Object.fromEntries((await getAllLevelProgress()).map((l) => [l.id, l.bestStars as number]));
        const after = rankFor(UNITS, LEVELS, (id) => best[id] ?? 0);
        const before = rankFor(UNITS, LEVELS, (id) => (id === level.id ? r.prevBest : (best[id] ?? 0)));
        setNews({ rank: after.units > before.units ? after.title : undefined, page: r.prevBest === 0, freeze: r.freezeEarned });
      })
      .catch((e) => console.error('Could not save progress', e));
    recordReview(level.id, review.missed, review.solved, localDay(now)).catch(() => {});
  }, [level.id, score, played, review]);

  // A new rank gets its own chime once the fanfare is done.
  useEffect(() => {
    if (!news.rank) return;
    const t = window.setTimeout(() => play('solved', { step: 4 }), fanfareAt + 1600);
    return () => clearTimeout(t);
  }, [news.rank, fanfareAt]);

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

      {(news.rank || news.page || news.freeze) && (
        <ul className="summary-news">
          {news.rank && (
            <li className="news-rank">
              <span aria-hidden="true">🎖️</span> New rank: <strong>{news.rank}</strong>
            </li>
          )}
          {news.page && (
            <li>
              <span aria-hidden="true">📖</span> This rule is now a page in <a href="#/notebook">Bapu’s notebook</a>.
            </li>
          )}
          {news.freeze && (
            <li>
              <span aria-hidden="true">❄️</span> You earned a streak freeze: miss a day and your streak survives.
            </li>
          )}
        </ul>
      )}

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
        <ShareButton
          text={() => levelShareText({ number: level.number, title: level.title, stars: score.stars, outcomes, seconds, url: APP_URL })}
        />
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
