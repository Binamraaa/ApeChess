// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Binamra Bhusal

import { parseSnapshot, sameSnapshot, type Snapshot } from './merge';

/**
 * One round of cloud sync: read the cloud copy, merge it into this device, and write the merged
 * snapshot back if the cloud is behind. Kept apart from Supabase so it can be tested.
 */

export interface CloudCopy {
  data: unknown;
  rev: number;
}

export interface Cloud {
  read(): Promise<CloudCopy | null>;
  /** Writes the first copy; false if another device got there first. */
  create(data: Snapshot): Promise<boolean>;
  /** Replaces the copy at `rev`; false if another device has written since. */
  replace(data: Snapshot, rev: number): Promise<boolean>;
}

export interface Local {
  read(): Promise<Snapshot>;
  merge(other: Snapshot): Promise<{ snapshot: Snapshot; changed: boolean }>;
}

/** `pulled`: this device got progress from the cloud. `newer`: the cloud copy is from a newer app. */
export type SyncResult = { pulled: boolean } | 'newer';

export async function syncOnce(cloud: Cloud, local: Local, tries = 3): Promise<SyncResult> {
  let pulled = false;
  for (let i = 0; i < tries; i++) {
    const copy = await cloud.read();
    if (!copy) {
      if (await cloud.create(await local.read())) return { pulled };
      continue;
    }
    const remote = parseSnapshot(copy.data);
    if (remote === 'newer') return 'newer';
    // A broken cloud copy is replaced by this device's.
    const merged = remote ? await local.merge(remote) : { snapshot: await local.read(), changed: false };
    pulled ||= merged.changed;
    if (remote && sameSnapshot(merged.snapshot, remote)) return { pulled };
    if (await cloud.replace(merged.snapshot, copy.rev)) return { pulled };
  }
  throw new Error('The cloud copy kept changing; trying again later.');
}
