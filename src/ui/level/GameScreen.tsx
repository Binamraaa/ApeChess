// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Binamra Bhusal

import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Color } from 'chess.js';
import type { Key } from 'chessground/types';
import { Board } from '../../board/Board';
import { boardMoveToUci, legalDests } from '../../board/dests';
import { BAPU, BapuBubble, type Tone } from '../../bapu/BapuBubble';
import { bapuMoveLine, explainMoment, gameHeadline, gameVerdict, replyLine } from '../../bapu/game';
import { engine, type SearchResult } from '../../engine/stockfish';
import {
  acceptsDraw,
  colorFor,
  drawReason,
  isClear,
  learnerMoves,
  outcomeOf,
  positions,
  rematchPuzzles,
  replay,
  scoreGame,
  verdict,
  worstMoments,
  type GameConfig,
  type Judged,
  type Outcome,
  type SavedGame,
} from '../../levels/game';
import { parseUci } from '../../levels/puzzle';
import { gameShareText } from '../../levels/share';
import type { Stars } from '../../levels/scoring';
import type { LevelDef } from '../../levels/types';
import { finishGame, getGames, markStarted, saveGame } from '../../progress/store';
import { localDay } from '../../progress/streak';
import { Bolt, Close, Star } from '../icons';
import { useCountUp } from '../useCountUp';
import { APP_URL, ShareButton } from '../ShareButton';
import { NewsList, starDelay, useLevelSave, useStarSounds } from './SummaryCard';
import './level.css';
import './game.css';

/** How deep the full-strength engine looks when it judges the learner's moves. */
const JUDGE_DEPTH = 12;
/** Bapu thinks for this long, and never answers faster than `MIN_THINK`, so he feels like a person. */
const THINK_MS = 900;
const MIN_THINK = 1200;

const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, '0')).join('');
const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
const side = (c: Color) => (c === 'w' ? 'white' : 'black');
const toKeys = (uci: string): [Key, Key] => [uci.slice(0, 2) as Key, uci.slice(2, 4) as Key];

interface Ending {
  outcome: Outcome;
  game: SavedGame;
  /** For a draw: why. */
  reason?: string;
}

/** Level 21, the final round: a whole game against Bapu, then his review of it. */
export function GameScreen({ level, onExit }: { level: LevelDef; onExit: () => void }) {
  const config = level.game!;
  const [loaded, setLoaded] = useState<{ current?: SavedGame; color: Color } | null>(null);
  const [game, setGame] = useState<SavedGame | null>(null);
  const [ending, setEnding] = useState<Ending | null>(null);
  /** Learner moves and plies so far, for the header. */
  const [count, setCount] = useState({ moves: 0, plies: 0 });

  const load = () =>
    getGames()
      .catch(() => ({ played: 0, finished: [], current: undefined }))
      .then((g) => setLoaded({ current: g.current, color: g.current?.color ?? colorFor(g.played) }));

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [game, ending]);

  const start = (current?: SavedGame) => {
    markStarted().catch(() => {});
    const fresh: SavedGame = { id: newId(), color: loaded!.color, moves: [], judged: [], updated: new Date().toISOString() };
    setGame(current ?? fresh);
    const g = current ?? fresh;
    setCount({ moves: learnerMoves(g.moves, g.color), plies: g.moves.length });
  };

  const end = (e: Ending) => {
    const day = localDay(new Date());
    finishGame(e.game.id, level.id, rematchPuzzles(e.game.id, e.game.moves, e.game.judged), day).catch(() => {});
    setEnding(e);
  };

  const playAgain = () => {
    setEnding(null);
    setGame(null);
    setLoaded(null);
    load();
  };

  const label = ending ? 'Game over' : game ? `Move ${Math.floor(count.plies / 2) + 1}` : 'Final';
  const filled = ending ? 1 : Math.min(count.moves / config.minMoves, 1);

  return (
    <div className="level">
      <header className="level-bar">
        <button className="icon-btn" onClick={onExit} aria-label={game && !ending ? 'Leave the game (it’s saved)' : 'Leave'}>
          <Close size={22} />
        </button>
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(filled * 100)}>
          <div className="progress-fill" style={{ width: `${Math.max(filled * 100, 4)}%` }} />
        </div>
        <span className="level-phase">{label}</span>
      </header>

      <main className="level-main">
        {!game && loaded && <GameIntro level={level} config={config} color={loaded.color} saved={loaded.current} onStart={start} />}
        {game && !ending && <GamePlay key={game.id} start={game} config={config} onMoves={setCount} onEnd={end} />}
        {ending && <GameSummary level={level} config={config} ending={ending} onDone={onExit} onReplay={playAgain} />}
      </main>
    </div>
  );
}

