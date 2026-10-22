import type { LevelDef } from './types';
import { starsToPass } from './unlock';

/**
 * Bapu's notebook: every level's rule becomes a page the learner keeps once they finish it.
 * Finishing whole units earns ranks.
 */

export interface NotebookUnit {
  number: number;
  title: string;
  levels: { id: string; number: number; title: string; checkpoint?: boolean }[];
}

export interface Page {
  levelId: string;
  number: number;
  title: string;
  unit: number;
  /** Bapu's rule from the level summary. */
  rule: string;
  term?: { term: string; definition: string };
  earned: boolean;
}

/** One page per built level, in map order. */
export function notebookPages(units: NotebookUnit[], levels: Record<string, LevelDef>, best: (id: string) => number): Page[] {
  return units.flatMap((u) =>
    u.levels
      .filter((l) => levels[l.id])
      .map((l) => ({
        levelId: l.id,
        number: l.number,
        title: l.title,
        unit: u.number,
        rule: levels[l.id].summary,
        term: levels[l.id].glossary,
        earned: best(l.id) > 0,
      })),
  );
}

/** Rank titles: the first is where everyone starts, then one per finished unit. */
export const RANKS = ['Curious Newcomer', 'Pawn Apprentice', 'Mate Hunter', 'Tactic Spotter', 'Sharp Tactician', 'Silverback'];

export interface Rank {
  /** Units finished (passed every built level). */
  units: number;
  title: string;
  /** The next rank, and how many levels stand between. */
  next?: { title: string; levelsLeft: number };
}

const unitDone = (u: NotebookUnit, levels: Record<string, LevelDef>, best: (id: string) => number) => {
  const built = u.levels.filter((l) => levels[l.id]);
  return built.length > 0 && built.every((l) => best(l.id) >= starsToPass(l));
};

export function rankFor(units: NotebookUnit[], levels: Record<string, LevelDef>, best: (id: string) => number): Rank {
  const done = units.filter((u) => unitDone(u, levels, best)).length;
  const title = RANKS[Math.min(done, RANKS.length - 1)];
  const nextUnit = units.find((u) => !unitDone(u, levels, best));
  if (done >= RANKS.length - 1 || !nextUnit) return { units: done, title };
  const levelsLeft = nextUnit.levels.filter((l) => levels[l.id] && best(l.id) < starsToPass(l)).length;
  return { units: done, title, next: { title: RANKS[done + 1], levelsLeft } };
}
