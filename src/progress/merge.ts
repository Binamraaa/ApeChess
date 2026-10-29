// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Binamra Bhusal

import { NO_GAMES, mergeGames, type GameState } from '../levels/game';
import { REVIEW_LIMIT, type ReviewItem } from '../levels/review';
import { RIDDLE_MEMORY } from '../levels/riddle';
import type { LevelProgress, Profile, RiddleRecord, RiddleState } from './store';
import type { Streak } from './streak';

/**
 * Everything a learner has saved, as one plain object: what cloud sync stores, and what two
 * devices merge. Merging never loses progress: best stars, the furthest streak, every device's XP.
 */
export interface Snapshot {
  version: number;
  profile: Profile;
  levels: LevelProgress[];
  riddle: RiddleState;
  review: ReviewItem[];
  /**
   * Games against Bapu. Optional so snapshots from before the final round still read; an older
   * app drops it, which only loses the cloud's copy of an unfinished game.
   */
  games?: GameState;
}

export const SNAPSHOT_VERSION = 1;

/**
 * XP is kept per device (a tally each device only adds to), so merging two devices adds their XP
 * without counting anything twice. A profile from before sync has only a total: that total
 * belongs to this device.
 */
export function xpLedger(p: Profile, device: string): Record<string, number> {
  return p.xpBy ?? (p.xp ? { [device]: p.xp } : {});
}

const total = (ledger: Record<string, number>) => Object.values(ledger).reduce((a, b) => a + b, 0);

export function addXp(p: Profile, device: string, xp: number): Profile {
  const xpBy = { ...xpLedger(p, device) };
  xpBy[device] = (xpBy[device] ?? 0) + xp;
  return { ...p, xpBy, xp: total(xpBy) };
}

const later = (a: string | null | undefined, b: string | null | undefined) => ((b ?? '') > (a ?? '') ? b : a);
const levelNumber = (id: string) => Number(id.replace(/\D/g, '')) || 0;

/** The streak that reached the later day; on the same day, the longer one. */
export function mergeStreak(a: Streak, b: Streak): Streak {
  if (a.lastDay !== b.lastDay) return later(a.lastDay, b.lastDay) === a.lastDay ? a : b;
  return b.count > a.count ? b : a;
}

function mergeProfile(a: Profile, b: Profile, device: string): Profile {
  const ledger = { ...xpLedger(b, 'cloud') };
  for (const [d, xp] of Object.entries(xpLedger(a, device))) ledger[d] = Math.max(ledger[d] ?? 0, xp);
  const startAt =
    a.startAt && b.startAt ? (levelNumber(b.startAt) > levelNumber(a.startAt) ? b.startAt : a.startAt) : (a.startAt ?? b.startAt);
  return {
    ...b,
    ...a,
    xp: total(ledger),
    xpBy: ledger,
    streak: mergeStreak(a.streak, b.streak),
    started: a.started || b.started,
    ...(a.introSeen || b.introSeen ? { introSeen: true } : {}),
    ...(startAt ? { startAt } : {}),
  };
}

function mergeLevel(a: LevelProgress, b: LevelProgress): LevelProgress {
  const newer = later(a.lastPlayed, b.lastPlayed) === a.lastPlayed ? a : b;
  return {
    ...newer,
    bestStars: Math.max(a.bestStars, b.bestStars) as LevelProgress['bestStars'],
    timesCompleted: Math.max(a.timesCompleted, b.timesCompleted),
  };
}

/** The later day's riddle; on the same day, the one that was solved. */
function mergeCurrent(a?: RiddleRecord, b?: RiddleRecord): RiddleRecord | undefined {
  if (!a || !b) return a ?? b;
  if (a.day !== b.day) return later(a.day, b.day) === a.day ? a : b;
  return a.result || !b.result ? a : b;
}

const unique = (ids: string[]) => [...new Set(ids)];

