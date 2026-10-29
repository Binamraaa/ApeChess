// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Binamra Bhusal

import type { LevelDef, PuzzleDef } from './types';

export const PRACTICE_SIZE = 7;
/** How many recently played puzzles to remember per level. */
export const RECENT_LIMIT = 60;

/** Drops the level's featured puzzles and duplicates from a list of candidates. */
function withoutFeatured(level: LevelDef, puzzles: PuzzleDef[]): PuzzleDef[] {
  // Lichess sources name one puzzle; "custom" is shared by every hand-made one, so it doesn't count.
  const named = (p: PuzzleDef) => [p.id, p.source?.startsWith('lichess:') ? p.source : undefined];
  const featured = new Set([level.demo, ...level.guided].flatMap((p) => (p ? named(p) : [])).filter(Boolean));
  const seen = new Set<string>();
  return puzzles.filter((p) => {
    if (featured.has(p.id) || (p.source && featured.has(p.source)) || seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

/** Every puzzle a level can draw practice from: hand-authored ones plus its pack, minus the featured puzzles. */
export function practicePool(level: LevelDef): PuzzleDef[] {
  return withoutFeatured(level, [...level.practice, ...(level.pack ?? [])]);
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
  if (level.pools?.length) {
    // Mixed levels: draw each group separately, then play them easiest first.
    const practice = level.pools
      .flatMap((pool) => pickPractice(withoutFeatured(level, pool.puzzles), recent, pool.count, random))
      .sort((a, b) => (a.rating ?? 0) - (b.rating ?? 0));
    return { ...level, practice };
  }
  return { ...level, practice: pickPractice(practicePool(level), recent, level.practiceSize ?? PRACTICE_SIZE, random) };
}

/** Updates the recently-played list after a run. */
export function updateRecent(recent: string[], played: string[]): string[] {
  return [...played, ...recent.filter((id) => !played.includes(id))].slice(0, RECENT_LIMIT);
}
