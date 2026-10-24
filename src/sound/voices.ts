/**
 * Picks the most natural-sounding voice the device offers for reading Bapu's lines aloud.
 * Devices list dozens of voices of very mixed quality: the neural ("Natural", "Enhanced") ones
 * sound like a person, the old built-in ones sound like a robot. Pure, so it can be tested.
 */

export interface VoiceInfo {
  name: string;
  lang: string;
  /** False for voices that need the internet (e.g. Chrome's Google voices, Edge's natural ones). */
  localService: boolean;
}

/** Joke voices (mostly Apple's) that no one wants for a chess coach. */
const NOVELTY =
  /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|organ|superstar|trinoids|whisper|wobble|zarvox)\b/i;
/** Bapu is an older gentleman, so a man's voice suits him best. */
const MALE =
  /\b(male|ryan|guy|thomas|christopher|eric|andrew|brian|davis|roger|steffan|daniel|arthur|oliver|george|alfie|ethan|noah|liam|william|prabhat|ravi|aaron|rishi|grandpa)\b/i;
const ACCENT: [RegExp, number][] = [
  [/^en[-_]GB/i, 8],
  [/^en[-_]IN/i, 6],
  [/^en[-_](IE|AU|NZ)/i, 4],
  [/^en[-_]US/i, 3],
];

/** How good a voice is likely to sound, or null for one that shouldn't be used. */
export function voiceScore(v: VoiceInfo, online = true): number | null {
  if (!/^en\b|^en[-_]/i.test(v.lang) || NOVELTY.test(v.name) || /espeak/i.test(v.name)) return null;
  if (!v.localService && !online) return null;
  let score = 0;
  if (/natural|neural/i.test(v.name)) score += 60;
  else if (/enhanced|premium/i.test(v.name)) score += 50;
  else if (/google/i.test(v.name)) score += 30;
  if (/desktop/i.test(v.name)) score -= 20;
  if (MALE.test(v.name)) score += 15;
  score += ACCENT.find(([re]) => re.test(v.lang))?.[1] ?? 0;
  return score;
}

/** The best usable voice, or undefined if there's none. `skip` lists voices that already failed. */
export function bestVoice<V extends VoiceInfo>(voices: V[], online = true, skip: Set<string> = new Set()): V | undefined {
  let best: V | undefined;
  let top = -Infinity;
  for (const v of voices) {
    const s = skip.has(v.name) ? null : voiceScore(v, online);
    if (s !== null && s > top) [best, top] = [v, s];
  }
  return best;
}

/** Natural voices sound best as they are; older ones sound a little less robotic lower and slower. */
export function voiceTuning(v: VoiceInfo | undefined): { rate: number; pitch: number } {
  return v && /natural|neural|enhanced|premium|google/i.test(v.name) ? { rate: 0.95, pitch: 1 } : { rate: 0.92, pitch: 0.85 };
}
