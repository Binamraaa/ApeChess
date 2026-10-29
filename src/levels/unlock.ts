// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Binamra Bhusal

export interface MapLevel {
  id: string;
  checkpoint?: boolean;
}

/** Stars needed on a level to unlock the one after it. Checkpoints need ★★. */
export const starsToPass = (l: MapLevel) => (l.checkpoint ? 2 : 1);

/**
 * Which playable levels are open. The first is always open; each later one opens when the previous
 * playable level is passed. A level stays open once it has been played, even if levels are added before it.
 * `startAt` opens everything up to that level (for learners who already know the basics).
 */
export function unlockedLevels(
  order: MapLevel[],
  playable: (id: string) => boolean,
  best: (id: string) => number,
  all = false,
  startAt?: string,
): Set<string> {
  const open = new Set<string>();
  const skip = startAt ? order.findIndex((l) => l.id === startAt) : -1;
  let prev: MapLevel | undefined;
  order.forEach((l, i) => {
    if (!playable(l.id)) return;
    if (all || i <= skip || !prev || best(prev.id) >= starsToPass(prev) || best(l.id) > 0) open.add(l.id);
    prev = l;
  });
  return open;
}

/**
 * The level to suggest next: the first open level not yet passed (from `startAt` on, if given),
 * else the last open one.
 */
export function currentLevel(
  order: MapLevel[],
  open: Set<string>,
  best: (id: string) => number,
  startAt?: string,
): string | undefined {
  const from = Math.max(0, order.findIndex((l) => l.id === startAt));
  const opened = order.filter((l, i) => open.has(l.id) && i >= from);
  const fallback = order.filter((l) => open.has(l.id));
  return (opened.find((l) => best(l.id) < starsToPass(l)) ?? fallback.at(-1))?.id;
}

/** The next playable level after `id`, if any. */
export function nextLevel(order: MapLevel[], id: string, playable: (id: string) => boolean): string | undefined {
  const i = order.findIndex((l) => l.id === id);
  return order.slice(i + 1).find((l) => playable(l.id))?.id;
}
