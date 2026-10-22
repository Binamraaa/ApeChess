import { BapuBubble, BAPU } from '../bapu/BapuBubble';
import { LEVELS, ORDER, UNITS, type MapEntry, type UnitInfo } from '../levels/curriculum';
import { currentLevel } from '../levels/unlock';
import type { LevelProgress, Profile } from '../progress/store';
import { Bolt, Flame, Lock, Star } from './icons';
import { SoundSettings } from './SoundSettings';
import './home.css';

interface Props {
  profile: Profile;
  streak: number;
  progress: Record<string, LevelProgress>;
  /** Levels the learner may play. */
  open: Set<string>;
  onStart: (levelId: string) => void;
}

const pieceIcon = (icon: string) => `${import.meta.env.BASE_URL}pieces/${icon}.svg`;

function Stars({ count, size = 18 }: { count: number; size?: number }) {
  return (
    <span className="stars" aria-label={`${count} of 3 stars`}>
      {[1, 2, 3].map((n) => (
        <Star key={n} size={size} filled={n <= count} className={n <= count ? 'star-on' : 'star-off'} />
      ))}
    </span>
  );
}

export function Home({ profile, streak, progress, open, onStart }: Props) {
  const best = (id: string) => progress[id]?.bestStars ?? 0;
  const currentId = currentLevel(ORDER, open, best, profile.startAt)!;
  const level = LEVELS[currentId];
  const unit = UNITS.find((u) => u.number === level.unit)!;
  const allDone = ORDER.filter((l) => LEVELS[l.id]).every((l) => best(l.id) > 0);

  const greeting = !profile.started
    ? 'Hello, I’m Bapu! I won’t just tell you the right move. I’ll show you why it works.'
    : allDone
      ? `You’ve played every level so far, and earned ${profile.xp} XP. Go for three stars while I carve new ones!`
      : `Welcome back! You’ve earned ${profile.xp} XP. Ready for the next one?`;

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
          <SoundSettings />
        </div>
      </header>

      <section className="hero">
        <a className="hero-arch" href="#/welcome" aria-label="About ApeChess">
          <img src={BAPU.portrait} alt="Bapu the ape, your chess coach" />
        </a>
        <BapuBubble label={profile.started ? null : 'Welcome to ApeChess!'}>{greeting}</BapuBubble>
      </section>

      <section className="lesson" aria-label="Up next">
        <span className="lesson-unit">
          Up next · Unit {unit.number}: {unit.title}
        </span>
        <div className="lesson-head">
          <span className="lesson-badge" aria-hidden="true">
            <img src={pieceIcon(level.icon)} alt="" width={42} height={42} />
          </span>
          <div>
            <h2>
              Level {level.number}: {level.title}
            </h2>
            <p className="lesson-concept">{level.concept}</p>
          </div>
        </div>
        <div className="lesson-foot">
          <Stars count={best(currentId)} />
          <span className="lesson-meta">10 puzzles · ~8 min</span>
        </div>
        <button className="btn btn-block btn-start" onClick={() => onStart(currentId)}>
          {!profile.started ? 'Begin your journey' : best(currentId) ? 'Play again' : `Start Level ${level.number}`}
        </button>
      </section>

      <section className="map" aria-label="All levels">
        <h3>Your path</h3>
        {UNITS.map((u) => (
          <UnitPath key={u.number} unit={u} best={best} open={open} currentId={currentId} onStart={onStart} />
        ))}
        <p className="path-note">More levels are being carved by hand. Bapu is very picky.</p>
      </section>
    </div>
  );
}

/** Nodes wind left and right down the page; the pattern repeats, so a unit can hold any number of levels. */
const SWING = [0, 24, 32, 24, 0, -24, -32, -24];
const ROW = 96;

type NodeState = 'done' | 'current' | 'open' | 'locked' | 'soon';

function nodeState(l: MapEntry, best: number, open: Set<string>, currentId: string): NodeState {
  if (!LEVELS[l.id]) return 'soon';
  if (l.id === currentId) return 'current';
  if (!open.has(l.id)) return 'locked';
  return best > 0 ? 'done' : 'open';
}

interface UnitProps {
  unit: UnitInfo;
  best: (id: string) => number;
  open: Set<string>;
  currentId: string;
  onStart: (id: string) => void;
}

function UnitPath({ unit, best, open, currentId, onStart }: UnitProps) {
  const built = unit.levels.filter((l) => LEVELS[l.id]);
  const earned = built.reduce((n, l) => n + best(l.id), 0);
  const xs = unit.levels.map((_, i) => 50 + SWING[i % SWING.length]);
  const height = unit.levels.length * ROW;

  // One curve per gap between nodes; it turns solid once the learner has passed the level above it.
  const segments = xs.slice(1).map((x, i) => {
    const [y0, y1] = [i * ROW + ROW / 2, (i + 1) * ROW + ROW / 2];
    const d = `M ${xs[i]} ${y0} C ${xs[i]} ${y0 + ROW / 2}, ${x} ${y1 - ROW / 2}, ${x} ${y1}`;
    return { d, done: best(unit.levels[i].id) > 0 };
  });

  return (
    <div className="unit">
      <div className="unit-banner">
        <span className="unit-number">Unit {unit.number}</span>
        <span className="unit-title">{unit.title}</span>
        {built.length > 0 && (
          <span className="unit-stars">
            <Star size={14} filled className="star-on" /> {earned}/{built.length * 3}
          </span>
        )}
      </div>

      <div className="unit-path" style={{ height }}>
        <svg className="trail" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden="true">
          {segments.map((s, i) => (
            <path key={i} d={s.d} className={s.done ? 'trail-done' : ''} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        <ol className="nodes">
        {unit.levels.map((l, i) => {
          const state = nodeState(l, best(l.id), open, currentId);
          const playable = state !== 'locked' && state !== 'soon';
          const level = LEVELS[l.id];
          const side = xs[i] > 50 ? 'left' : 'right';
          const label =
            state === 'soon'
              ? `Level ${l.number}: ${l.title}, coming soon`
              : state === 'locked'
                ? `Level ${l.number}: ${l.title}, locked`
                : `Play level ${l.number}: ${l.title}`;
          return (
            <li
              key={l.id}
              className={`node node-${state} node-label-${side}`}
              style={{ top: i * ROW, left: `${xs[i]}%` }}
            >
              <button className="node-dot" disabled={!playable} onClick={() => onStart(l.id)} aria-label={label}>
                {state === 'locked' ? (
                  <Lock size={20} />
                ) : level ? (
                  <img src={pieceIcon(level.icon)} alt="" width={34} height={34} />
                ) : (
                  <span className="node-num">{l.number}</span>
                )}
              </button>
              <span className="node-text">
                <span className="node-title">
                  {l.number}. {l.title}
                </span>
                {state === 'soon' ? (
                  <span className="node-tag-soon">Coming soon</span>
                ) : state === 'current' ? (
                  <span className="node-go">{best(l.id) ? 'Play again' : 'Start here'}</span>
                ) : (
                  playable && <Stars count={best(l.id)} size={12} />
                )}
              </span>
            </li>
          );
        })}
        </ol>
      </div>
    </div>
  );
}
