import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { updateRecent } from '../levels/practice';
import { FINISHED_MEMORY, NO_GAMES, type GameState, type SavedGame } from '../levels/game';
import { addGameRematches, updateReview, type ReviewItem } from '../levels/review';
import { RIDDLE_MEMORY } from '../levels/riddle';
import type { PuzzleOutcome, Stars } from '../levels/scoring';
import type { PuzzleDef } from '../levels/types';
import { SNAPSHOT_VERSION, addXp, mergeSnapshots, sameSnapshot, xpLedger, type Snapshot } from './merge';
import { NO_STREAK, currentStreak, localDay, recordSession, type Streak } from './streak';

export interface LevelProgress {
  id: string;
  bestStars: Stars;
  timesCompleted: number;
  lastPlayed: string;
  /** Practice puzzle ids played recently, newest first, so the next run picks fresh ones. */
  recent?: string[];
}

export interface Profile {
  /** Total XP: the sum of `xpBy`. */
  xp: number;
  /** XP earned on each device, by device id, so devices can merge without counting XP twice. */
  xpBy?: Record<string, number>;
  streak: Streak;
  /** True once the learner has started at least one level. */
  started: boolean;
  /** True once the intro page has been seen. */
  introSeen?: boolean;
  /** Where the learner chose to begin; every level up to it is open. */
  startAt?: string;
}

interface ApeChessDB extends DBSchema {
  levels: { key: string; value: LevelProgress };
  meta: { key: string; value: unknown };
}

const DEFAULT_PROFILE: Profile = { xp: 0, streak: NO_STREAK, started: false };

let dbPromise: Promise<IDBPDatabase<ApeChessDB>> | null = null;

const savedListeners = new Set<() => void>();

/** Calls `fn` after every change to saved progress; returns the unsubscribe function. */
export function onSaved(fn: () => void): () => void {
  savedListeners.add(fn);
  return () => savedListeners.delete(fn);
}

const saved = () => savedListeners.forEach((fn) => fn());

const mergedListeners = new Set<() => void>();

/** Calls `fn` after progress from another device is merged in; returns the unsubscribe function. */
export function onMerged(fn: () => void): () => void {
  mergedListeners.add(fn);
  return () => mergedListeners.delete(fn);
}

interface MetaStore {
  get(key: string): Promise<unknown>;
  put(value: unknown, key: string): Promise<unknown>;
}

const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');

/** This device's id (made on first use), which its XP is filed under. */
async function deviceIn(meta: MetaStore): Promise<string> {
  const id = (await meta.get('device')) as string | undefined;
  if (id) return id;
  const made = newId();
  await meta.put(made, 'device');
  return made;
}

function db() {
  dbPromise ??= openDB<ApeChessDB>('apechess', 1, {
    upgrade(d) {
      d.createObjectStore('levels', { keyPath: 'id' });
      d.createObjectStore('meta');
    },
  });
  return dbPromise;
}

export async function getProfile(): Promise<Profile> {
  const stored = (await (await db()).get('meta', 'profile')) as Profile | undefined;
  return { ...DEFAULT_PROFILE, ...stored };
}

export async function markStarted(): Promise<void> {
  const d = await db();
  const p = await getProfile();
  if (p.started) return;
  await d.put('meta', { ...p, started: true }, 'profile');
  saved();
}

/** Records the intro as seen, and where the learner wants to begin. */
export async function finishIntro(startAt?: string): Promise<Profile> {
  const d = await db();
  const p = { ...(await getProfile()), introSeen: true, ...(startAt ? { startAt } : {}) };
  await d.put('meta', p, 'profile');
  saved();
  return p;
}

export async function getLevelProgress(id: string): Promise<LevelProgress | undefined> {
  return (await db()).get('levels', id);
}

export async function getAllLevelProgress(): Promise<LevelProgress[]> {
  return (await db()).getAll('levels');
}

