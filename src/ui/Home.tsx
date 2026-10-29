// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Binamra Bhusal

import { BapuBubble, BAPU } from '../bapu/BapuBubble';
import { LEVELS, ORDER, UNITS, type MapEntry, type UnitInfo } from '../levels/curriculum';
import { currentLevel } from '../levels/unlock';
import type { LevelProgress, Profile } from '../progress/store';
import { useState, useSyncExternalStore } from 'react';
import { getAccount, onAccount } from '../progress/cloud';
import { Bolt, Book, Cloud, Close, Flame, Lock, Star } from './icons';
import { notebookPages, rankFor } from '../levels/notebook';
import { SoundSettings } from './SoundSettings';
import { untilNextRiddle } from '../levels/riddle';
import { formatCountdown } from './format';
import type { TodaysRiddle } from './riddle/today';
import './home.css';

interface Props {
  profile: Profile;
  streak: number;
  progress: Record<string, LevelProgress>;
  /** Levels the learner may play. */
  open: Set<string>;
  /** Today's riddle, if there is one. */
  riddle: TodaysRiddle | null;
  /** True if the streak is alive but nothing's been played today. */
  streakAtRisk: boolean;
  onStart: (levelId: string) => void;
  onRiddle: () => void;
  onNotebook: () => void;
  onBackup: () => void;
}

const NUDGE_KEY = 'apechess.backupNudge';

/** Offers cloud backup once the learner has something worth keeping (two levels passed), until it's waved off. */
function useBackupNudge(passed: number): [boolean, () => void] {
  const account = useSyncExternalStore(onAccount, getAccount);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(NUDGE_KEY) === 'no';
    } catch {
      return false;
    }
  });
  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(NUDGE_KEY, 'no');
    } catch {
      // Private mode: it just comes back next time.
    }
  };
  return [account.status === 'signed-out' && passed >= 2 && !dismissed, dismiss];
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

export function Home({ profile, streak, progress, open, riddle, streakAtRisk, onStart, onRiddle, onNotebook, onBackup }: Props) {
  const best = (id: string) => progress[id]?.bestStars ?? 0;
  const currentId = currentLevel(ORDER, open, best, profile.startAt)!;
  const level = LEVELS[currentId];
  const unit = UNITS.find((u) => u.number === level.unit)!;
  const allDone = ORDER.filter((l) => LEVELS[l.id]).every((l) => best(l.id) > 0);

  const riddleOpen = riddle && !riddle.record.result;
  const freezes = profile.streak.freezes ?? 0;
  const pages = notebookPages(UNITS, LEVELS, best);
  const rank = rankFor(UNITS, LEVELS, best);
  const [nudge, dismissNudge] = useBackupNudge(Object.values(progress).filter((l) => l.bestStars > 0).length);
  const greeting = !profile.started
    ? 'Hello, I’m Bapu! I won’t just tell you the right move. I’ll show you why it works.'
    : streakAtRisk && riddleOpen
      ? `Your ${streak}-day streak needs one puzzle today. My riddle will do nicely!`
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
          <span
            className={`chip chip-streak ${streak > 0 ? 'lit' : ''}`}
            title={freezes ? `Day streak · ${freezes} streak freeze${freezes > 1 ? 's' : ''}` : 'Day streak'}
          >
            <Flame size={18} /> {streak}
            {freezes > 0 && (
              <span className="chip-freeze" aria-label={`${freezes} streak freeze${freezes > 1 ? 's' : ''}`}>
                ❄{freezes > 1 ? freezes : ''}
              </span>
            )}
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

      {riddle && profile.started && <RiddleCard riddle={riddle} streak={streak} streakAtRisk={streakAtRisk} onOpen={onRiddle} />}

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
          <span className="lesson-meta">{level.game ? 'One full game · ~25 min' : '10 puzzles · ~8 min'}</span>
        </div>
        <button className="btn btn-block btn-start" onClick={() => onStart(currentId)}>
          {!profile.started ? 'Begin your journey' : best(currentId) ? 'Play again' : `Start Level ${level.number}`}
        </button>
      </section>

      {profile.started && (
        <button className="notebook-card" onClick={onNotebook}>
          <span className="notebook-icon" aria-hidden="true">
            <Book size={26} />
          </span>
          <span className="riddle-text">
            <strong>Bapu’s notebook</strong>
            <small>
              {pages.filter((p) => p.earned).length} of {pages.length} pages · Rank: {rank.title}
            </small>
          </span>
        </button>
      )}

      {nudge && (
        <div className="backup-card">
          <button className="backup-open" onClick={onBackup}>
            <span className="backup-icon" aria-hidden="true">
              <Cloud size={24} />
            </span>
            <span className="riddle-text">
              <strong>Keep your progress safe</strong>
              <small>Back up your stars with your email, and play on any device.</small>
            </span>
          </button>
          <button className="icon-btn backup-close" onClick={dismissNudge} aria-label="Not now">
            <Close size={18} />
          </button>
        </div>
      )}

      <section className="map" aria-label="All levels">
        <h3>Your path</h3>
        {UNITS.map((u) => (
          <UnitPath key={u.number} unit={u} best={best} open={open} currentId={currentId} onStart={onStart} />
        ))}
        <p className="path-note">More levels are being carved by hand. Bapu is very picky.</p>
      </section>

      <footer className="home-foot">
        Free and open source under AGPL-3.0 ·{' '}
        <a href="https://github.com/Binamraaa/ApeChess" target="_blank" rel="noreferrer">
          Source code
        </a>
      </footer>
    </div>
  );
}

function RiddleCard({ riddle, streak, streakAtRisk, onOpen }: { riddle: TodaysRiddle; streak: number; streakAtRisk: boolean; onOpen: () => void }) {
  const result = riddle.record.result;
  const note = result
    ? `${result.revealed ? 'Seen' : result.firstTry ? 'Solved first try' : 'Solved'} · +${result.xp} XP · next in ${formatCountdown(untilNextRiddle(new Date()))}`
    : streakAtRisk
      ? `Solve it to keep your ${streak}-day streak.`
      : 'One puzzle a day. It only takes a minute.';
  return (
    <button className={`riddle-card ${result ? 'solved' : ''}`} onClick={onOpen}>
      <span className="riddle-icon" aria-hidden="true">
        {result ? '✓' : '?'}
      </span>
      <span className="riddle-text">
        <span className="riddle-tag">Daily riddle #{riddle.number}</span>
        <strong>{result ? 'Riddle solved' : riddle.record.rematch ? 'A rematch with a puzzle you missed' : 'Bapu has a riddle for you'}</strong>
        <small>{note}</small>
      </span>
      {!result && <span className="riddle-go">Solve</span>}
    </button>
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
