import { BapuBubble, BAPU } from '../bapu/BapuBubble';
import { LEVELS, UNITS } from '../levels/curriculum';
import type { LevelProgress, Profile } from '../progress/store';
import { Bolt, Flame, Lock, Star } from './icons';
import './home.css';

interface Props {
  profile: Profile;
  streak: number;
  progress: Record<string, LevelProgress>;
  onStart: (levelId: string) => void;
}

// Until the other levels exist, Level 8 is the one to play.
const CURRENT = 'L08';

function Stars({ count, size = 18 }: { count: number; size?: number }) {
  return (
    <span className="stars" aria-label={`${count} of 3 stars`}>
      {[1, 2, 3].map((n) => (
        <Star key={n} size={size} filled={n <= count} className={n <= count ? 'star-on' : 'star-off'} />
      ))}
    </span>
  );
}

export function Home({ profile, streak, progress, onStart }: Props) {
  const level = LEVELS[CURRENT];
  const best = progress[CURRENT]?.bestStars ?? 0;
  const unit = UNITS.find((u) => u.number === level.unit)!;

  const greeting = !profile.started
    ? 'Hello, I’m Bapu! I won’t just tell you the right move. I’ll show you why it works.'
    : best === 3
      ? `Three stars! You’ve earned ${profile.xp} XP. More levels are on their way.`
      : `Welcome back! You’ve earned ${profile.xp} XP. Keep going!`;

  return (
    <div className="home">
      <header className="home-bar">
        <span className="wordmark">
          Ape<span>Chess</span>
        </span>
        <div className="chips">
          <span className={`chip chip-streak ${streak > 0 ? 'lit' : ''}`} title="Day streak">
            <Flame size={18} /> {streak}
          </span>
          <span className="chip chip-xp" title="Total XP">
            <Bolt size={18} /> {profile.xp}
          </span>
        </div>
      </header>

      <section className="hero">
        <div className="hero-arch">
          <img src={BAPU.portrait} alt="Bapu the ape, your chess coach" />
        </div>
        <BapuBubble label={profile.started ? null : 'Welcome to ApeChess!'}>{greeting}</BapuBubble>
      </section>

      <section className="lesson">
        <span className="lesson-unit">
          Unit {unit.number} · {unit.title}
        </span>
        <div className="lesson-head">
          <span className="lesson-badge" aria-hidden="true">
            {/* Same cburnett knight as on the board. */}
            <img src={`${import.meta.env.BASE_URL}pieces/wN.svg`} alt="" width={42} height={42} />
          </span>
          <div>
            <h2>
              Level {level.number}: {level.title}
            </h2>
            <p className="lesson-concept">{level.concept}</p>
          </div>
        </div>
        <div className="lesson-foot">
          <Stars count={best} />
          <span className="lesson-meta">10 puzzles · ~8 min</span>
        </div>
        <button className="btn btn-block btn-start" onClick={() => onStart(CURRENT)}>
          {best ? 'Play again' : profile.started ? `Continue Level ${level.number}` : 'Begin your journey'}
        </button>
      </section>

      <section className="path" aria-label={`Unit ${unit.number} levels`}>
        <h3>Your path</h3>
        <ol className="path-row">
          {unit.levels.map((l) => {
            const playable = Boolean(LEVELS[l.id]);
            const stars = progress[l.id]?.bestStars ?? 0;
            return (
              <li key={l.id} className={`node ${playable ? 'node-open' : 'node-locked'} ${l.id === CURRENT ? 'node-current' : ''}`}>
                <button
                  className="node-dot"
                  disabled={!playable}
                  onClick={() => onStart(l.id)}
                  aria-label={playable ? `Play level ${l.number}: ${l.title}` : `Level ${l.number}: ${l.title}, coming soon`}
                >
                  {playable ? l.number : <Lock size={16} />}
                </button>
                <span className="node-title">{l.title}</span>
                {playable && <Stars count={stars} size={12} />}
              </li>
            );
          })}
        </ol>
        <p className="path-note">More levels are being carved by hand. Bapu is very picky.</p>
      </section>
    </div>
  );
}