/** Saves a finished level session: best stars, XP and streak, in one transaction. */
export async function saveLevelResult(
  levelId: string,
  stars: Stars,
  xpEarned: number,
  now = new Date(),
  played: string[] = [],
): Promise<{ profile: Profile; level: LevelProgress; improved: boolean; prevBest: number; freezeEarned: boolean }> {
  const d = await db();
  const tx = d.transaction(['levels', 'meta'], 'readwrite');
  const levels = tx.objectStore('levels');
  const meta = tx.objectStore('meta');
  const today = localDay(now);

  const prev = await levels.get(levelId);
  const level: LevelProgress = {
    id: levelId,
    bestStars: Math.max(prev?.bestStars ?? 0, stars) as Stars,
    timesCompleted: (prev?.timesCompleted ?? 0) + 1,
    lastPlayed: today,
    recent: updateRecent(prev?.recent ?? [], played),
  };
  await levels.put(level);

  const old = { ...DEFAULT_PROFILE, ...((await meta.get('profile')) as Profile | undefined) };
  const profile: Profile = {
    ...addXp(old, await deviceIn(meta), xpEarned),
    streak: recordSession(old.streak, today),
    started: true,
  };
  await meta.put(profile, 'profile');
  await tx.done;
  saved();

  return {
    profile,
    level,
    improved: !prev || stars > prev.bestStars,
    prevBest: prev?.bestStars ?? 0,
    freezeEarned: (profile.streak.freezes ?? 0) > (old.streak.freezes ?? 0),
  };
}

/** Today's riddle, as first picked, and how it went. */
export interface RiddleRecord {
  day: string;
  levelId: string;
  puzzleId: string;
  /** A rematch of a puzzle missed on this day. */
  rematch?: string;
  /** The puzzle itself, for a rematch from a game against Bapu (it isn't in any level). */
  puzzle?: PuzzleDef;
  result?: PuzzleOutcome & { xp: number };
}

export interface RiddleState {
  current?: RiddleRecord;
  /** Puzzle ids of past riddles, newest first, so they aren't repeated soon. */
  recent: string[];
  /** Riddles solved, ever. */
  solved: number;
}

const NO_RIDDLES: RiddleState = { recent: [], solved: 0 };

export async function getRiddleState(): Promise<RiddleState> {
  return { ...NO_RIDDLES, ...((await (await db()).get('meta', 'riddle')) as RiddleState | undefined) };
}

/**
 * Today's riddle: the one already picked today, or a new pick (saved, so it stays the same all day
 * even if the learner passes a level in the meantime). `pick` gets the recent riddle ids.
 */
export async function todaysRiddle(
  day: string,
  pick: (recent: string[]) => { levelId: string; puzzleId: string; rematch?: string; puzzle?: PuzzleDef } | null,
): Promise<RiddleRecord | null> {
  const d = await db();
  const state = await getRiddleState();
  if (state.current?.day === day) return state.current;
  const chosen = pick(state.recent);
  if (!chosen) return null;
  const current: RiddleRecord = { day, ...chosen };
  const recent = [chosen.puzzleId, ...state.recent.filter((id) => id !== chosen.puzzleId)].slice(0, RIDDLE_MEMORY);
  await d.put('meta', { ...state, current, recent }, 'riddle');
  saved();
  return current;
}

/** Saves a solved riddle: XP and streak, once per day. */
export async function saveRiddleResult(
  day: string,
  outcome: PuzzleOutcome,
  xp: number,
  now = new Date(),
): Promise<{ profile: Profile; riddle: RiddleRecord; freezeEarned: boolean } | null> {
  const d = await db();
  const tx = d.transaction('meta', 'readwrite');
  const meta = tx.objectStore('meta');
  const state = { ...NO_RIDDLES, ...((await meta.get('riddle')) as RiddleState | undefined) };
  const old = { ...DEFAULT_PROFILE, ...((await meta.get('profile')) as Profile | undefined) };
  const device = await deviceIn(meta);
  if (state.current?.day !== day || state.current.result) {
    await tx.done;
    return null;
  }
  const riddle: RiddleRecord = { ...state.current, result: { ...outcome, xp } };
  const profile: Profile = { ...addXp(old, device, xp), streak: recordSession(old.streak, localDay(now)), started: true };
  await meta.put({ ...state, current: riddle, solved: state.solved + 1 }, 'riddle');
  await meta.put(profile, 'profile');
  // A rematch won first try is done with; otherwise it comes back again later.
  if (riddle.rematch) {
    const clean = outcome.firstTry && !outcome.revealed;
    const items = ((await meta.get('review')) as ReviewItem[] | undefined) ?? [];
    await meta.put(updateReview(items, riddle.levelId, clean ? [] : [riddle.puzzleId], clean ? [riddle.puzzleId] : [], day), 'review');
  }
  await tx.done;
  saved();
  return { profile, riddle, freezeEarned: (profile.streak.freezes ?? 0) > (old.streak.freezes ?? 0) };
}

/** Puzzles waiting for a rematch. */
export async function getReview(): Promise<ReviewItem[]> {
  return ((await (await db()).get('meta', 'review')) as ReviewItem[] | undefined) ?? [];
}

