import { useEffect, useMemo, useState } from 'react';
import { Chess, type Move } from 'chess.js';
import type { DrawShape } from 'chessground/draw';
import type { Key } from 'chessground/types';
import { Board } from '../board/Board';
import { BAPU } from '../bapu/BapuBubble';
import { moveFacts } from '../bapu/explain';
import { LEVELS, UNITS } from '../levels/curriculum';
import { parseUci } from '../levels/puzzle';
import { canInstall, install, onInstallChange } from '../install';
import { Bolt, Bulb, Star } from './icons';
import { tacticArrows } from './level/shapes';
import './intro.css';

interface Props {
  /** Starts the learner at a level: Level 1 for beginners, further on for those who know the rules. */
  onStart: (startAt?: string) => void;
  /** Shown again from the home screen: a plain way back instead of the two starting doors. */
  returning?: boolean;
  onBack?: () => void;
}

/** Short captions for the knight-fork loop in the hero. */
const CAPTIONS = [
  'Black is about to make a tiny mistake…',
  'The bishop wanders off. Now look at c7.',
  'Knight to c7, check! It hits the king AND the rook.',
  'The king has to move…',
  '…and the rook is yours. That’s a fork.',
];

interface Frame {
  fen: string;
  move?: Move;
  shapes: DrawShape[];
  check: boolean;
}

/** The Level 8 demo, as frames for the looping hero board, with a caption for each. */
function useForkLoop(): Frame & { caption: string } {
  const frames = useMemo(() => {
    const demo = LEVELS.L08?.demo;
    if (!demo) return [];
    const chess = new Chess(demo.fen);
    const out: Frame[] = [{ fen: demo.fen, shapes: [], check: false }];
    demo.moves.forEach((uci, i) => {
      const before = chess.fen();
      const move = chess.move(parseUci(uci));
      const shapes = i === 1 ? tacticArrows(moveFacts(before, move)) : [];
      out.push({ fen: chess.fen(), move, shapes, check: chess.inCheck() });
    });
    return out;
  }, []);

  const still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [i, setI] = useState(still ? 2 : 0);
  useEffect(() => {
    if (still || frames.length === 0) return;
    const t = window.setInterval(() => setI((n) => (n + 1) % frames.length), 2400);
    return () => clearInterval(t);
  }, [frames.length, still]);
  const frame = frames[i] ?? { fen: '8/8/8/8/8/8/8/8', shapes: [], check: false };
  return { ...frame, caption: CAPTIONS[i] };
}

export function Intro({ onStart, returning, onBack }: Props) {
  const frame = useForkLoop();
  const [installable, setInstallable] = useState(canInstall());
  useEffect(() => onInstallChange(setInstallable), []);
  const levelCount = UNITS.reduce((n, u) => n + u.levels.length, 0);

  const doors = returning ? (
    <div className="intro-ctas">
      <button className="btn btn-block intro-cta" onClick={onBack}>
        Back to my lessons
      </button>
    </div>
  ) : (
    <div className="intro-ctas">
      <button className="btn btn-block intro-cta" onClick={() => onStart()}>
        I’m new to chess
      </button>
      <button className="btn btn-ghost btn-block" onClick={() => onStart('L05')}>
        I know how the pieces move
      </button>
    </div>
  );

  return (
    <div className="intro">
      <header className="intro-bar">
        <span className="wordmark">
          Ape<span>Chess</span>
        </span>
        {installable && (
          <button className="btn btn-ghost intro-install" onClick={() => install()}>
            Install app
          </button>
        )}
      </header>

      <section className="intro-hero">
        <div className="intro-copy">
          <span className="intro-kicker">Free chess lessons, with Bapu</span>
          <h1>
            Don’t just find the move. <em>Know why it works.</em>
          </h1>
          <p className="intro-lead">
            Bapu is an ape in a suit who explains chess the way a good friend would. Short lessons, real puzzles, and after
            every move, the reason it works (or why it doesn’t).
          </p>
          {doors}
          <p className="intro-small">No account. No ads. Works offline.</p>
        </div>

        <div className="intro-show" aria-hidden="true">
          <div className="intro-board">
            <Board
              fen={frame.fen}
              orientation="white"
              turnColor="white"
              lastMove={frame.move ? [frame.move.from as Key, frame.move.to as Key] : undefined}
              check={frame.check}
              shapes={frame.shapes}
            />
          </div>
          <div className="intro-says">
            <img src={BAPU.head} alt="" width={52} height={52} />
            <p key={frame.caption}>{frame.caption}</p>
          </div>
        </div>
      </section>

      <section className="intro-points">
        <article>
          <span className="intro-icon">
            <Bulb size={26} />
          </span>
          <h2>The why, every time</h2>
          <p>Right or wrong, Bapu tells you what your move really did: the fork, the pin, the piece you left hanging.</p>
        </article>
        <article>
          <span className="intro-icon">
            <Bolt size={26} />
          </span>
          <h2>Five-minute lessons</h2>
          <p>One idea per level: a demo, a few guided puzzles, then practice. Stars, XP and a daily streak keep you coming back.</p>
        </article>
        <article>
          <span className="intro-icon">
            <Star size={26} />
          </span>
          <h2>Free, for everyone</h2>
          <p>Open source, no account, no ads. Add it to your home screen and it works without internet.</p>
        </article>
      </section>

      <section className="intro-path">
        <h2>
          From “how does the knight move?” to <em>checkmate in two</em>
        </h2>
        <ol>
          {UNITS.map((u) => (
            <li key={u.number}>
              <span className="intro-unit">Unit {u.number}</span>
              <strong>{u.title}</strong>
              <span className="intro-levels">
                {u.levels.slice(0, 3).map((l) => l.title).join(' · ')}
                {u.levels.length > 3 ? '…' : ''}
              </span>
            </li>
          ))}
        </ol>
        <p className="intro-small">{levelCount} levels, with hundreds of hand-picked puzzles from the Lichess community.</p>
      </section>

      <section className="intro-final">
        <img src={BAPU.portrait} alt="Bapu the ape, in a suit and glasses" />
        <div>
          <h2>Ready when you are.</h2>
          <p>Bapu has his glasses on.</p>
          {doors}
        </div>
      </section>

      <footer className="intro-foot">
        <span>Free and open source (GPL-3.0)</span>
        <span>Puzzles from the Lichess database</span>
        <a href="https://github.com/Binamraaa/ApeChess" target="_blank" rel="noreferrer">
          Source on GitHub
        </a>
      </footer>
    </div>
  );
}