function GameIntro({
  level,
  config,
  color,
  saved,
  onStart,
}: {
  level: LevelDef;
  config: GameConfig;
  color: Color;
  saved?: SavedGame;
  onStart: (saved?: SavedGame) => void;
}) {
  return (
    <div className="concept">
      <div className="concept-portrait">
        <img src={BAPU.portrait} alt="Bapu the ape, in a suit and glasses" />
        <span className="concept-level">Level {level.number}</span>
      </div>

      <div className="concept-body">
        <h1>{level.title}</h1>
        <blockquote className="concept-quote">“{level.concept}”</blockquote>

        <ul className="game-rules" aria-label="How the stars work">
          <li>
            <StarRow n={1} /> Last {config.minMoves} moves without resigning
          </li>
          <li>
            <StarRow n={2} /> …with two blunders or fewer
          </li>
          <li>
            <StarRow n={3} /> …with no blunders at all, or hold me to a draw
          </li>
        </ul>

        {level.glossary && (
          <div className="glossary">
            <span className="glossary-tag">New word</span>
            <p>
              <strong>{level.glossary.term}:</strong> {level.glossary.definition}
            </p>
          </div>
        )}

        <p className="game-note">
          I play at about {config.elo}, like a strong club player. No take-backs, but there’s no clock either: take all the time
          you need. Leave whenever you like; I’ll keep the board just as it is.
        </p>
      </div>

      <div className="play-actions">
        {saved ? (
          <button className="btn btn-block" onClick={() => onStart(saved)}>
            Continue your game (move {Math.floor(saved.moves.length / 2) + 1})
          </button>
        ) : (
          <button className="btn btn-block" onClick={() => onStart()}>
            Play as {color === 'w' ? 'White' : 'Black'}
          </button>
        )}
      </div>
      {!saved && <p className="game-colour">{color === 'w' ? 'White moves first.' : 'I move first this time.'} We swap colours every game.</p>}
    </div>
  );
}

function StarRow({ n }: { n: number }) {
  return (
    <span className="game-stars" aria-label={`${n} star${n > 1 ? 's' : ''}`}>
      {[1, 2, 3].map((i) => (
        <Star key={i} size={14} filled={i <= n} className={i <= n ? 'star-on' : 'star-off'} />
      ))}
    </span>
  );
}

interface PlayProps {
  start: SavedGame;
  config: GameConfig;
  onMoves: (count: { moves: number; plies: number }) => void;
  onEnd: (e: Ending) => void;
}