/** Records a level run's misses for rematches, and drops any it solved first try. */
export async function recordReview(levelId: string, missed: string[], solved: string[], day: string): Promise<void> {
  const d = await db();
  const tx = d.transaction('meta', 'readwrite');
  const items = ((await tx.store.get('review')) as ReviewItem[] | undefined) ?? [];
  await tx.store.put(updateReview(items, levelId, missed, solved, day), 'review');
  await tx.done;
  saved();
}

/** Games against Bapu: the unfinished one, if any, and how many have been played. */
export async function getGames(): Promise<GameState> {
  return { ...NO_GAMES, ...((await (await db()).get('meta', 'games')) as GameState | undefined) };
}

/**
 * Saves the unfinished game after a move. It doesn't count as new progress, so it doesn't start
 * a cloud sync of its own; the next one takes it along.
 */
export async function saveGame(game: SavedGame): Promise<void> {
  const tx = (await db()).transaction('meta', 'readwrite');
  const state = { ...NO_GAMES, ...((await tx.store.get('games')) as GameState | undefined) };
  // Finished on another device meanwhile: leave it finished.
  if (!state.finished.includes(game.id)) await tx.store.put({ ...state, current: game }, 'games');
  await tx.done;
}

/** Ends a game: it's no longer the unfinished one, and its blunders come back as rematches. */
export async function finishGame(id: string, levelId: string, rematches: PuzzleDef[], day: string): Promise<void> {
  const tx = (await db()).transaction('meta', 'readwrite');
  const state = { ...NO_GAMES, ...((await tx.store.get('games')) as GameState | undefined) };
  if (!state.finished.includes(id)) {
    const { current, ...rest } = state;
    const games: GameState = {
      ...rest,
      ...(current && current.id !== id ? { current } : {}),
      finished: [id, ...state.finished].slice(0, FINISHED_MEMORY),
      played: state.played + 1,
    };
    await tx.store.put(games, 'games');
    if (rematches.length) {
      const items = ((await tx.store.get('review')) as ReviewItem[] | undefined) ?? [];
      await tx.store.put(addGameRematches(items, levelId, rematches, day), 'review');
    }
  }
  await tx.done;
  saved();
}

/** Everything saved on this device, as one snapshot (for cloud sync). */
export async function exportSnapshot(): Promise<Snapshot> {
  const tx = (await db()).transaction(['levels', 'meta'], 'readwrite');
  const snapshot = await readSnapshot(tx.objectStore('levels'), tx.objectStore('meta'));
  await tx.done;
  return snapshot;
}

async function readSnapshot(levels: { getAll(): Promise<LevelProgress[]> }, meta: MetaStore): Promise<Snapshot> {
  const profile = { ...DEFAULT_PROFILE, ...((await meta.get('profile')) as Profile | undefined) };
  const games = (await meta.get('games')) as GameState | undefined;
  return {
    version: SNAPSHOT_VERSION,
    profile: { ...profile, xpBy: xpLedger(profile, await deviceIn(meta)) },
    levels: await levels.getAll(),
    riddle: { ...NO_RIDDLES, ...((await meta.get('riddle')) as RiddleState | undefined) },
    review: ((await meta.get('review')) as ReviewItem[] | undefined) ?? [],
    ...(games ? { games: { ...NO_GAMES, ...games } } : {}),
  };
}

/**
 * Merges another device's snapshot into this one, in one transaction so nothing saved meanwhile
 * is lost. Returns the merged snapshot, and whether this device's copy changed.
 */
export async function mergeIntoLocal(other: Snapshot): Promise<{ snapshot: Snapshot; changed: boolean }> {
  const tx = (await db()).transaction(['levels', 'meta'], 'readwrite');
  const levels = tx.objectStore('levels');
  const meta = tx.objectStore('meta');
  const local = await readSnapshot(levels, meta);
  const snapshot = mergeSnapshots(local, other, await deviceIn(meta));
  const changed = !sameSnapshot(local, snapshot);
  if (changed) {
    for (const l of snapshot.levels) await levels.put(l);
    await meta.put(snapshot.profile, 'profile');
    await meta.put(snapshot.riddle, 'riddle');
    await meta.put(snapshot.review, 'review');
    if (snapshot.games) await meta.put(snapshot.games, 'games');
  }
  await tx.done;
  if (changed) mergedListeners.forEach((fn) => fn());
  return { snapshot, changed };
}

export function displayStreak(p: Profile, now = new Date()): number {
  return currentStreak(p.streak, localDay(now));
}

/** Test helper: close and forget the cached connection so the database can be deleted. */
export async function _resetConnection() {
  if (dbPromise) (await dbPromise).close();
  dbPromise = null;
}
