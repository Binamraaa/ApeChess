// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Binamra Bhusal

import { useEffect, useState, useSyncExternalStore, type FormEvent } from 'react';
import { BapuBubble } from '../bapu/BapuBubble';
import { deleteCloudCopy, enterCode, getAccount, onAccount, prepareCloud, sendCode, signOut, syncNow } from '../progress/cloud';
import { formatAgo } from './format';
import { Close, Cloud } from './icons';
import './level/level.css';
import './account.css';

interface Props {
  onExit: () => void;
}

/** Cloud backup: sign in with an emailed code, see when progress was last backed up, sign out. */
export function Account({ onExit }: Props) {
  const account = useSyncExternalStore(onAccount, getAccount);
  useEffect(() => void prepareCloud(), []);

  return (
    <div className="level account">
      <header className="level-bar">
        <button className="icon-btn" onClick={onExit} aria-label="Close">
          <Close size={22} />
        </button>
        <span className="riddle-title">Progress backup</span>
      </header>
      <main className="level-main account-main">
        {account.status === 'off' ? (
          <BapuBubble>This copy of ApeChess has no cloud backup set up, so your progress stays on this device.</BapuBubble>
        ) : account.status === 'signed-in' ? (
          <SignedIn />
        ) : (
          <SignIn />
        )}
      </main>
    </div>
  );
}

function SignIn() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resent, setResent] = useState(false);

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await task();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const send = (e?: FormEvent) => {
    e?.preventDefault();
    void run(async () => {
      await sendCode(email.trim());
      setResent(step === 'code');
      setStep('code');
    });
  };

  const verify = (e: FormEvent) => {
    e.preventDefault();
    void run(() => enterCode(email.trim(), code.replace(/\D/g, '')));
  };

  if (step === 'email') {
    return (
      <>
        <BapuBubble key="email">
          Your progress lives on this device. Give me your email and I’ll keep a copy safe, so you can carry on from any phone or
          computer.
        </BapuBubble>
        <form className="account-form" onSubmit={send}>
          <label className="account-label" htmlFor="account-email">
            Your email
          </label>
          <input
            id="account-email"
            className="account-input"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {error && <p className="account-error" role="alert">{error}</p>}
          <button className="btn btn-block btn-teal" disabled={busy || !email.includes('@')}>
            {busy ? 'Sending…' : 'Email me a sign-in code'}
          </button>
          <p className="account-small">No password to remember. Your email is only used to sign you in: no newsletters, ever.</p>
        </form>
      </>
    );
  }

  return (
    <>
      <BapuBubble key="code">I’ve sent a code to {email.trim()}. It may take a minute, and do peek in the spam folder.</BapuBubble>
      <form className="account-form" onSubmit={verify}>
        <label className="account-label" htmlFor="account-code">
          Code from the email
        </label>
        <input
          id="account-code"
          className="account-input account-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]*"
          maxLength={12}
          placeholder="123456"
          required
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        {error && <p className="account-error" role="alert">{error}</p>}
        <button className="btn btn-block btn-teal" disabled={busy || code.replace(/\D/g, '').length < 6}>
          {busy ? 'Checking…' : 'Sign in'}
        </button>
        <p className="account-small">Got a link instead of a code? Open it on this device.</p>
        <div className="account-links">
          <button type="button" className="link-btn" disabled={busy} onClick={() => send()}>
            {resent ? 'Sent again!' : 'Send a new code'}
          </button>
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setStep('email');
              setCode('');
              setError('');
            }}
          >
            Use a different email
          </button>
        </div>
      </form>
    </>
  );
}

function SignedIn() {
  const account = useSyncExternalStore(onAccount, getAccount);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Re-render each minute so "5 min ago" stays true.
  const [, tick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const status = account.needsUpdate
    ? 'A newer ApeChess saved your progress. Reload the app to update, then it will sync again.'
    : account.syncing
      ? 'Backing up…'
      : account.error
        ? account.error
        : account.lastSync
          ? `Backed up ${formatAgo(Date.now() - account.lastSync)}`
          : 'Waiting to back up';

  const remove = async () => {
    setBusy(true);
    setError('');
    try {
      await deleteCloudCopy();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <>
      <BapuBubble tone="good" label="All safe">
        Your stars, XP and streak are backed up. Sign in with the same email on another device and carry on where you left off.
      </BapuBubble>
      <section className="account-card">
        <span className="account-cloud" aria-hidden="true">
          <Cloud size={26} />
        </span>
        <div>
          <strong>{account.email}</strong>
          <small className={account.error || account.needsUpdate ? 'account-warn' : ''} aria-live="polite">
            {status}
          </small>
        </div>
      </section>
      <div className="account-actions">
        <button className="btn btn-block btn-ghost" disabled={account.syncing} onClick={() => void syncNow()}>
          Back up now
        </button>
        <button className="btn btn-block btn-ghost" onClick={() => void signOut()}>
          Sign out of this device
        </button>
      </div>
      <p className="account-small">Signing out keeps your progress on this device too.</p>
      {error && <p className="account-error" role="alert">{error}</p>}
      {confirmDelete ? (
        <div className="account-delete">
          <p>Delete the cloud copy? Progress on this device stays, but other devices won’t get it.</p>
          <div className="account-links">
            <button className="link-btn danger" disabled={busy} onClick={remove}>
              {busy ? 'Deleting…' : 'Yes, delete it'}
            </button>
            <button className="link-btn" onClick={() => setConfirmDelete(false)}>
              Keep it
            </button>
          </div>
        </div>
      ) : (
        <button className="link-btn danger" onClick={() => setConfirmDelete(true)}>
          Delete my cloud copy
        </button>
      )}
    </>
  );
}
