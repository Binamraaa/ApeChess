// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Binamra Bhusal

import { Children, isValidElement, useEffect, useState, type ReactNode } from 'react';
import { play, speak } from '../sound/engine';
import type { Cue } from '../sound/manifest';
import './bapu.css';

export type Tone = 'neutral' | 'good' | 'bad' | 'hint';

export const BAPU = {
  head: `${import.meta.env.BASE_URL}bapu/bapu-head-128.webp`,
  headLarge: `${import.meta.env.BASE_URL}bapu/bapu-head-256.webp`,
  portrait: `${import.meta.env.BASE_URL}bapu/bapu-512.webp`,
};

const LABEL: Record<Tone, string | null> = {
  neutral: null,
  good: 'Brilliant!',
  bad: 'Not quite',
  hint: 'Hint',
};

const CUE: Record<Tone, Cue | null> = {
  neutral: null,
  good: 'correct',
  bad: 'wrong',
  hint: 'hint',
};

/** The plain text of a line, for Bapu's voice. */
function textOf(node: ReactNode): string {
  return Children.toArray(node)
    .map((n) => (typeof n === 'string' || typeof n === 'number' ? String(n) : isValidElement(n) ? textOf((n.props as { children?: ReactNode }).children) : ''))
    .join('');
}

interface Props {
  tone?: Tone;
  /** Overrides the default label for the tone. */
  label?: string | null;
  /** Overrides the sound for the tone; null for none. */
  cue?: Cue | null;
  children: ReactNode;
}

/**
 * Bapu's avatar with a speech bubble. Give it a new `key` per message so each line animates in;
 * each new line also plays its tone's sound and Bapu says it.
 */
export function BapuBubble({ tone = 'neutral', label, cue, children }: Props) {
  const heading = label === undefined ? LABEL[tone] : label;
  const [talking, setTalking] = useState(false);

  useEffect(() => {
    const sound = cue === undefined ? CUE[tone] : cue;
    if (sound) play(sound);
    const ms = speak(textOf(children), tone, sound ? 0.15 : 0);
    if (!ms) return;
    setTalking(true);
    const t = window.setTimeout(() => setTalking(false), ms);
    return () => clearTimeout(t);
    // Once per line: the bubble is keyed by message.
  }, []);

  return (
    <div className={`bapu bapu-${tone}`} aria-live="polite">
      <img className={`bapu-avatar ${talking ? 'talking' : ''}`} src={BAPU.head} alt="Bapu" width={56} height={56} />
      <div className="bapu-bubble">
        {heading && <strong className="bapu-label">{heading}</strong>}
        <p>{children}</p>
      </div>
    </div>
  );
}
