import { Chess, type Move, type PieceSymbol, type Square } from 'chess.js';
import type { Outcome } from '../levels/game';
import type { Uci } from '../levels/types';
import { PIECE_NAME, isFork, moveFacts, type MoveFacts, type Target } from './facts';
import { keyLine, moveInWords } from './explain';

/** Bapu's lines for the final round: talking through his own moves, and the review after the game. */

const uciMove = (uci: Uci) => ({ from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square, promotion: uci[4] as PieceSymbol | undefined });

function list(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** "your rook on a1" or "my rook on a1"; kings without a square. */
const named = (owner: 'your' | 'my', t: Target) => (t.type === 'k' ? `${owner} king` : `${owner} ${PIECE_NAME[t.type]} on ${t.square}`);

const forked = (f: MoveFacts, owner: 'your' | 'my') => list(f.forkTargets.filter((t) => t.type !== 'p').map((t) => named(owner, t)));

/** What Bapu says about his own move, when it has an idea worth naming. */
export function bapuMoveLine(fenBefore: string, uci: Uci): string | null {
  const f = moveFacts(fenBefore, uciMove(uci));
  const piece = PIECE_NAME[f.promotion ?? f.piece];
  if (f.mate) return 'Checkmate. A good fight! Let’s look at what happened.';
  if (f.doubleCheck) return 'Double check! Nothing can block two attackers, so your king has to move.';
  if (isFork(f)) return `My ${piece} on ${f.to} attacks ${forked(f, 'your')} at once. Which one will you save?`;
  if (f.discovered.length) {
    const d = f.discovered[0];
    return `My ${piece} steps aside, and my ${PIECE_NAME[d.by.type]} on ${d.by.square} now hits ${named('your', d.target)}.`;
  }
  const line = keyLine(f);
  if (line?.by.square === f.to) {
    if (line.kind === 'pin') {
      return `I pin your ${PIECE_NAME[line.front.type]} on ${line.front.square}: if it moves, ${named('your', line.behind)} is exposed.`;
    }
    return `Skewer! Your ${line.front.type === 'k' ? 'king' : PIECE_NAME[line.front.type]} has to step aside, and I take what’s behind it.`;
  }
  if (f.captured && f.capturedFree) return `Your ${PIECE_NAME[f.captured]} on ${f.to} had no guard, so I’ll take it. Thank you!`;
  if (f.special === 'promotion') return `My pawn becomes a ${piece}. That’s going to hurt.`;
  if (f.special === 'castle') return 'I castle: my king tucks away, and my rook joins the game.';
  if (f.captured) return `I take your ${PIECE_NAME[f.captured]} on ${f.to}.${f.check ? ' Check!' : ''}`;
  if (f.check) return 'Check! Find a safe square, or block it.';
  return null;
}

/** Bapu's quiet lines between moves, in turn. */
const QUIET = [
  'Your move.',
  'Before you move: what am I threatening?',
  'Your move. Checks, captures, threats, for both of us.',
  'Take your time. I’m not going anywhere.',
  'Your move. Is everything of yours protected?',
];

export const quietLine = (ply: number) => QUIET[Math.floor(ply / 2) % QUIET.length];

/** What Bapu says after his reply. After a blunder he raises an eyebrow (no take-backs in a real game). */
export function replyLine(line: string | null, blunder: boolean, ply: number): string {
  if (!blunder) return line ?? quietLine(ply);
  return line ? `${line} Next time, ask first: what am I threatening?` : 'Hmm, that one hurts. Before every move, ask: what am I threatening?';
}

/** Why a learner's move went wrong, from the answer that punished it. */
function whyBad(fenBefore: string, played: Move, reply: Uci | undefined): string {
  const mine = moveFacts(fenBefore, played);
  if (!reply) return 'It made your position a lot worse.';
  const after = new Chess(fenBefore);
  after.move(played);
  const r = moveFacts(after.fen(), uciMove(reply));
  const answer = moveInWords(new Chess(after.fen()).move(uciMove(reply)));
  if (r.mate) return `It let me checkmate you: ${answer}.`;
  if (r.captured && r.to === played.to && mine.defenders.length === 0) {
    return `Your ${PIECE_NAME[played.promotion ?? played.piece]} on ${played.to} had no guard, so I could just take it.`;
  }
  if (isFork(r)) return `It let my ${PIECE_NAME[r.piece]} fork ${forked(r, 'your')}: ${answer}.`;
  if (r.doubleCheck) return `It walked into a double check: ${answer}.`;
  if (r.discovered.length) return `It allowed a discovered attack: ${answer} uncovers my ${PIECE_NAME[r.discovered[0].by.type]}.`;
  const line = keyLine(r);
  if (line?.by.square === r.to) {
    return line.kind === 'pin'
      ? `It let me pin your ${PIECE_NAME[line.front.type]} to ${named('your', line.behind)}: ${answer}.`
      : `It let me skewer your ${line.front.type === 'k' ? 'king' : PIECE_NAME[line.front.type]}: ${answer}.`;
  }
  if (r.captured && r.capturedFree) return `It left your ${PIECE_NAME[r.captured]} on ${r.to} unguarded, and I took it: ${answer}.`;
  if (r.captured) return `It let me win material: ${answer}.`;
  if (r.check) return `It let me attack your king: ${answer}, check.`;
  return `It gave me ${answer}, and my position got much better.`;
}

/** What the better move would have done. */
function whyBetter(fenBefore: string, best: Uci): string {
  const m = new Chess(fenBefore).move(uciMove(best));
  const f = moveFacts(fenBefore, uciMove(best));
  const words = moveInWords(m);
  if (f.mate) return `${words} was checkmate!`;
  if (isFork(f)) return `${words} forks ${forked(f, 'my')}.`;
  if (f.captured && f.capturedFree) return `${words} wins my ${PIECE_NAME[f.captured]} for free.`;
  if (f.captured) return `${words} was better: it takes my ${PIECE_NAME[f.captured]}.`;
  if (f.check) return `${words}, with check, was better.`;
  return `${words} was better.`;
}

export interface Moment {
  /** "Move 12: you played Bishop to c4." */
  title: string;
  why: string;
  better: string;
  played: Move;
  best: Move;
}

/** One of the learner's worst moments, explained. `ply` counts from 0 (White's first move). */
export function explainMoment(fenBefore: string, ply: number, played: Uci, best: Uci, reply?: Uci): Moment {
  const move = new Chess(fenBefore).move(uciMove(played));
  const bestMove = new Chess(fenBefore).move(uciMove(best));
  return {
    title: `Move ${Math.floor(ply / 2) + 1}: you played ${moveInWords(move)}.`,
    why: whyBad(fenBefore, move, reply),
    better: whyBetter(fenBefore, best),
    played: move,
    best: bestMove,
  };
}

/** The headline after the game. */
export function gameHeadline(outcome: Outcome, stars: number): string {
  if (outcome === 'won') return 'You beat Bapu!';
  if (outcome === 'drawn') return 'A draw with Bapu!';
  if (stars === 0) return outcome === 'resigned' ? 'You resigned' : 'Checkmate';
  return stars === 3 ? 'Not a single blunder!' : stars === 2 ? 'A real fight!' : 'You went the distance!';
}

/** Bapu's word after the game. */
export function gameVerdict(outcome: Outcome, stars: number, minMoves: number): string {
  if (outcome === 'won') return 'You beat me fair and square. I’m framing this game. Next time I won’t be so polite!';
  if (outcome === 'drawn') return 'Holding me to a draw is no small thing. You defended like someone who checks every move.';
  if (stars === 0) {
    return `That one ended before move ${minMoves}. Play slower: before every move, look at my checks, captures and threats.`;
  }
  if (stars === 3) return 'You lost, but you never once handed me a gift. That’s exactly how strong players lose: slowly, and only to better ideas.';
  return 'Every game against a stronger player is a lesson. Here are the moments that mattered most.';
}
