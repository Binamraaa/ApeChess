// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Binamra Bhusal

import type { AuthError, SupabaseClient } from '@supabase/supabase-js';
import { exportSnapshot, mergeIntoLocal, onSaved } from './store';
import { syncOnce, type Cloud } from './sync';

/**
 * Optional cloud backup with Supabase: sign in with an emailed code, and progress follows the
 * learner to any device. The device's own copy stays the one the app plays from; the cloud copy
 * is merged in whenever there's a connection. Without VITE_SUPABASE_URL and VITE_SUPABASE_KEY
 * (e.g. a fork with no backend) all of this is switched off. Supabase's code is only downloaded
 * once the learner opens the sign-in page or has signed in before.
 */

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_KEY as string | undefined;
export const cloudAvailable = Boolean(URL && KEY);

const AUTH_KEY = 'apechess.auth';
/** Sync shortly after a save, so a burst of saves sends one update. */
const SAVE_DELAY = 2000;
/** Coming back to the app checks for progress from other devices, at most this often. */
const RECHECK = 60_000;

export interface Account {
  status: 'off' | 'signed-out' | 'signed-in';
  email?: string;
  syncing: boolean;
  /** When the last sync finished, in ms. */
  lastSync?: number;
  error?: string;
  /** The cloud copy is from a newer version of the app: this one needs updating first. */
  needsUpdate?: boolean;
}

let account: Account = { status: cloudAvailable ? 'signed-out' : 'off', syncing: false };
const listeners = new Set<() => void>();

export const getAccount = () => account;

export function onAccount(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function update(next: Partial<Account>) {
  account = { ...account, ...next };
  listeners.forEach((fn) => fn());
}

let clientPromise: Promise<SupabaseClient> | null = null;

function client(): Promise<SupabaseClient> {
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) => {
    const sb = createClient(URL!, KEY!, {
      auth: { storageKey: AUTH_KEY, flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    sb.auth.onAuthStateChange((event, session) => {
      update({ status: session ? 'signed-in' : 'signed-out', email: session?.user.email });
      // Supabase holds its auth lock during this callback, so the sync waits for it to finish.
      if (session && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) setTimeout(() => void syncNow(), 0);
    });
    return sb;
  });
  return clientPromise;
}

/** True if this device signed in before, or is opening a sign-in link. */
function signedInBefore(): boolean {
  try {
    return localStorage.getItem(AUTH_KEY) !== null || new URLSearchParams(location.search).has('code');
  } catch {
    return false;
  }
}

function supabaseCloud(sb: SupabaseClient, userId: string): Cloud {
  const table = () => sb.from('progress');
  return {
    async read() {
      const { data, error } = await table().select('data, rev').eq('user_id', userId).maybeSingle();
      if (error) throw error;
      return data;
    },
    async create(data) {
      const { error } = await table().insert({ user_id: userId, data });
      if (error?.code === '23505') return false; // another device made it first
      if (error) throw error;
      return true;
    },
    async replace(data, rev) {
      const { data: rows, error } = await table().update({ data, rev: rev + 1 }).eq('user_id', userId).eq('rev', rev).select('rev');
      if (error) throw error;
      return rows.length > 0;
    },
  };
}

let running: Promise<void> | null = null;
let again = false;

/** Syncs now (or right after the sync already running). Quietly does nothing when signed out or offline. */
export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await syncPass();
    } while (again);
  })().finally(() => (running = null));
  return running;
}

async function syncPass() {
  if (account.status !== 'signed-in' || !navigator.onLine) return;
  update({ syncing: true });
  try {
    const sb = await client();
    const { data } = await sb.auth.getSession();
    if (!data.session) return;
    const result = await syncOnce(supabaseCloud(sb, data.session.user.id), { read: exportSnapshot, merge: mergeIntoLocal });
    update({ lastSync: Date.now(), error: undefined, needsUpdate: result === 'newer' });
  } catch (e) {
    console.warn('Cloud sync failed', e);
    update({ error: 'Couldn’t reach the cloud. Your progress is safe here, and I’ll try again soon.' });
  } finally {
    update({ syncing: false });
  }
}

/** Plain-language messages for the errors a learner can run into while signing in. */
function friendly(e: AuthError): Error {
  const code = e.code ?? '';
  if (e.status === 429 || code.includes('rate_limit')) return new Error('Too many emails just now. Give it a few minutes, then try again.');
  if (code === 'otp_expired' || code === 'invalid_credentials') return new Error('That code didn’t work. It may have expired, so ask for a new one.');
  if (code === 'email_address_invalid' || code === 'validation_failed') return new Error('That email address doesn’t look right.');
  return new Error('Something went wrong. Check your connection and try again.');
}

/** Emails a sign-in code (and link). New emails get an account. */
export async function sendCode(email: string): Promise<void> {
  const sb = await client();
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: `${location.origin}${location.pathname}` },
  });
  if (error) throw friendly(error);
}

export async function enterCode(email: string, code: string): Promise<void> {
  const sb = await client();
  const { error } = await sb.auth.verifyOtp({ email, token: code, type: 'email' });
  if (error) throw friendly(error);
}

/** Signs this device out. Its progress stays on the device. */
export async function signOut(): Promise<void> {
  const sb = await client();
  await sb.auth.signOut({ scope: 'local' });
  update({ status: 'signed-out', email: undefined, lastSync: undefined, error: undefined });
}

/** Deletes the cloud copy and signs out. Progress on this device stays. */
export async function deleteCloudCopy(): Promise<void> {
  const sb = await client();
  const { data } = await sb.auth.getSession();
  if (data.session) {
    const { error } = await sb.from('progress').delete().eq('user_id', data.session.user.id);
    if (error) throw new Error('Couldn’t delete it just now. Check your connection and try again.');
  }
  await signOut();
}

/** Loads the sign-in code ahead of time (when the learner opens the sign-in page). */
export const prepareCloud = () => (cloudAvailable ? client().then(() => undefined) : Promise.resolve());

let lastCheck = 0;

export function initCloud() {
  if (!cloudAvailable) return;
  let timer: number | undefined;
  onSaved(() => {
    clearTimeout(timer);
    timer = window.setTimeout(() => void syncNow(), SAVE_DELAY);
  });
  addEventListener('online', () => void syncNow());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || Date.now() - lastCheck < RECHECK) return;
    lastCheck = Date.now();
    void syncNow();
  });
  if (signedInBefore()) void client();
}
