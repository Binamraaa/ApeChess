// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Binamra Bhusal

import { Chess, type Color } from 'chess.js';
import { LEVEL_BONUS, type Stars } from './scoring';
import type { PuzzleDef, Uci } from './types';

/**
 * The final round (Level 21): a whole game against Bapu at club strength. Nobody is expected to
 * win, so stars measure how well the learner played: how long they lasted and how few blunders
 * they made. Pure: the game screen feeds in the engine's numbers.
 */

export interface GameConfig {
  /** Bapu's strength (Stockfish's UCI_Elo). */
  elo: number;
  /** Learner moves needed for the first star (a win or a draw counts sooner). */
  minMoves: number;
}

/** Winning-chance drops (on a -1..1 scale) that make a move a mistake or a blunder, as Lichess counts them. */
export const MISTAKE = 0.2;
export const BLUNDER = 0.3;
/** Bapu accepts a draw offer once the learner has lasted the full game and he isn't better by more than this. */
export const DRAW_MARGIN = 25;
/** How many finished-game ids to remember, so a finished game can't come back from another device. */
export const FINISHED_MEMORY = 20;

/** Chances of winning for the side a score is for, from -1 (lost) to 1 (won). Mates count as ±1000. */
export function winChance(cp: number): number {
  const c = Math.max(-1000, Math.min(1000, cp));
  return 2 / (1 + Math.exp(-0.00368208 * c)) - 1;
}

/** The engine's view of one learner move. Scores are in centipawns, from the learner's side. */
export interface Judged {
  /** Index of the move in the game's move list. */
  ply: number;
  played: Uci;
  /** Score before the move (with the best move), and after the move that was played. */
  before: number;
  after: number;
  /** The engine's best move in the position before. */
  best: Uci;
  /** Bapu's best answer to the move played. */
  reply?: Uci;
  /** The reply was the only good answer by far, so the position makes a fair puzzle. */
  clear?: boolean;
}

export type Verdict = 'blunder' | 'mistake' | 'ok';

/** How much of the learner's winning chances the move gave away (never negative). */
export function loss(j: Judged): number {
  return Math.max(0, winChance(j.before) - winChance(j.after));
}

export function verdict(j: Judged): Verdict {
  if (j.played === j.best) return 'ok';
  const l = loss(j);
  return l >= BLUNDER ? 'blunder' : l >= MISTAKE ? 'mistake' : 'ok';
}

/** Lines from the engine: first move and score for the side to move, best first. */
export interface Line {
  uci: Uci;
  cp: number;
}

/** True when the best answer clearly wins and nothing else comes close: a puzzle with one solution. */
export function isClear(lines: Line[]): boolean {
  if (!lines.length) return false;
  const best = winChance(lines[0].cp);
  const second = lines[1] ? winChance(lines[1].cp) : -1;
  return best >= 0.3 && best - second >= BLUNDER;
}

export type Outcome = 'won' | 'lost' | 'drawn' | 'resigned';

/** How the game ended, from the learner's side, or undefined while it goes on. */
export function outcomeOf(chess: Chess, learner: Color): Outcome | undefined {
  if (chess.isCheckmate()) return chess.turn() === learner ? 'lost' : 'won';
  if (chess.isDraw()) return 'drawn';
  return undefined;
}

/** Why a drawn game was drawn, in words. */
export function drawReason(chess: Chess): string {
  if (chess.isStalemate()) return 'stalemate';
  if (chess.isInsufficientMaterial()) return 'not enough pieces left to mate';
  if (chess.isThreefoldRepetition()) return 'the same position three times';
  if (chess.isDrawByFiftyMoves()) return 'fifty moves without a capture or a pawn move';
  return 'agreement';
}

export interface GameScore {
  /** 0 when the game ended too soon to count. */
  stars: 0 | Stars;
  /** Moves the learner played. */
  moves: number;
  blunders: number;
  mistakes: number;
  xp: number;
}

export const XP_PER_CLEAN_MOVE = 2;
export const XP_CLEAN_MOVES_CAP = 40;
export const XP_RESULT = { won: 100, drawn: 50 };

/**
 * ★ last the full game (or win or draw) · ★★ at most two blunders · ★★★ no blunders, or a win or a draw.
 * XP: the level bonus for the stars, plus a little for every move that wasn't a blunder.
 */
