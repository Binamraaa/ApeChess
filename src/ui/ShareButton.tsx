import { useState } from 'react';

/** Where a shared result points: the app itself. */
export const APP_URL = new URL(import.meta.env.BASE_URL, location.origin).href;

/** Shares text with the phone's share sheet, or copies it where there isn't one. */
async function shareText(text: string): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}

export function ShareButton({ text, className = 'btn btn-ghost' }: { text: () => string; className?: string }) {
  const [label, setLabel] = useState<string | null>(null);
  const share = async () => {
    const r = await shareText(text());
    if (r === 'copied' || r === 'failed') {
      setLabel(r === 'copied' ? 'Copied!' : 'Couldn’t share');
      window.setTimeout(() => setLabel(null), 1800);
    }
  };
  return (
    <button className={className} onClick={share}>
      {label ?? 'Share'}
    </button>
  );
}
