import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { updateRecent } from '../levels/practice';
import type { Stars } from '../levels/scoring';
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

export function displayStreak(p: Profile, now = new Date()): number {
  return currentStreak(p.streak, localDay(now));
}

/** Test helper: close and forget the cached connection so the database can be deleted. */
export async function _resetConnection() {
  if (dbPromise) (await dbPromise).close();
  dbPromise = null;
}
