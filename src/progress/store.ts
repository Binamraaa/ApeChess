import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { updateRecent } from '../levels/practice';
import { RIDDLE_MEMORY } from '../levels/riddle';
import type { PuzzleOutcome, Stars } from '../levels/scoring';
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
  xp: number;
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
  if (!p.started) await d.put('meta', { ...p, started: true }, 'profile');
}

/** Records the intro as seen, and where the learner wants to begin. */
export async function finishIntro(startAt?: string): Promise<Profile> {
  const d = await db();
  const p = { ...(await getProfile()), introSeen: true, ...(startAt ? { startAt } : {}) };
  await d.put('meta', p, 'profile');
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
): Promise<{ profile: Profile; level: LevelProgress; improved: boolean }> {
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
    ...old,
    xp: old.xp + xpEarned,
    streak: recordSession(old.streak, today),
    started: true,
  };
  await meta.put(profile, 'profile');
  await tx.done;

  return { profile, level, improved: !prev || stars > prev.bestStars };
}

/** Today's riddle, as first picked, and how it went. */
export interface RiddleRecord {
  day: string;
  levelId: string;
  puzzleId: string;
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
  pick: (recent: string[]) => { levelId: string; puzzleId: string } | null,
): Promise<RiddleRecord | null> {
  const d = await db();
  const state = await getRiddleState();
  if (state.current?.day === day) return state.current;
  const chosen = pick(state.recent);
  if (!chosen) return null;
  const current: RiddleRecord = { day, ...chosen };
  const recent = [chosen.puzzleId, ...state.recent.filter((id) => id !== chosen.puzzleId)].slice(0, RIDDLE_MEMORY);
  await d.put('meta', { ...state, current, recent }, 'riddle');
  return current;
}

/** Saves a solved riddle: XP and streak, once per day. */
export async function saveRiddleResult(
  day: string,
  outcome: PuzzleOutcome,
  xp: number,
  now = new Date(),
): Promise<{ profile: Profile; riddle: RiddleRecord } | null> {
  const d = await db();
  const tx = d.transaction('meta', 'readwrite');
  const meta = tx.objectStore('meta');
  const state = { ...NO_RIDDLES, ...((await meta.get('riddle')) as RiddleState | undefined) };
  const old = { ...DEFAULT_PROFILE, ...((await meta.get('profile')) as Profile | undefined) };
  if (state.current?.day !== day || state.current.result) {
    await tx.done;
    return null;
  }
  const riddle: RiddleRecord = { ...state.current, result: { ...outcome, xp } };
  const profile: Profile = { ...old, xp: old.xp + xp, streak: recordSession(old.streak, localDay(now)), started: true };
  await meta.put({ ...state, current: riddle, solved: state.solved + 1 }, 'riddle');
  await meta.put(profile, 'profile');
  await tx.done;
  return { profile, riddle };
}

export function displayStreak(p: Profile, now = new Date()): number {
  return currentStreak(p.streak, localDay(now));
}

/** Test helper: close and forget the cached connection so the database can be deleted. */
export async function _resetConnection() {
  if (dbPromise) (await dbPromise).close();
  dbPromise = null;
}
