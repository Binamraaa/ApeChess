// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Binamra Bhusal

import { describe, expect, it } from 'vitest';
import { SNAPSHOT_VERSION, mergeSnapshots, sameSnapshot, type Snapshot } from './merge';
import { syncOnce, type Cloud, type CloudCopy, type Local } from './sync';

const snap = (device: string, xp: number, stars: Record<string, 1 | 2 | 3> = {}): Snapshot => ({
  version: SNAPSHOT_VERSION,
  profile: { xp, xpBy: xp ? { [device]: xp } : {}, streak: { count: 0, lastDay: null }, started: true },
  levels: Object.entries(stars).map(([id, bestStars]) => ({ id, bestStars, timesCompleted: 1, lastPlayed: '2026-10-22' })),
  riddle: { recent: [], solved: 0 },
  review: [],
});

/** An in-memory cloud row with the same rev rule as the database. */
function fakeCloud(start: CloudCopy | null = null) {
  let row = start;
  let writes = 0;
  /** Runs once, before the next write: another device saving at the same moment. */
  let race: (() => void) | null = null;
  const cloud: Cloud = {
    async read() {
      return row && { ...row };
    },
    async create(data) {
      race?.();
      race = null;
      if (row) return false;
      row = { data, rev: 1 };
      writes++;
      return true;
    },
    async replace(data, rev) {
      race?.();
      race = null;
      if (!row || row.rev !== rev) return false;
      row = { data, rev: rev + 1 };
      writes++;
      return true;
    },
  };
  return {
    cloud,
    row: () => row,
    writes: () => writes,
    raceOnce: (fn: () => void) => (race = fn),
    set: (r: CloudCopy) => (row = r),
  };
}

function fakeDevice(device: string, start: Snapshot): Local & { now: () => Snapshot } {
  let current = start;
  return {
    now: () => current,
    async read() {
      return current;
    },
    async merge(other) {
      const next = mergeSnapshots(current, other, device);
      const changed = !sameSnapshot(current, next);
      current = next;
      return { snapshot: next, changed };
    },
  };
}

describe('cloud sync', () => {
  it('uploads the first copy', async () => {
    const c = fakeCloud();
    const laptop = fakeDevice('laptop', snap('laptop', 40, { L02: 2 }));
    expect(await syncOnce(c.cloud, laptop)).toEqual({ pulled: false });
    expect(c.row()!.data).toEqual(laptop.now());
  });

  it('brings progress to a new device, and writes nothing when the cloud already has it all', async () => {
    const c = fakeCloud({ data: snap('laptop', 40, { L02: 2 }), rev: 3 });
    const phone = fakeDevice('phone', snap('phone', 0));
    expect(await syncOnce(c.cloud, phone)).toEqual({ pulled: true });
    expect(phone.now().profile.xp).toBe(40);
    expect(phone.now().levels.map((l) => l.id)).toEqual(['L02']);
    // Nothing new on the phone, so the cloud copy is left as it was.
    expect(c.writes()).toBe(0);
  });

  it('merges both ways when two devices have played', async () => {
    const c = fakeCloud({ data: snap('laptop', 40, { L02: 2 }), rev: 1 });
    const phone = fakeDevice('phone', snap('phone', 25, { L03: 3 }));
    await syncOnce(c.cloud, phone);
    const cloud = c.row()!;
    expect(cloud.rev).toBe(2);
    expect((cloud.data as Snapshot).profile.xp).toBe(65);
    expect((cloud.data as Snapshot).levels.map((l) => l.id)).toEqual(['L02', 'L03']);
  });

  it('starts over when another device writes at the same moment', async () => {
    const c = fakeCloud({ data: snap('laptop', 40), rev: 1 });
    const phone = fakeDevice('phone', snap('phone', 10));
    c.raceOnce(() => c.set({ data: { ...snap('laptop', 60), profile: { ...snap('laptop', 60).profile } }, rev: 2 }));
    await syncOnce(c.cloud, phone);
    expect(c.row()!.rev).toBe(3);
    expect((c.row()!.data as Snapshot).profile.xpBy).toEqual({ laptop: 60, phone: 10 });
    expect(phone.now().profile.xp).toBe(70);
  });

  it('leaves a copy from a newer app alone', async () => {
    const c = fakeCloud({ data: { version: SNAPSHOT_VERSION + 1 }, rev: 1 });
    expect(await syncOnce(c.cloud, fakeDevice('phone', snap('phone', 5)))).toBe('newer');
    expect(c.writes()).toBe(0);
  });

  it('replaces a broken cloud copy', async () => {
    const c = fakeCloud({ data: 'nonsense', rev: 4 });
    const phone = fakeDevice('phone', snap('phone', 5));
    await syncOnce(c.cloud, phone);
    expect(c.row()).toEqual({ data: phone.now(), rev: 5 });
  });
});
