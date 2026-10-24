/** How Bapu's lines sound: read aloud in the device's most natural voice, his murmur, or nothing. */
export type VoiceMode = 'murmur' | 'read' | 'off';

export interface SoundPrefs {
  sfx: boolean;
  music: boolean;
  voice: VoiceMode;
}

export const DEFAULT_PREFS: SoundPrefs = { sfx: true, music: true, voice: 'read' };

const KEY = 'apechess.sound';
const VOICES: VoiceMode[] = ['murmur', 'read', 'off'];

/** Reads stored prefs, keeping defaults for anything missing or malformed. */
export function parsePrefs(raw: string | null): SoundPrefs {
  if (!raw) return DEFAULT_PREFS;
  try {
    const p = JSON.parse(raw) as Partial<SoundPrefs>;
    return {
      sfx: typeof p.sfx === 'boolean' ? p.sfx : DEFAULT_PREFS.sfx,
      music: typeof p.music === 'boolean' ? p.music : DEFAULT_PREFS.music,
      voice: VOICES.includes(p.voice as VoiceMode) ? (p.voice as VoiceMode) : DEFAULT_PREFS.voice,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

/** Sound settings are per device, so they live in localStorage rather than the progress store. */
export function loadPrefs(): SoundPrefs {
  try {
    return parsePrefs(localStorage.getItem(KEY));
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(p: SoundPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Private mode or blocked storage: the setting lasts for this visit only.
  }
}