function GamePlay({ start, config, onMoves, onEnd }: PlayProps) {
  const learner = start.color;
  const [game, setGame] = useState(start);
  const [busy, setBusy] = useState(true);
  const [stuck, setStuck] = useState(false);
  const [resigning, setResigning] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [version, setVersion] = useState(0);
  const [msg, setMsg] = useState<{ id: number; tone: Tone; text: string; label?: string | null }>({
    id: 0,
    tone: 'neutral',
    text: start.moves.length ? 'Welcome back. The board is just as you left it.' : learner === 'w' ? 'Good luck! Your move.' : 'Good luck! Let me start.',
    label: null,
  });
  const say = (tone: Tone, text: string, label?: string | null) => setMsg((m) => ({ id: m.id + 1, tone, text, label }));

  const gameRef = useRef(start);
  const live = useRef(true);
  const began = useRef(false);
  /** Set once the game has ended, so a reply still on its way is dropped. */
  const over = useRef(false);
  /** The engine's view of the position the learner is thinking about. */
  const pending = useRef<Promise<SearchResult> | null>(null);

  const chess = useMemo(() => replay(game.moves), [game.moves]);
  const n = learnerMoves(game.moves, learner);
  const blunders = game.judged.filter((j) => verdict(j) === 'blunder').length;
  const last = game.moves.length ? toKeys(game.moves[game.moves.length - 1]) : undefined;

  const commit = (g: SavedGame) => {
    gameRef.current = g;
    setGame(g);
    onMoves({ moves: learnerMoves(g.moves, learner), plies: g.moves.length });
    saveGame(g).catch(() => {});
  };

  const judge = (fen: string) => {
    const p = engine().search(fen, { depth: JUDGE_DEPTH });
    p.catch(() => undefined); // read later; a failure only means this move goes unjudged
    pending.current = p;
  };

  const finish = (outcome: Outcome, g: SavedGame, reason?: string) => {
    over.current = true;
    setBusy(true);
    setThinking(false);
    window.setTimeout(() => live.current && onEnd({ outcome, game: g, reason }), outcome === 'resigned' ? 0 : 1600);
  };

  const ended = (c: Chess, g: SavedGame): boolean => {
    const outcome = outcomeOf(c, learner);
    if (!outcome) return false;
    if (outcome === 'drawn') say('good', `It’s a draw: ${drawReason(c)}.`, 'Draw');
    else if (outcome === 'won') say('good', 'Checkmate! You beat me. I need to sit down.', 'You won!');
    else say('bad', 'Checkmate. A good fight! Let’s look at what happened.', 'Game over');
    finish(outcome, g, outcome === 'drawn' ? drawReason(c) : undefined);
    return true;
  };

  async function bapuTurn(g: SavedGame, blunder = false) {
    setBusy(true);
    setThinking(true);
    setStuck(false);
    const c = replay(g.moves);
    const fen = c.fen();
    const t0 = Date.now();
    let reply: SearchResult;
    try {
      reply = await engine().search(fen, { movetime: THINK_MS, elo: config.elo });
    } catch {
      if (!live.current || over.current) return;
      setThinking(false);
      setStuck(true);
      return say('hint', 'My engine hiccuped. Tap “Your move, Bapu” and I’ll try again.', null);
    }
    await sleep(Math.max(0, MIN_THINK - (Date.now() - t0)));
    if (!live.current || over.current) return;
    setThinking(false);
    c.move(parseUci(reply.uci));
    const next = { ...g, moves: [...g.moves, reply.uci], updated: new Date().toISOString() };
    commit(next);
    if (ended(c, next)) return;
    say(blunder ? 'bad' : 'neutral', replyLine(bapuMoveLine(fen, reply.uci), blunder, next.moves.length), blunder ? 'Blunder' : null);
    judge(c.fen());
    setBusy(false);
  }

  useEffect(() => {
    live.current = true;
    if (!began.current) {
      began.current = true;
      engine().newGame().catch(() => {});
      if (chess.turn() === learner) {
        judge(chess.fen());
        setBusy(false);
      } else {
        void bapuTurn(gameRef.current);
      }
    }
    return () => {
      live.current = false;
    };
  }, []);

  async function onMove(from: Key, to: Key) {
    if (busy) return;
    const g = gameRef.current;
    const c = replay(g.moves);
    const fen0 = c.fen();
    const uci = boardMoveToUci(c, from, to);
    c.move(parseUci(uci));
    let next: SavedGame = { ...g, moves: [...g.moves, uci], updated: new Date().toISOString() };
    commit(next);
    setResigning(false);
    if (ended(c, next)) return;
    setBusy(true);
    setThinking(true);

    // Judge the move: the engine's view before it, and after it (from Bapu's side, so flipped).
    try {
      const before = await (pending.current ?? engine().search(fen0, { depth: JUDGE_DEPTH }));
      pending.current = null;
      const after = await engine().search(c.fen(), { depth: JUDGE_DEPTH, lines: 2 });
      const j: Judged = {
        ply: g.moves.length,
        played: uci,
        before: before.cp,
        after: -after.cp,
        best: before.uci,
        reply: after.lines[0]?.uci ?? after.uci,
        clear: isClear(after.lines),
      };
      next = { ...next, judged: [...next.judged, j] };
      commit(next);
    } catch {
      // Unjudged: it simply doesn't count either way.
    }
    if (!live.current || over.current) return;
    const j = next.judged.at(-1);
    await bapuTurn(next, j?.ply === g.moves.length && verdict(j) === 'blunder');
  }

  async function offerDraw() {
    if (busy) return;
    setBusy(true);
    setResigning(false);
    const view = await pending.current?.catch(() => null);
    if (!live.current) return;
    setBusy(false);
    if (view && acceptsDraw(n, -view.cp, config)) {
      say('good', 'A draw? You’ve held me all game. I accept, with respect.', 'Draw agreed');
      return finish('drawn', gameRef.current, 'agreement');
    }
    say(
      'neutral',
      n < config.minMoves ? `Not yet! Play ${config.minMoves} moves first, then we can talk.` : 'No thanks, I like my position. Play on!',
      'Draw declined',
    );
  }

  const myTurn = chess.turn() === learner && !busy;
  const dests = useMemo(() => (myTurn ? legalDests(chess) : undefined), [chess, myTurn]);

  return (
    <div className="play">
      <div className="play-prompt">
        <span className={`side-dot side-${side(learner)}`} aria-hidden="true" />
        <span>
          Your moves: <strong>{n}</strong>
          {n < config.minMoves && <span className="game-target"> / {config.minMoves} for ★</span>}
        </span>
        {thinking ? (
          <span className="game-thinking">Bapu is thinking…</span>
        ) : (
          <span className={`game-blunders ${blunders ? 'on' : ''}`}>
            Blunders: <strong>{blunders}</strong>
          </span>
        )}
      </div>

      <Board
        fen={chess.fen()}
        version={version}
        orientation={side(learner)}
        turnColor={side(chess.turn())}
        lastMove={last}
        check={chess.inCheck()}
        dests={dests}
        onMove={(from, to) => {
          onMove(from, to).catch(() => {
            setBusy(false);
            setVersion((v) => v + 1);
          });
        }}
      />

      <div className="play-talk">
        <BapuBubble key={msg.id} tone={msg.tone} label={msg.label}>
          {msg.text}
        </BapuBubble>
      </div>

      <div className="play-actions">
        {stuck ? (
          <button className="btn btn-teal btn-block" onClick={() => void bapuTurn(gameRef.current)}>
            Your move, Bapu
          </button>
        ) : resigning ? (
          <>
            <button className="btn btn-ghost" onClick={() => setResigning(false)}>
              Keep playing
            </button>
            <button
              className="btn btn-bad btn-block"
              onClick={() => finish('resigned', gameRef.current)}
            >
              Yes, resign
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-ghost" disabled={!myTurn} onClick={() => void offerDraw()}>
              Offer a draw
            </button>
            <button className="btn btn-ghost" disabled={over.current} onClick={() => setResigning(true)}>
              Resign
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function GameSummary({
  level,
  config,
  ending,
  onDone,
  onReplay,
}: {
  level: LevelDef;
  config: GameConfig;
  ending: Ending;
  onDone: () => void;
  onReplay: () => void;
}) {
  const { outcome, game, reason } = ending;
  const n = learnerMoves(game.moves, game.color);
  const score = useMemo(() => scoreGame(outcome, n, game.judged, config), [outcome, n, game.judged, config]);
  const fanfareAt = useStarSounds(score.stars);
  const xp = useCountUp(score.xp, fanfareAt);
  const { improved, news } = useLevelSave(level.id, score.stars, score.xp);
  const moments = useMemo(() => {
    const fens = positions(game.moves);
    return worstMoments(game.judged).flatMap((j) => {
      try {
        return [{ j, m: explainMoment(fens[j.ply], j.ply, j.played, j.best, j.reply) }];
      } catch {
        return []; // a move list that doesn't replay (say, a damaged save) just isn't reviewed
      }
    });
  }, [game]);
  const [shown, setShown] = useState(0);
  const moment = moments[shown];
  const verdictLine = gameVerdict(outcome, score.stars, config.minMoves);

  return (
    <div className="summary">
      <div className="summary-stars" aria-label={`${score.stars} of 3 stars`}>
        {[1, 2, 3].map((s) => (
          <span key={s} className={`summary-star ${s <= score.stars ? 'on' : ''}`} style={{ animationDelay: `${starDelay(s)}s` }}>
            <Star size={s === 2 ? 72 : 56} filled={s <= score.stars} />
          </span>
        ))}
      </div>

      <h1 className="summary-title">{gameHeadline(outcome, score.stars)}</h1>
      {improved && <p className="summary-best">New best!</p>}
      {reason && reason !== 'agreement' && <p className="summary-tip">Drawn by {reason}.</p>}

      <div className="summary-stats">
        <div className="stat">
          <span className="stat-value">{n}</span>
          <span className="stat-label">your moves</span>
        </div>
        <div className="stat">
          <span className="stat-value">{score.blunders}</span>
          <span className="stat-label">blunder{score.blunders === 1 ? '' : 's'}</span>
        </div>
        <div className="stat stat-xp">
          <span className="stat-value">
            <Bolt size={20} /> +{xp}
          </span>
          <span className="stat-label">XP earned</span>
        </div>
      </div>

      <BapuBubble tone={score.stars ? 'good' : 'neutral'} label={null} cue={null}>
        {verdictLine}
      </BapuBubble>

      {moment && (
        <section className="game-review" aria-label="Bapu’s review">
          <div className="game-review-head">
            <span className="rule-tag">The moments that mattered</span>
            <span className="game-review-count">
              {shown + 1} of {moments.length}
            </span>
          </div>
          <Board
            fen={positions(game.moves)[moment.j.ply]}
            orientation={side(game.color)}
            turnColor={side(game.color)}
            shapes={[
              { orig: moment.m.played.from as Key, dest: moment.m.played.to as Key, brush: 'red' },
              { orig: moment.m.best.from as Key, dest: moment.m.best.to as Key, brush: 'green' },
            ]}
          />
          <div className="game-moment">
            <strong>
              <span className={`game-tag game-tag-${verdict(moment.j)}`}>{verdict(moment.j) === 'blunder' ? 'Blunder' : 'Mistake'}</span>{' '}
              {moment.m.title}
            </strong>
            <p>{moment.m.why}</p>
            <p className="game-better">
              <span className="game-arrow" aria-hidden="true" /> {moment.m.better}
            </p>
          </div>
          {moments.length > 1 && (
            <div className="game-review-nav">
              <button className="btn btn-ghost" disabled={shown === 0} onClick={() => setShown(shown - 1)}>
                Previous
              </button>
              <button className="btn btn-ghost" disabled={shown === moments.length - 1} onClick={() => setShown(shown + 1)}>
                Next
              </button>
            </div>
          )}
          {game.judged.some((j) => j.clear && verdict(j) === 'blunder') && (
            <p className="game-rematch">Your worst slips come back as daily riddles in two days. Find what I found!</p>
          )}
        </section>
      )}
      {!moment && n > 0 && <p className="summary-tip">No mistakes worth showing. That was a clean game!</p>}

      {score.stars > 0 && (
        <div className="rule-card">
          <img src={BAPU.head} alt="" width={44} height={44} />
          <div>
            <span className="rule-tag">Bapu’s rule</span>
            <p>{level.summary}</p>
          </div>
        </div>
      )}

      <NewsList news={news} fanfareAt={fanfareAt} />

      {score.stars < 3 && (
        <p className="summary-tip">
          {score.stars === 0
            ? `Last ${config.minMoves} moves for your first star.`
            : score.stars === 1
              ? 'Two blunders or fewer earns ★★.'
              : 'A game with no blunders at all, or a draw, earns ★★★.'}
        </p>
      )}

      <div className="play-actions">
        <button className="btn btn-ghost" onClick={onReplay}>
          Play again
        </button>
        {score.stars > 0 && (
          <ShareButton text={() => gameShareText({ outcome, stars: score.stars as Stars, moves: n, blunders: score.blunders, url: APP_URL })} />
        )}
        <button className="btn btn-teal btn-block" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}
