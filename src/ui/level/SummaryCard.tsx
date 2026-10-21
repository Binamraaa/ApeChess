import { useEffect, useRef, useState } from 'react';
import { BAPU } from '../../bapu/BapuBubble';
import type { LevelScore } from '../../levels/scoring';
import type { LevelDef } from '../../levels/types';
import { saveLevelResult } from '../../progress/store';
import { Bolt, Star } from '../icons';

const HEADLINE = { 1: 'Level complete!', 2: 'Sharp moves!', 3: 'Fork master!' } as const;

interface Props {
  level: LevelDef;
  score: LevelScore;
  onDone: () => void;
  onReplay: () => void;
}

export function SummaryCard({ level, score, onDone, onReplay }: Props) {
  const saved = useRef(false);
  const [improved, setImproved] = useState(false);

  useEffect(() => {
    if (saved.current) return;
    saved.current = true;
    saveLevelResult(level.id, score.stars, score.totalXp)
      .then((r) => setImproved(r.improved && score.stars > 1))
      .catch((e) => console.error('Could not save progress', e));
  }, [level.id, score]);

  return (
    <div className="summary">
      <div className="summary-stars" aria-label={`${score.stars} of 3 stars`}>
        {[1, 2, 3].map((n) => (
          <span key={n} className={`summary-star ${n <= score.stars ? 'on' : ''}`} style={{ animationDelay: `${n * 0.18}s` }}>
            <Star size={n === 2 ? 72 : 56} filled={n <= score.stars} />
          </span>
        ))}
      </div>

      <h1 className="summary-title">{HEADLINE[score.stars]}</h1>
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
        <button className="btn btn-teal btn-block" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}