function mergeRiddle(a: RiddleState, b: RiddleState): RiddleState {
  const current = mergeCurrent(a.current, b.current);
  return {
    ...(current ? { current } : {}),
    recent: unique([...a.recent, ...b.recent]).slice(0, RIDDLE_MEMORY),
    solved: Math.max(a.solved, b.solved),
  };
}

/**
 * Rematches from both devices, with the later miss for a puzzle on both. A rematch won on one
 * device can come back once from the other: a harmless extra go.
 */
function mergeReview(a: ReviewItem[], b: ReviewItem[]): ReviewItem[] {
  const byId = new Map<string, ReviewItem>();
  for (const item of [...a, ...b]) {
    const seen = byId.get(item.puzzleId);
    if (!seen || item.missedOn > seen.missedOn) byId.set(item.puzzleId, item);
  }
  return [...byId.values()].sort((x, y) => (y.missedOn > x.missedOn ? 1 : y.missedOn < x.missedOn ? -1 : 0)).slice(0, REVIEW_LIMIT);
}

/** Merges this device's snapshot (`local`) with another copy. `device` is this device's id. */
export function mergeSnapshots(local: Snapshot, other: Snapshot, device: string): Snapshot {
  const levels = new Map(other.levels.map((l) => [l.id, l]));
  for (const l of local.levels) {
    const o = levels.get(l.id);
    levels.set(l.id, o ? mergeLevel(l, o) : l);
  }
  return {
    version: SNAPSHOT_VERSION,
    profile: mergeProfile(local.profile, other.profile, device),
    levels: [...levels.values()].sort((x, y) => (x.id < y.id ? -1 : 1)),
    riddle: mergeRiddle(local.riddle, other.riddle),
    review: mergeReview(local.review, other.review),
    // Only once someone has played Bapu, so older snapshots aren't rewritten for nothing.
    ...(local.games || other.games ? { games: mergeGames(local.games ?? NO_GAMES, other.games ?? NO_GAMES) } : {}),
  };
}

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/**
 * Reads a snapshot from the cloud. Returns null for anything that isn't one, and 'newer' for a
 * snapshot from a newer version of the app (left alone until this device updates).
 */
export function parseSnapshot(x: unknown): Snapshot | 'newer' | null {
  if (!isObject(x) || typeof x.version !== 'number') return null;
  if (x.version > SNAPSHOT_VERSION) return 'newer';
  const profile = isObject(x.profile) ? (x.profile as unknown as Profile) : null;
  if (!profile || typeof profile.xp !== 'number' || !isObject(profile.streak)) return null;
  const riddle = isObject(x.riddle) ? (x.riddle as unknown as RiddleState) : { recent: [], solved: 0 };
  return {
    version: x.version,
    profile,
    levels: Array.isArray(x.levels) ? x.levels.filter((l): l is LevelProgress => isObject(l) && typeof l.id === 'string') : [],
    riddle: { ...riddle, recent: Array.isArray(riddle.recent) ? riddle.recent : [], solved: Number(riddle.solved) || 0 },
    review: Array.isArray(x.review) ? x.review.filter((i): i is ReviewItem => isObject(i) && typeof i.puzzleId === 'string') : [],
    ...(isObject(x.games) ? { games: parseGames(x.games) } : {}),
  };
}

function parseGames(g: Record<string, unknown>): GameState {
  const c = g.current;
  const current = isObject(c) && typeof c.id === 'string' && Array.isArray(c.moves) && Array.isArray(c.judged) ? c : undefined;
  return {
    ...(current ? { current: current as unknown as GameState['current'] } : {}),
    finished: Array.isArray(g.finished) ? g.finished.filter((id): id is string => typeof id === 'string') : [],
    played: Number(g.played) || 0,
  };
}

/** Compares snapshots by content, whatever order their keys were written in. */
export function sameSnapshot(a: Snapshot, b: Snapshot): boolean {
  return stable(a) === stable(b);
}

function stable(x: unknown): string {
  if (Array.isArray(x)) return `[${x.map(stable).join(',')}]`;
  if (isObject(x)) {
    return `{${Object.keys(x)
      .filter((k) => x[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(x[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(x);
}
