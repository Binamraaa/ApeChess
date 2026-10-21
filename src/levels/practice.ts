import type { LevelDef, PuzzleDef } from './types';

export const PRACTICE_SIZE = 7;
/** How many recently played puzzles to remember per level. */
export const RECENT_LIMIT = 60;

/** Every puzzle a level can draw practice from: hand-authored ones plus its pack, minus the featured puzzles. */
export function practicePool(level: LevelDef): PuzzleDef[] {
  const featured = new Set([level.demo, ...level.guided].flatMap((p) => [p.id, p.source]).filter(Boolean));
  const seen = new Set<string>();
  return [...level.practice, ...(level.pack ?? [])].filter((p) => {
    if (featured.has(p.id) || (p.source && featured.has(p.source)) || seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

/**
 * Picks this run's practice set: puzzles not played recently first (in random order),
 * topped up with the least recently played, then sorted easiest first.
 * `recent` lists puzzle ids, most recent first.
 */
export function pickPractice(pool: PuzzleDef[], recent: string[], n = PRACTICE_SIZE, random = Math.random): PuzzleDef[] {
  const age = new Map(recent.map((id, i) => [id, i]));
  const fresh = pool.filter((p) => !age.has(p.id));
  for (let i = fresh.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [fresh[i], fresh[j]] = [fresh[j], fresh[i]];
  }
  const stale = pool.filter((p) => age.has(p.id)).sort((a, b) => age.get(b.id)! - age.get(a.id)!);
  return [...fresh, ...stale].slice(0, n).sort((a, b) => (a.rating ?? 0) - (b.rating ?? 0));
}

/** The level as played this run, with a fresh practice set. */
export function levelRun(level: LevelDef, recent: string[], random = Math.random): LevelDef {
  return { ...level, practice: pickPractice(practicePool(level), recent, PRACTICE_SIZE, random) };
}

/** Updates the recently-played list after a run. */
export function updateRecent(recent: string[], played: string[]): string[] {
  return [...played, ...recent.filter((id) => !played.includes(id))].slice(0, RECENT_LIMIT);
}