export function scoreGame(outcome: Outcome, moves: number, judged: Judged[], config: Pick<GameConfig, 'minMoves'>): GameScore {
  const blunders = judged.filter((j) => verdict(j) === 'blunder').length;
  const mistakes = judged.filter((j) => verdict(j) === 'mistake').length;
  const result = outcome === 'won' || outcome === 'drawn';
  if (!result && moves < config.minMoves) return { stars: 0, moves, blunders, mistakes, xp: 0 };
  const stars: Stars = result || blunders === 0 ? 3 : blunders <= 2 ? 2 : 1;
  const clean = Math.min(moves - blunders, XP_CLEAN_MOVES_CAP);
  const bonus = outcome === 'won' ? XP_RESULT.won : outcome === 'drawn' ? XP_RESULT.drawn : 0;
  return { stars, moves, blunders, mistakes, xp: LEVEL_BONUS[stars] + clean * XP_PER_CLEAN_MOVE + bonus };
}

/** Bapu takes a draw only from a learner who has lasted the game, in a position he isn't better in. */
export function acceptsDraw(moves: number, bapuScore: number, config: Pick<GameConfig, 'minMoves'>): boolean {
  return moves >= config.minMoves && bapuScore <= DRAW_MARGIN;
}

/** The learner's worst moments (mistakes and blunders), at most `n`, in game order. */
export function worstMoments(judged: Judged[], n = 3): Judged[] {
  return judged
    .filter((j) => verdict(j) !== 'ok')
    .sort((a, b) => loss(b) - loss(a))
    .slice(0, n)
    .sort((a, b) => a.ply - b.ply);
}

/** The learner plays White in their first game, then the colours alternate. */
export const colorFor = (played: number): Color => (played % 2 === 0 ? 'w' : 'b');

/** Learner moves so far, given whose game it is. */
export const learnerMoves = (moves: Uci[], learner: Color) => moves.filter((_, i) => (i % 2 === 0) === (learner === 'w')).length;

const uciMove = (uci: Uci) => ({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });

/** Replays a game from the start. Throws on an illegal move. */
export function replay(moves: Uci[]): Chess {
  const chess = new Chess();
  for (const m of moves) chess.move(uciMove(m));
  return chess;
}

/** The position before each move, as FENs (index = ply). */
export function positions(moves: Uci[]): string[] {
  const chess = new Chess();
  return moves.map((m) => {
    const fen = chess.fen();
    chess.move(uciMove(m));
    return fen;
  });
}

/**
 * Rematch puzzles from the game's blunders: the learner's move is played first, then they find
 * the answer that punished it (Lichess puzzles are made the same way). Only clear answers count.
 */
export function rematchPuzzles(gameId: string, moves: Uci[], judged: Judged[], n = 3): PuzzleDef[] {
  const fens = positions(moves);
  return judged
    .filter((j) => j.clear && j.reply && verdict(j) === 'blunder' && fens[j.ply])
    .sort((a, b) => loss(b) - loss(a))
    .slice(0, n)
    .map((j) => ({ id: `game-${gameId}-${j.ply}`, fen: fens[j.ply], moves: [j.played, j.reply!], source: 'game', theme: 'mixed' }));
}

/** An unfinished game, saved after every move so it survives closing the app. */
export interface SavedGame {
  id: string;
  /** The learner's colour. */
  color: Color;
  moves: Uci[];
  judged: Judged[];
  /** When it was last saved (ISO time), so the newer copy wins between devices. */
  updated: string;
}

export interface GameState {
  current?: SavedGame;
  /** Ids of finished games, newest first. */
  finished: string[];
  /** Games finished, ever (it picks the learner's colour). */
  played: number;
}

export const NO_GAMES: GameState = { finished: [], played: 0 };

/** The newer unfinished game, unless either device has finished it; the most games played. */
export function mergeGames(a: GameState, b: GameState): GameState {
  const finished = [...new Set([...a.finished, ...b.finished])].slice(0, FINISHED_MEMORY);
  const newer = !a.current || !b.current ? (a.current ?? b.current) : b.current.updated > a.current.updated ? b.current : a.current;
  const current = newer && !finished.includes(newer.id) ? newer : undefined;
  return { ...(current ? { current } : {}), finished, played: Math.max(a.played, b.played) };
}
