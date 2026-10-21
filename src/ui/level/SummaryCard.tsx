import { useEffect, useRef, useState } from 'react';
import { BAPU } from '../../bapu/BapuBubble';
import { THEMES } from '../../bapu/themes';
import { ORDER } from '../../levels/curriculum';
import type { LevelScore } from '../../levels/scoring';
import { starsToPass } from '../../levels/unlock';
import type { LevelDef } from '../../levels/types';
import { saveLevelResult } from '../../progress/store';
import { Bolt, Star } from '../icons';

interface Props {
  level: LevelDef;
  score: LevelScore;
  /** Practice puzzle ids from this run, remembered so the next run picks fresh ones. */
  played: string[];
  onDone: () => void;
  onNext?: () => void;
  onReplay: () => void;
}

export function SummaryCard({ level, score, played, onDone, onNext, onReplay }: Props) {
  const headline = { 1: 'Level complete!', 2: 'Sharp moves!', 3: THEMES[level.theme].mastery }[score.stars];
  const entry = ORDER.find((l) => l.id === level.id);
  const passed = score.stars >= (entry ? starsToPass(entry) : 1);
  const saved = useRef(false);
  const [improved, setImproved] = useState(false);

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
          <span key={n} className={`summary-star ${n <= score.stars ? 'on' : ''}`} style={{ animationDelay: `${n * 0.18}s` }}>
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
        <div className="stat stat-xp">
          <span className="stat-value">
            <Bolt size={20} /> +{score.totalXp}
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
          {score.stars === 1
            ? 'Get 7 of 10 right on the first try for ★★.'
            : 'Get 9 of 10 on the first try, without hints, for ★★★.'}
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
