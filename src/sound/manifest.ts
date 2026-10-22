/**
 * Recorded sounds that replace the built-in synth ones. `public/sounds/sounds.json` lists them,
 * so new audio (e.g. from Surilo) drops in without code changes. See docs/sound.md.
 */

export const CUES = ['tap', 'move', 'capture', 'check', 'correct', 'wrong', 'hint', 'solved', 'star', 'complete'] as const;
export type Cue = (typeof CUES)[number];

export const TRACKS = ['home', 'level'] as const;
export type Track = (typeof TRACKS)[number];

export interface SoundManifest {
  /** Cue → file name inside public/sounds/. */
  cues: Partial<Record<Cue, string>>;
  /** Looping music → file name inside public/sounds/. */
  music: Partial<Record<Track, string>>;
}

export const EMPTY_MANIFEST: SoundManifest = { cues: {}, music: {} };

function pick<K extends string>(obj: unknown, keys: readonly K[]): Partial<Record<K, string>> {
  const out: Partial<Record<K, string>> = {};
  if (!obj || typeof obj !== 'object') return out;
  for (const k of keys) {
    const v = (obj as Record<string, unknown>)[k];
    // Plain file names only: no paths out of the sounds folder.
    if (typeof v === 'string' && /^[\w.-]+\.(mp3|m4a|ogg|wav)$/i.test(v)) out[k] = v;
  }
  return out;
}

/** Keeps only known cues and tracks with plain audio file names; ignores anything else. */
export function parseManifest(json: unknown): SoundManifest {
  if (!json || typeof json !== 'object') return EMPTY_MANIFEST;
  const m = json as Record<string, unknown>;
  return { cues: pick(m.cues, CUES), music: pick(m.music, TRACKS) };
}
