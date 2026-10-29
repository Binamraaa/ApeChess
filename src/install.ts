// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Binamra Bhusal

// "Install app" support: Chrome and Edge fire beforeinstallprompt when the PWA can be installed.
// We keep the event so the intro page can offer an install button at the right moment.

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallEvent | null = null;
const listeners = new Set<(ok: boolean) => void>();
const notify = () => listeners.forEach((l) => l(Boolean(deferred)));

addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e as InstallEvent;
  notify();
});

addEventListener('appinstalled', () => {
  deferred = null;
  notify();
});

export const canInstall = () => Boolean(deferred);

/** Subscribes to install availability; returns the unsubscribe function. */
export function onInstallChange(fn: (ok: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Shows the browser's install prompt (must be called from a tap). */
export async function install(): Promise<void> {
  if (!deferred) return;
  await deferred.prompt();
  await deferred.userChoice;
  deferred = null;
  notify();
}
