import type { ReactNode } from 'react';
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

interface Props {
  tone?: Tone;
  /** Overrides the default label for the tone. */
  label?: string | null;
  children: ReactNode;
}

/** Bapu's avatar with a speech bubble. Give it a new `key` per message so each line animates in. */
export function BapuBubble({ tone = 'neutral', label, children }: Props) {
  const heading = label === undefined ? LABEL[tone] : label;
  return (
    <div className={`bapu bapu-${tone}`} aria-live="polite">
      <img className="bapu-avatar" src={BAPU.head} alt="Bapu" width={56} height={56} />
      <div className="bapu-bubble">
        {heading && <strong className="bapu-label">{heading}</strong>}
        <p>{children}</p>
      </div>
    </div>
  );
}
