// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Binamra Bhusal

/**
 * Asks the browser to keep ApeChess's data instead of clearing it when space runs low or the site
 * goes unvisited (Safari clears websites' data after 7 days without a visit). Each browser decides
 * in its own way: Chrome by how much the site is used, Firefox by asking the learner, Safari by
 * granting it to apps added to the home screen. Asked once per session, after progress is saved.
 */
let asked = false;

export async function keepProgress(): Promise<boolean> {
  const storage = typeof navigator === 'undefined' ? undefined : navigator.storage;
  if (asked || !storage?.persist) return false;
  asked = true;
  try {
    return (await storage.persisted()) || (await storage.persist());
  } catch {
    return false;
  }
}
